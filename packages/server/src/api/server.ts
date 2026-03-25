import http from "http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "./router.js";

const handler = createHTTPHandler({
  router: appRouter,
});

const PORT = Number(process.env.API_PORT || "3100");

const server = http.createServer((req, res) => {
  // CORS
  cors({ origin: true })(req, res, () => {
    handler(req, res);
  });
});

server.listen(PORT, () => {
  console.log(`[API] tRPC server listening on http://localhost:${PORT}`);
});
