/** スナップショット取得・日次成績記録ツール */

import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  accountSnapshots,
  positionSnapshots,
  dailyPerformance,
  orders,
} from "../../db/schema.js";
import { ibClient } from "../ib-client.js";

export async function captureAccountSnapshot(): Promise<
  Record<string, unknown>
> {
  try {
    return await ibClient.withConnection(async () => {
      const summary = await ibClient.getAccountSummary();

      const getValue = (tag: string): number => {
        const item = summary.find((s) => s.tag === tag);
        return item ? parseFloat(item.value) : 0;
      };

      const [snapshot] = await db
        .insert(accountSnapshots)
        .values({
          netLiquidation: getValue("NetLiquidation"),
          totalCash: getValue("TotalCashValue"),
          buyingPower: getValue("BuyingPower"),
          grossPositionValue: getValue("GrossPositionValue"),
          unrealizedPnl: getValue("UnrealizedPnL"),
          realizedPnl: getValue("RealizedPnL"),
        })
        .returning();

      return {
        id: snapshot.id,
        net_liquidation: snapshot.netLiquidation,
        total_cash: snapshot.totalCash,
        buying_power: snapshot.buyingPower,
        gross_position_value: snapshot.grossPositionValue,
        unrealized_pnl: snapshot.unrealizedPnl,
        realized_pnl: snapshot.realizedPnl,
        captured_at: snapshot.capturedAt?.toISOString(),
      };
    });
  } catch (e) {
    return { error: String(e) };
  }
}

export async function capturePositionSnapshot(): Promise<
  Record<string, unknown>
> {
  try {
    return await ibClient.withConnection(async () => {
      const positions = await ibClient.getPositions();

      if (positions.length === 0) {
        return { positions: [], count: 0, message: "No open positions" };
      }

      const snapshots = [];
      for (const p of positions) {
        const [snapshot] = await db
          .insert(positionSnapshots)
          .values({
            symbol: p.symbol,
            quantity: p.quantity,
            avgCost: p.avgCost,
            marketPrice: p.marketPrice,
            marketValue: p.marketValue,
            unrealizedPnl: p.unrealizedPnl,
            realizedPnl: p.realizedPnl,
          })
          .returning();

        snapshots.push({
          symbol: snapshot.symbol,
          quantity: snapshot.quantity,
          avg_cost: snapshot.avgCost,
          market_value: snapshot.marketValue,
          unrealized_pnl: snapshot.unrealizedPnl,
        });
      }

      return { positions: snapshots, count: snapshots.length };
    });
  } catch (e) {
    return { error: String(e) };
  }
}

export async function recordDailyPerf(
  date: string,
  startingNav: number,
  endingNav: number,
): Promise<Record<string, unknown>> {
  const pnl = endingNav - startingNav;
  const pnlPct = startingNav > 0 ? (pnl / startingNav) * 100 : 0;

  // 当日の約定注文を集計
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const filledOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "filled"),
        gte(orders.createdAt, dayStart),
        lte(orders.createdAt, dayEnd),
      ),
    );

  // 簡易的な勝敗判定: BUY→SELL ペアで判定は複雑なので、
  // ここでは PnL > 0 なら winner とする
  const tradesCount = filledOrders.length;

  const [record] = await db
    .insert(dailyPerformance)
    .values({
      date,
      startingNav,
      endingNav,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 10000) / 10000,
      tradesCount,
      winners: pnl > 0 ? 1 : 0,
      losers: pnl < 0 ? 1 : 0,
      maxDrawdownPct: pnlPct < 0 ? Math.abs(pnlPct) : 0,
    })
    .returning();

  return {
    id: record.id,
    date: record.date,
    starting_nav: record.startingNav,
    ending_nav: record.endingNav,
    pnl: record.pnl,
    pnl_pct: record.pnlPct,
    trades_count: record.tradesCount,
  };
}

export async function getTodayStartingNav(): Promise<
  Record<string, unknown>
> {
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00`);
  const dayEnd = new Date(`${today}T23:59:59`);

  // 当日最初のスナップショットを取得
  const [snapshot] = await db
    .select()
    .from(accountSnapshots)
    .where(
      and(
        gte(accountSnapshots.capturedAt, dayStart),
        lte(accountSnapshots.capturedAt, dayEnd),
      ),
    )
    .orderBy(asc(accountSnapshots.capturedAt))
    .limit(1);

  if (snapshot) {
    return {
      date: today,
      starting_nav: snapshot.netLiquidation,
      captured_at: snapshot.capturedAt?.toISOString(),
      source: "account_snapshot",
    };
  }

  // スナップショットがなければ前日の最後のスナップショット
  const [lastSnapshot] = await db
    .select()
    .from(accountSnapshots)
    .where(lte(accountSnapshots.capturedAt, dayStart))
    .orderBy(desc(accountSnapshots.capturedAt))
    .limit(1);

  if (lastSnapshot) {
    return {
      date: today,
      starting_nav: lastSnapshot.netLiquidation,
      captured_at: lastSnapshot.capturedAt?.toISOString(),
      source: "previous_day_snapshot",
    };
  }

  // daily_performance の直近 ending_nav をフォールバック
  const [lastPerf] = await db
    .select()
    .from(dailyPerformance)
    .orderBy(desc(dailyPerformance.date))
    .limit(1);

  if (lastPerf) {
    return {
      date: today,
      starting_nav: lastPerf.endingNav,
      captured_at: null,
      source: "previous_daily_performance",
    };
  }

  return {
    date: today,
    starting_nav: null,
    captured_at: null,
    source: "none",
    message: "No historical NAV data found. Capture a snapshot first.",
  };
}
