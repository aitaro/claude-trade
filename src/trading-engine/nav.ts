/** 当日開始 NAV を DB から取得する */

import { gte, lte, asc, desc } from "drizzle-orm";
import { and } from "drizzle-orm";
import { db } from "../db/client.js";
import { accountSnapshots, dailyPerformance } from "../db/schema.js";

export async function getStartingNav(fallback: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${today}T00:00:00`);
  const dayEnd = new Date(`${today}T23:59:59`);

  // 当日最初のスナップショット
  const [todaySnapshot] = await db
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

  if (todaySnapshot) {
    return todaySnapshot.netLiquidation;
  }

  // 前日以前の最後のスナップショット
  const [prevSnapshot] = await db
    .select()
    .from(accountSnapshots)
    .where(lte(accountSnapshots.capturedAt, dayStart))
    .orderBy(desc(accountSnapshots.capturedAt))
    .limit(1);

  if (prevSnapshot) {
    return prevSnapshot.netLiquidation;
  }

  // daily_performance の直近 ending_nav
  const [lastPerf] = await db
    .select()
    .from(dailyPerformance)
    .orderBy(desc(dailyPerformance.date))
    .limit(1);

  if (lastPerf) {
    return lastPerf.endingNav;
  }

  // 何もなければ現在の NAV をフォールバック
  return fallback;
}
