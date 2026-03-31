import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { sessionLogs } from "../../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().default(30),
      }),
    )
    .query(async ({ input }) => {
      return db.select().from(sessionLogs).orderBy(desc(sessionLogs.startedAt)).limit(input.limit);
    }),
});
