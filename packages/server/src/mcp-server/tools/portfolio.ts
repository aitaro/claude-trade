/** ポジション・口座照会ツール */

import { ibClient } from "../ib-client.js";

export async function getPositions(): Promise<Record<string, unknown>> {
  try {
    return await ibClient.withConnection(async () => {
      const positions = await ibClient.getPositions();
      return {
        positions: positions.map((p) => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avg_cost: p.avgCost,
          market_price: p.marketPrice,
          market_value: p.marketValue,
          unrealized_pnl: p.unrealizedPnl,
          realized_pnl: p.realizedPnl,
        })),
        count: positions.length,
      };
    });
  } catch (e) {
    return { error: String(e) };
  }
}

export async function getAccountSummary(): Promise<Record<string, unknown>> {
  try {
    return await ibClient.withConnection(async () => {
      const summary = await ibClient.getAccountSummary();
      const result: Record<string, number> = {};
      const tags = [
        "NetLiquidation",
        "TotalCashValue",
        "BuyingPower",
        "GrossPositionValue",
        "UnrealizedPnL",
        "RealizedPnL",
      ];
      for (const item of summary) {
        if (tags.includes(item.tag)) {
          result[item.tag] = parseFloat(item.value);
        }
      }
      return result;
    });
  } catch (e) {
    return { error: String(e) };
  }
}
