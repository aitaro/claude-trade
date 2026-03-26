/** スケジューラ用: IB からスナップショットを取得して DB に保存 */

import { db } from "../db/client.js";
import { accountSnapshots, positionSnapshots } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import { IBClient } from "../mcp-server/ib-client.js";

const log = createLogger("snapshot");

export async function captureSnapshots(): Promise<void> {
  const ib = new IBClient();

  try {
    await ib.connect();

    // Account snapshot
    const summary = await ib.getAccountSummary();
    const getValue = (tag: string): number => {
      const item = summary.find((s) => s.tag === tag);
      return item ? Number.parseFloat(item.value) : 0;
    };

    const netLiquidation = getValue("NetLiquidation");
    if (netLiquidation <= 0) {
      log.warn("Account summary returned 0 NAV, skipping snapshot");
      return;
    }

    await db.insert(accountSnapshots).values({
      netLiquidation,
      totalCash: getValue("TotalCashValue"),
      buyingPower: getValue("BuyingPower"),
      grossPositionValue: getValue("GrossPositionValue"),
      unrealizedPnl: getValue("UnrealizedPnL"),
      realizedPnl: getValue("RealizedPnL"),
    });

    // Position snapshots
    const positions = await ib.getPositions();
    for (const p of positions) {
      await db.insert(positionSnapshots).values({
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.avgCost,
        marketPrice: p.marketPrice,
        marketValue: p.marketValue,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl,
      });
    }

    log.info({ positions: positions.length }, "Captured account + positions");
  } catch (e) {
    log.error({ err: e }, "Snapshot capture failed");
  } finally {
    ib.disconnect();
  }
}
