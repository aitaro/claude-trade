/** Agent Runner エントリーポイント */

import { parseArgs } from "node:util";
import { createLogger } from "../lib/logger.js";
import { runResearch } from "./runner.js";
import { setRunNow, startScheduler } from "./scheduler.js";

const log = createLogger("agent");

const { positionals, values } = parseArgs({
  options: {
    market: { type: "string", default: "us", short: "m" },
    "run-now": { type: "string" },
  },
  allowPositionals: true,
});

const command = positionals[0];

if (command === "run") {
  const mode = positionals[1] ?? "intraday";
  const market = values.market ?? "us";

  if (!["premarket", "intraday", "eod"].includes(mode)) {
    log.error({ mode }, "Unknown mode. Use: premarket, intraday, eod");
    process.exit(1);
  }

  runResearch(mode, market)
    .then((result) => {
      log.info({ sessionId: result.sessionId, cost: result.totalCostUsd }, "Research complete");
      process.exit(0);
    })
    .catch((e) => {
      log.error({ err: e }, "Research agent failed");
      process.exit(1);
    });
} else if (command === "scheduler") {
  const runNowArg = values["run-now"];
  if (runNowArg) {
    const parts = runNowArg.split("/");
    if (parts.length !== 2) {
      log.error("--run-now format: MARKET/MODE (e.g., us/intraday)");
      process.exit(1);
    }
    setRunNow(parts[0], parts[1]);
  }

  log.info("Starting agent scheduler...");
  startScheduler();
} else {
  log.error("Usage:");
  log.error("  npx tsx src/agent/main.ts run [premarket|intraday|eod] --market [us|jp|eu|uk]");
  log.error("  npx tsx src/agent/main.ts scheduler [--run-now MARKET/MODE]");
  process.exit(1);
}
