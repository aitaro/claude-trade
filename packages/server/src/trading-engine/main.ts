/** Trading Engine メインエントリポイント */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { PROJECT_ROOT, loadEnv } from "../config.js";
import { pool } from "../db/client.js";
import { createLogger } from "../lib/logger.js";
import { completeSession, recordDecision, startSession } from "./audit.js";
import { Executor } from "./executor.js";
import { checkDailyLoss } from "./kill-switch.js";
import { getStartingNav } from "./nav.js";
import { generateOrders } from "./portfolio-calc.js";
import { checkOrder, getRiskState, incrementOrderCount } from "./risk-engine.js";
import { getLatestSignalPerSymbol } from "./signal-reader.js";

const STRATEGY_DIR = resolve(PROJECT_ROOT, "strategies");

const MARKET_DEFAULTS: Record<
  string,
  { exchange: string; currency: string; strategyFile: string }
> = {
  us: { exchange: "SMART", currency: "USD", strategyFile: "us.yaml" },
  jp: { exchange: "SMART", currency: "JPY", strategyFile: "jp.yaml" },
  eu: { exchange: "SMART", currency: "EUR", strategyFile: "eu.yaml" },
  uk: { exchange: "SMART", currency: "GBP", strategyFile: "uk.yaml" },
};

function loadMarketConfig(marketId: string): { exchange: string; currency: string } {
  const defaults = MARKET_DEFAULTS[marketId] ?? MARKET_DEFAULTS.us;
  const strategyPath = resolve(STRATEGY_DIR, defaults.strategyFile);
  try {
    const content = readFileSync(strategyPath, "utf-8");
    const strategy = parseYaml(content);
    return {
      exchange: strategy?.exchange ?? defaults.exchange,
      currency: strategy?.currency ?? defaults.currency,
    };
  } catch {
    return defaults;
  }
}

async function run(marketId: string, sharedExecutor?: Executor): Promise<void> {
  const env = loadEnv();
  const log = createLogger("trading", marketId.toUpperCase());
  const mkt = loadMarketConfig(marketId);
  const { exchange, currency } = mkt;

  const sessionLog = await startSession("trading");
  let ordersPlaced = 0;
  const ownExecutor = !sharedExecutor;

  try {
    // 1. アクティブシグナルを読み取り
    const signalMap = await getLatestSignalPerSymbol(marketId);
    if (signalMap.size === 0) {
      log.info("No active signals found. Nothing to do.");
      await completeSession(sessionLog, { summary: `No active signals for ${marketId}` });
      return;
    }

    log.info(
      { signalCount: signalMap.size, symbols: [...signalMap.keys()] },
      "Found active signals",
    );

    // 2. Kill switch チェック
    const state = await getRiskState();
    if (state.killSwitchActive) {
      log.warn({ reason: state.killSwitchReason }, "Kill switch active. Aborting.");
      await completeSession(sessionLog, { status: "aborted", summary: "Kill switch active" });
      return;
    }

    // 3. IBKR 接続
    const executor = sharedExecutor ?? new Executor();
    if (ownExecutor) {
      try {
        await executor.connect();
      } catch (e) {
        log.error({ err: e }, "IB connection failed. Aborting.");
        await completeSession(sessionLog, {
          status: "failed",
          summary: `IB connection failed: ${e}`,
        });
        return;
      }
    }

    try {
      const { nav: navRaw, currency: baseCurrency } = await executor.getNav();
      const positions = await executor.getCurrentPositions();
      const prices = await executor.getCurrentPrices([...signalMap.keys()], exchange, currency);

      // NAV を取引通貨に変換
      let nav: number;
      if (baseCurrency !== currency) {
        const fxRate = await executor.getFxRate(baseCurrency, currency);
        if (fxRate <= 0) {
          log.error({ baseCurrency, currency }, "Failed to get FX rate. Aborting.");
          await completeSession(sessionLog, {
            status: "failed",
            summary: `FX rate unavailable: ${baseCurrency}->${currency}`,
          });
          return;
        }
        nav = navRaw * fxRate;
        log.info({ baseCurrency, navRaw, currency, nav, fxRate }, "NAV converted");
      } else {
        nav = navRaw;
        log.info({ currency, nav }, "NAV");
      }

      // 4. 日次損失チェック (DB から当日開始NAVを取得)
      const startingNav = await getStartingNav(navRaw);
      const killed = await checkDailyLoss(navRaw, startingNav);
      if (killed) {
        log.warn("Kill switch triggered by daily loss. Aborting.");
        await completeSession(sessionLog, { status: "aborted", summary: "Daily loss kill switch" });
        return;
      }

      // 5. 注文生成
      const orderRequests = generateOrders(
        signalMap,
        nav,
        positions,
        prices,
        env.MAX_POSITION_PCT,
        exchange,
        currency,
      );

      if (orderRequests.length === 0) {
        log.info("No orders to execute.");
        await completeSession(sessionLog, { summary: "No orders generated" });
        return;
      }

      log.info({ orderCount: orderRequests.length }, "Generated orders");

      // 6. リスクチェック → 発注
      for (const orderReq of orderRequests) {
        const price = prices.get(orderReq.symbol) ?? 0;
        const riskResult = await checkOrder(orderReq, nav, price);

        const decision = await recordDecision(
          orderReq.signalId,
          orderReq.side.toLowerCase(),
          orderReq.symbol,
          orderReq.quantity,
          orderReq.reasoning,
          riskResult.checks,
          riskResult.approved,
        );

        if (!riskResult.approved) {
          log.warn({ symbol: orderReq.symbol, reasons: riskResult.reasons }, "Order REJECTED");
          continue;
        }

        const dbOrder = await executor.executeOrder(orderReq, decision.id);
        await incrementOrderCount();
        ordersPlaced++;
        log.info(
          {
            symbol: orderReq.symbol,
            side: orderReq.side,
            quantity: orderReq.quantity,
            orderId: dbOrder.ibOrderId,
            status: dbOrder.status,
          },
          "Order PLACED",
        );
      }
    } finally {
      if (ownExecutor) {
        executor.disconnect();
      }
    }

    await completeSession(sessionLog, {
      ordersPlaced,
      summary: `[${marketId.toUpperCase()}] Processed ${signalMap.size} signals, placed ${ordersPlaced} orders`,
    });
    log.info({ signalCount: signalMap.size, ordersPlaced }, "Session complete");
  } catch (e) {
    log.error({ err: e }, "Trading error");
    await completeSession(sessionLog, { status: "failed", summary: String(e) });
    throw e;
  }
}

async function runMultiple(marketIds: string[]): Promise<void> {
  const log = createLogger("trading");
  const executor = new Executor();
  try {
    await executor.connect();
  } catch (e) {
    log.error({ err: e }, "IB connection failed. Aborting all markets.");
    return;
  }

  try {
    for (const marketId of marketIds) {
      try {
        await run(marketId, executor);
      } catch (e) {
        log.error({ err: e, market: marketId.toUpperCase() }, "Market trading error");
      }
    }
  } finally {
    executor.disconnect();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      market: { type: "string", default: "us" },
    },
    allowPositionals: true,
  });

  const markets = (values.market ?? "us").split(",").map((m) => m.trim());

  try {
    if (markets.length === 1) {
      await run(markets[0]);
    } else {
      await runMultiple(markets);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  createLogger("trading").error({ err: e }, "Trading engine fatal error");
  process.exit(1);
});
