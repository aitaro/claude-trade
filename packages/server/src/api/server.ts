import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { createLogger } from "../lib/logger.js";
import { appRouter } from "./router.js";

const log = createLogger("api");

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
  log.info({ port: PORT }, "tRPC server listening");
});
