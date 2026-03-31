import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { lessons, signalOutcomes } from "../../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

export const lessonsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        lessonType: z.string().nullable().default(null),
        activeOnly: z.boolean().default(true),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.activeOnly) {
        conditions.push(eq(lessons.isActive, true));
        conditions.push(or(isNull(lessons.expiresAt), gt(lessons.expiresAt, new Date())));
      }
      if (input.lessonType) {
        conditions.push(eq(lessons.lessonType, input.lessonType));
      }

      return db
        .select()
        .from(lessons)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lessons.confidence), desc(lessons.observationCount))
        .limit(input.limit);
    }),

  signalAccuracy: publicProcedure
    .input(
      z.object({
        days: z.number().default(30),
      }),
    )
    .query(async ({ input }) => {
      const cutoff = new Date(Date.now() - input.days * 86400000);
      const rows = await db
        .select()
        .from(signalOutcomes)
        .where(gt(signalOutcomes.evaluatedAt, cutoff));

      if (rows.length === 0) return { total: 0, correct: 0, accuracy: 0, byType: {} };

      const total = rows.length;
      const correct = rows.filter((o) => o.directionCorrect).length;

      const byType: Record<string, { total: number; correct: number; accuracy: number }> = {};
      for (const o of rows) {
        const t = o.signalType;
        if (!byType[t]) byType[t] = { total: 0, correct: 0, accuracy: 0 };
        byType[t].total++;
        if (o.directionCorrect) byType[t].correct++;
      }
      for (const t of Object.keys(byType)) {
        byType[t].accuracy =
          byType[t].total > 0
            ? Math.round((byType[t].correct / byType[t].total) * 10000) / 10000
            : 0;
      }

      return {
        total,
        correct,
        accuracy: Math.round((correct / total) * 10000) / 10000,
        byType,
      };
    }),
});
