import { lessonsRouter } from "./routers/lessons.js";
import { marketsRouter } from "./routers/markets.js";
import { ordersRouter } from "./routers/orders.js";
import { performanceRouter } from "./routers/performance.js";
import { researchRouter } from "./routers/research.js";
import { sessionsRouter } from "./routers/sessions.js";
import { signalsRouter } from "./routers/signals.js";
import { router } from "./trpc.js";

export const appRouter = router({
  signals: signalsRouter,
  orders: ordersRouter,
  research: researchRouter,
  performance: performanceRouter,
  lessons: lessonsRouter,
  sessions: sessionsRouter,
  markets: marketsRouter,
});

export type AppRouter = typeof appRouter;
