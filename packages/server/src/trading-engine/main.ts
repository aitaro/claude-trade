/** Trading Engine メインエントリポイント */

import { parseArgs } from "node:util";
import { createBroker } from "../broker/index.js";
import type { BrokerAdapter } from "../broker/index.js";
import { loadEnv } from "../config.js";
import { pool } from "../db/client.js";
import { createLogger } from "../lib/logger.js";
import { completeSession, recordDecision, startSession } from "./audit.js";
import { checkDailyLoss } from "./kill-switch.js";
import { getStartingNav } from "./nav.js";
import { generateOrders } from "./portfolio-calc.js";
import { checkOrder, getRiskState, incrementOrderCount } from "./risk-engine.js";
import { getLatestSignalPerSymbol } from "./signal-reader.js";

async function run(marketId: string, sharedBroker?: BrokerAdapter): Promise<void> {
  const env = loadEnv();
  const log = createLogger("trading", marketId.toUpperCase());

  const sessionLog = await startSession("trading");
  let ordersPlaced = 0;
  const ownBroker = !sharedBroker;

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

    // 3. ブローカー接続
    const broker = sharedBroker ?? createBroker();
    if (ownBroker) {
      try {
        await broker.connect();
      } catch (e) {
        log.error({ err: e, broker: broker.name }, "Broker connection failed. Aborting.");
        await completeSession(sessionLog, {
          status: "failed",
          summary: `Broker connection failed: ${e}`,
        });
        return;
      }
    }

    try {
      const account = await broker.getAccountSummary();
      const nav = account.netLiquidation;
      log.info({ currency: account.currency, nav }, "NAV");

      // ポジション取得 → Map<symbol, quantity> に変換
      const positionList = await broker.getPositions();
      const positions = new Map<string, number>();
      for (const p of positionList) {
        positions.set(p.symbol, p.quantity);
      }

      // 価格取得 → Map<symbol, number> に変換
      const quotes = await broker.getQuotes([...signalMap.keys()]);
      const prices = new Map<string, number>();
      for (const [sym, q] of quotes) {
        prices.set(sym, q.last ?? q.bid ?? 0);
      }

      // 4. 日次損失チェック
      const startingNav = await getStartingNav(nav);
      const killed = await checkDailyLoss(nav, startingNav);
      if (killed) {
        log.warn("Kill switch triggered by daily loss. Aborting.");
        await completeSession(sessionLog, { status: "aborted", summary: "Daily loss kill switch" });
        return;
      }

      // 5. 注文生成
      const orderRequests = generateOrders(signalMap, nav, positions, prices, env.MAX_POSITION_PCT);

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

        const result = await broker.placeOrder(orderReq);
        await incrementOrderCount();
        ordersPlaced++;
        log.info(
          {
            symbol: orderReq.symbol,
            side: orderReq.side,
            quantity: orderReq.quantity,
            brokerOrderId: result.brokerOrderId,
            status: result.status,
            fillPrice: result.fillPrice,
          },
          "Order PLACED",
        );

        // TODO: DB に Order レコードを保存 (broker_order_id カラム追加後)
      }
    } finally {
      if (ownBroker) {
        broker.disconnect();
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
  const broker = createBroker();
  try {
    await broker.connect();
  } catch (e) {
    log.error({ err: e }, "Broker connection failed. Aborting all markets.");
    return;
  }

  try {
    for (const marketId of marketIds) {
      try {
        await run(marketId, broker);
      } catch (e) {
        log.error({ err: e, market: marketId.toUpperCase() }, "Market trading error");
      }
    }
  } finally {
    broker.disconnect();
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
