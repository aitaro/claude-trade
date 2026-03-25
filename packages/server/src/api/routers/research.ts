import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../../db/client.js";
import { researchReports } from "../../db/schema.js";

export const researchRouter = router({
  list: publicProcedure
    .input(
      z.object({
        reportType: z.string().nullable().default(null),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ input }) => {
      let query = db
        .select({
          id: researchReports.id,
          reportType: researchReports.reportType,
          title: researchReports.title,
          symbolsAnalyzed: researchReports.symbolsAnalyzed,
          keyFindings: researchReports.keyFindings,
          sessionId: researchReports.sessionId,
          createdAt: researchReports.createdAt,
        })
        .from(researchReports)
        .orderBy(desc(researchReports.createdAt))
        .limit(input.limit);

      if (input.reportType) {
        query = query.where(
          eq(researchReports.reportType, input.reportType),
        ) as typeof query;
      }

      return query;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [report] = await db
        .select()
        .from(researchReports)
        .where(eq(researchReports.id, input.id));
      return report ?? null;
    }),
});
