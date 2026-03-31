import { and, asc, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { accountSnapshots, dailyPerformance, positionSnapshots } from "../../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

export const performanceRouter = router({
  daily: publicProcedure
    .input(
      z.object({
        startDate: z.string().nullable().default(null),
        endDate: z.string().nullable().default(null),
        limit: z.number().default(90),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.startDate) conditions.push(gte(dailyPerformance.date, input.startDate));
      if (input.endDate) conditions.push(lte(dailyPerformance.date, input.endDate));

      return db
        .select()
        .from(dailyPerformance)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(dailyPerformance.date))
        .limit(input.limit);
    }),

  summary: publicProcedure.query(async () => {
    const rows = await db.select().from(dailyPerformance).orderBy(asc(dailyPerformance.date));

    if (rows.length === 0) {
      return {
        totalPnl: 0,
        totalTrades: 0,
        winRate: 0,
        tradingDays: 0,
        avgDailyReturn: 0,
        maxDrawdown: 0,
      };
    }

    const totalPnl = rows.reduce((s, d) => s + d.pnl, 0);
    const totalTrades = rows.reduce((s, d) => s + (d.tradesCount ?? 0), 0);
    const totalWinners = rows.reduce((s, d) => s + (d.winners ?? 0), 0);
    const pnlPcts = rows.map((d) => d.pnlPct);
    const avgDailyReturn = pnlPcts.reduce((a, b) => a + b, 0) / pnlPcts.length;
    const maxDrawdown = Math.max(...rows.map((d) => d.maxDrawdownPct ?? 0));

    return {
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalTrades,
      winRate: totalTrades > 0 ? Math.round((totalWinners / totalTrades) * 10000) / 10000 : 0,
      tradingDays: rows.length,
      avgDailyReturn: Math.round(avgDailyReturn * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    };
  }),

  latestSnapshot: publicProcedure.query(async () => {
    const [account] = await db
      .select()
      .from(accountSnapshots)
      .orderBy(desc(accountSnapshots.capturedAt))
      .limit(1);

    const positions = await db
      .select()
      .from(positionSnapshots)
      .orderBy(desc(positionSnapshots.capturedAt))
      .limit(20);

    // Deduplicate positions by symbol (keep latest)
    const seen = new Set<string>();
    const latestPositions = positions.filter((p) => {
      if (seen.has(p.symbol)) return false;
      seen.add(p.symbol);
      return true;
    });

    return {
      account: account ?? null,
      positions: latestPositions,
    };
  }),
});
