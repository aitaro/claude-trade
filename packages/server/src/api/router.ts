import { router } from "./trpc.js";
import { signalsRouter } from "./routers/signals.js";
import { ordersRouter } from "./routers/orders.js";
import { researchRouter } from "./routers/research.js";
import { performanceRouter } from "./routers/performance.js";
import { lessonsRouter } from "./routers/lessons.js";
import { sessionsRouter } from "./routers/sessions.js";

export const appRouter = router({
  signals: signalsRouter,
  orders: ordersRouter,
  research: researchRouter,
  performance: performanceRouter,
  lessons: lessonsRouter,
  sessions: sessionsRouter,
});

export type AppRouter = typeof appRouter;
