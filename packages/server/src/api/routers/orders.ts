import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { decisions, orders } from "../../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

export const ordersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.string().nullable().default(null),
        symbol: z.string().nullable().default(null),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.status) conditions.push(eq(orders.status, input.status));
      if (input.symbol) conditions.push(eq(orders.symbol, input.symbol.toUpperCase()));

      return db
        .select()
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(orders.createdAt))
        .limit(input.limit);
    }),

  decisions: publicProcedure
    .input(
      z.object({
        symbol: z.string().nullable().default(null),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.symbol) conditions.push(eq(decisions.symbol, input.symbol.toUpperCase()));

      return db
        .select()
        .from(decisions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(decisions.createdAt))
        .limit(input.limit);
    }),

  stats: publicProcedure.query(async () => {
    const all = await db.select().from(orders);
    const byStatus: Record<string, number> = {};
    for (const o of all) {
      const s = o.status ?? "unknown";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return {
      total: all.length,
      byStatus,
    };
  }),
});
