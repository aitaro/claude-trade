import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { signals } from "../../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

export const signalsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(false),
        sourceStrategy: z.string().nullable().default(null),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.activeOnly) {
        conditions.push(eq(signals.isActive, true));
        conditions.push(gt(signals.expiresAt, new Date()));
      }
      if (input.sourceStrategy) {
        conditions.push(eq(signals.sourceStrategy, input.sourceStrategy));
      }

      return db
        .select()
        .from(signals)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(signals.createdAt))
        .limit(input.limit);
    }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const [signal] = await db.select().from(signals).where(eq(signals.id, input.id));
    return signal ?? null;
  }),

  stats: publicProcedure.query(async () => {
    const now = new Date();
    const all = await db.select().from(signals).orderBy(desc(signals.createdAt));

    const active = all.filter((s) => s.isActive && s.expiresAt && s.expiresAt > now);

    const byType: Record<string, number> = {};
    for (const s of active) {
      byType[s.signalType] = (byType[s.signalType] ?? 0) + 1;
    }

    return {
      total: all.length,
      active: active.length,
      byType,
    };
  }),
});
