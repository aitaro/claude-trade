/** Trading Engine メインエントリポイント */

import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { parseArgs } from "util";
import { PROJECT_ROOT, loadEnv } from "../config.js";
import { getLatestSignalPerSymbol } from "./signal-reader.js";
import { generateOrders } from "./portfolio-calc.js";
import { checkOrder, incrementOrderCount, getRiskState } from "./risk-engine.js";
import { checkDailyLoss } from "./kill-switch.js";
import { Executor } from "./executor.js";
import { recordDecision, startSession, completeSession } from "./audit.js";
import { getStartingNav } from "./nav.js";
import { pool } from "../db/client.js";

const STRATEGY_DIR = resolve(PROJECT_ROOT, "strategies");

const MARKET_DEFAULTS: Record<string, { exchange: string; currency: string; strategyFile: string }> = {
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
  const mkt = loadMarketConfig(marketId);
  const { exchange, currency } = mkt;

  const sessionLog = await startSession("trading");
  let ordersPlaced = 0;
  const ownExecutor = !sharedExecutor;

  try {
    // 1. アクティブシグナルを読み取り
    const signalMap = await getLatestSignalPerSymbol(marketId);
    if (signalMap.size === 0) {
      console.log(`[TRADING/${marketId.toUpperCase()}] No active signals found. Nothing to do.`);
      await completeSession(sessionLog, { summary: `No active signals for ${marketId}` });
      return;
    }

    console.log(`[TRADING/${marketId.toUpperCase()}] Found ${signalMap.size} active signals: ${[...signalMap.keys()]}`);

    // 2. Kill switch チェック
    const state = await getRiskState();
    if (state.killSwitchActive) {
      console.log(`[TRADING/${marketId.toUpperCase()}] Kill switch active: ${state.killSwitchReason}. Aborting.`);
      await completeSession(sessionLog, { status: "aborted", summary: "Kill switch active" });
      return;
    }

    // 3. IBKR 接続
    const executor = sharedExecutor ?? new Executor();
    if (ownExecutor) {
      try {
        await executor.connect();
      } catch (e) {
        console.log(`[TRADING/${marketId.toUpperCase()}] IB connection failed: ${e}. Aborting.`);
        await completeSession(sessionLog, { status: "failed", summary: `IB connection failed: ${e}` });
        return;
      }
    }

    try {
      const { nav: navRaw, currency: baseCurrency } = await executor.getNav();
      const positions = await executor.getCurrentPositions();
      const prices = await executor.getCurrentPrices(
        [...signalMap.keys()],
        exchange,
        currency,
      );

      // NAV を取引通貨に変換
      let nav: number;
      if (baseCurrency !== currency) {
        const fxRate = await executor.getFxRate(baseCurrency, currency);
        if (fxRate <= 0) {
          console.log(`[TRADING/${marketId.toUpperCase()}] Failed to get FX rate ${baseCurrency}->${currency}. Aborting.`);
          await completeSession(sessionLog, { status: "failed", summary: `FX rate unavailable: ${baseCurrency}->${currency}` });
          return;
        }
        nav = navRaw * fxRate;
        console.log(`[TRADING/${marketId.toUpperCase()}] NAV: ${baseCurrency} ${navRaw.toLocaleString()} -> ${currency} ${nav.toLocaleString()} (FX: ${fxRate.toFixed(6)})`);
      } else {
        nav = navRaw;
        console.log(`[TRADING/${marketId.toUpperCase()}] NAV: ${currency} ${nav.toLocaleString()}`);
      }

      // 4. 日次損失チェック (DB から当日開始NAVを取得)
      const startingNav = await getStartingNav(navRaw);
      const killed = await checkDailyLoss(navRaw, startingNav);
      if (killed) {
        console.log(`[TRADING/${marketId.toUpperCase()}] Kill switch triggered by daily loss. Aborting.`);
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
        console.log(`[TRADING/${marketId.toUpperCase()}] No orders to execute.`);
        await completeSession(sessionLog, { summary: "No orders generated" });
        return;
      }

      console.log(`[TRADING/${marketId.toUpperCase()}] Generated ${orderRequests.length} orders`);

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
          console.log(`[TRADING/${marketId.toUpperCase()}] Order REJECTED for ${orderReq.symbol}: ${riskResult.reasons}`);
          continue;
        }

        const dbOrder = await executor.executeOrder(orderReq, decision.id);
        await incrementOrderCount();
        ordersPlaced++;
        console.log(
          `[TRADING/${marketId.toUpperCase()}] Order PLACED: ${orderReq.side} ${orderReq.quantity} ${orderReq.symbol} ` +
          `(order_id=${dbOrder.ibOrderId}, status=${dbOrder.status})`,
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
    console.log(`[TRADING/${marketId.toUpperCase()}] Session complete. Orders placed: ${ordersPlaced}`);
  } catch (e) {
    console.error(`[TRADING/${marketId.toUpperCase()}] Error: ${e}`);
    await completeSession(sessionLog, { status: "failed", summary: String(e) });
    throw e;
  }
}

async function runMultiple(marketIds: string[]): Promise<void> {
  const executor = new Executor();
  try {
    await executor.connect();
  } catch (e) {
    console.error(`[TRADING] IB connection failed: ${e}. Aborting all markets.`);
    return;
  }

  try {
    for (const marketId of marketIds) {
      try {
        await run(marketId, executor);
      } catch (e) {
        console.error(`[TRADING/${marketId.toUpperCase()}] Error: ${e}`);
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
  console.error(e);
  process.exit(1);
});
