/** 成績分析ツール */

import { eq, gte, lte, asc, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { dailyPerformance, orders } from "../../db/schema.js";

export async function queryPerformance(
  startDate: string | null = null,
  endDate: string | null = null,
): Promise<Record<string, unknown>> {
  const conditions = [];
  if (startDate) conditions.push(gte(dailyPerformance.date, startDate));
  if (endDate) conditions.push(lte(dailyPerformance.date, endDate));

  const rows = await db
    .select()
    .from(dailyPerformance)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(dailyPerformance.date));

  if (rows.length === 0) {
    return { message: "No performance data found", days: [] };
  }

  const totalPnl = rows.reduce((sum, d) => sum + d.pnl, 0);
  const totalTrades = rows.reduce((sum, d) => sum + (d.tradesCount ?? 0), 0);
  const totalWinners = rows.reduce((sum, d) => sum + (d.winners ?? 0), 0);
  const totalLosers = rows.reduce((sum, d) => sum + (d.losers ?? 0), 0);
  const winRate = totalTrades > 0 ? totalWinners / totalTrades : 0;
  const maxDd = Math.max(...rows.map((d) => d.maxDrawdownPct ?? 0));

  const pnlPcts = rows.map((d) => d.pnlPct);
  const avgDailyReturn =
    pnlPcts.length > 0
      ? pnlPcts.reduce((a, b) => a + b, 0) / pnlPcts.length
      : 0;

  let sharpe = 0;
  if (pnlPcts.length > 1) {
    const mean = avgDailyReturn;
    const variance =
      pnlPcts.reduce((sum, x) => sum + (x - mean) ** 2, 0) /
      (pnlPcts.length - 1);
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;
  }

  return {
    summary: {
      total_pnl: Math.round(totalPnl * 100) / 100,
      total_trades: totalTrades,
      win_rate: Math.round(winRate * 10000) / 10000,
      max_drawdown_pct: Math.round(maxDd * 10000) / 10000,
      avg_daily_return_pct: Math.round(avgDailyReturn * 10000) / 10000,
      sharpe_ratio: Math.round(sharpe * 100) / 100,
      trading_days: rows.length,
    },
    daily: rows.slice(-30).map((d) => ({
      date: d.date,
      pnl: d.pnl,
      pnl_pct: d.pnlPct,
      trades: d.tradesCount,
    })),
  };
}

export async function getTradeStats(
  symbol: string | null = null,
): Promise<Record<string, unknown>> {
  const conditions = [eq(orders.status, "filled")];
  if (symbol) conditions.push(eq(orders.symbol, symbol.toUpperCase()));

  const rows = await db
    .select()
    .from(orders)
    .where(and(...conditions));

  if (rows.length === 0) {
    return { message: "No filled orders found" };
  }

  const buys = rows.filter((o) => o.side === "BUY");
  const sells = rows.filter((o) => o.side === "SELL");

  return {
    total_orders: rows.length,
    buys: buys.length,
    sells: sells.length,
    symbols_traded: [...new Set(rows.map((o) => o.symbol))],
  };
}
