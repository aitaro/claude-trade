/** Agent Runner エントリーポイント */

import { parseArgs } from "util";
import { runResearch } from "./runner.js";
import { startScheduler, setRunNow } from "./scheduler.js";

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
    console.error(`Unknown mode: ${mode}. Use: premarket, intraday, eod`);
    process.exit(1);
  }

  runResearch(mode, market)
    .then((result) => {
      console.log(`Session: ${result.sessionId}`);
      if (result.totalCostUsd) {
        console.log(`Cost: $${result.totalCostUsd.toFixed(4)}`);
      }
      process.exit(0);
    })
    .catch((e) => {
      console.error("Research agent failed:", e);
      process.exit(1);
    });
} else if (command === "scheduler") {
  const runNowArg = values["run-now"];
  if (runNowArg) {
    const parts = runNowArg.split("/");
    if (parts.length !== 2) {
      console.error("--run-now format: MARKET/MODE (e.g., us/intraday)");
      process.exit(1);
    }
    setRunNow(parts[0], parts[1]);
  }

  console.log("Starting agent scheduler...");
  startScheduler();
} else {
  console.error("Usage:");
  console.error("  npx tsx src/agent/main.ts run [premarket|intraday|eod] --market [us|jp|eu|uk]");
  console.error("  npx tsx src/agent/main.ts scheduler [--run-now MARKET/MODE]");
  process.exit(1);
}
