/** ポジション・口座照会ツール */

import { getBroker } from "../../broker/index.js";

export async function getPositions(): Promise<Record<string, unknown>> {
  try {
    const broker = getBroker();
    const positions = await broker.getPositions();
    return {
      positions: positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        avg_cost: p.avgCost,
        market_price: p.marketPrice,
        market_value: p.marketValue,
        unrealized_pnl: p.unrealizedPnl,
      })),
      count: positions.length,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getAccountSummary(): Promise<Record<string, unknown>> {
  try {
    const broker = getBroker();
    const summary = await broker.getAccountSummary();
    return {
      NetLiquidation: summary.netLiquidation,
      TotalCashValue: summary.totalCash,
      BuyingPower: summary.buyingPower,
    };
  } catch (e) {
    return { error: String(e) };
  }
}
