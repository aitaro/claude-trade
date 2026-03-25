import { z } from "zod";
import { desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../../db/client.js";
import { sessionLogs } from "../../db/schema.js";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().default(30),
      }),
    )
    .query(async ({ input }) => {
      return db
        .select()
        .from(sessionLogs)
        .orderBy(desc(sessionLogs.startedAt))
        .limit(input.limit);
    }),
});
