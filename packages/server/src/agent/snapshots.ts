/** スケジューラ用: ブローカーからスナップショットを取得して DB に保存 */

import { db } from "../db/client.js";
import { accountSnapshots, positionSnapshots } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import { createBroker } from "../broker/index.js";

const log = createLogger("snapshot");

export async function captureSnapshots(): Promise<void> {
  const broker = createBroker();

  try {
    await broker.connect();

    const summary = await broker.getAccountSummary();
    if (summary.netLiquidation <= 0) {
      log.warn("Account summary returned 0 NAV, skipping snapshot");
      return;
    }

    await db.insert(accountSnapshots).values({
      netLiquidation: summary.netLiquidation,
      totalCash: summary.totalCash,
      buyingPower: summary.buyingPower,
      grossPositionValue: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
    });

    const positions = await broker.getPositions();
    for (const p of positions) {
      await db.insert(positionSnapshots).values({
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avgCost,
        marketPrice: p.marketPrice,
        marketValue: p.marketValue,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: 0,
      });
    }

    log.info({ positions: positions.length }, "Captured account + positions");
  } catch (e) {
    log.error({ err: e }, "Snapshot capture failed");
  } finally {
    broker.disconnect();
  }
}
