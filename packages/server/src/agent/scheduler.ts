/** スケジューラ: 全マーケットのジョブを1プロセスで管理する */

import cron from "node-cron";
import { execFileSync } from "child_process";
import { resolve } from "path";
import { PROJECT_ROOT, loadEnv } from "../config.js";
import { isMarketOpen, isTradingDay } from "./market.js";
import { MARKETS } from "./markets.js";
import { runResearch } from "./runner.js";

const env = loadEnv();

function runTradingEngine(marketIds: string[]): void {
  const openMarkets = marketIds.filter((m) => isMarketOpen(m));
  if (openMarkets.length === 0) {
    console.log("[trading] No open markets. Skipping.");
    return;
  }

  const marketsStr = openMarkets.join(",");
  console.log(`[trading] Starting trading engine for: ${marketsStr.toUpperCase()}`);

  try {
    const result = execFileSync("npx", [
      "tsx",
      resolve(PROJECT_ROOT, "packages/server/src/trading-engine/main.ts"),
      "--market",
      marketsStr,
    ], {
      cwd: PROJECT_ROOT,
      timeout: 300000,
      encoding: "utf-8",
    });
    console.log(`[trading] Completed:\n${result.slice(-500)}`);
  } catch (e) {
    console.error(`[trading] Failed:`, e);
  }
}

async function runResearchJob(mode: string, marketId: string): Promise<void> {
  if (mode === "premarket" && !isTradingDay(marketId)) {
    console.log(`[${marketId.toUpperCase()}/${mode}] Not a trading day. Skipping.`);
    return;
  }

  if (mode === "intraday" && !isMarketOpen(marketId)) {
    console.log(`[${marketId.toUpperCase()}/${mode}] Market is closed. Skipping.`);
    return;
  }

  console.log(`[${marketId.toUpperCase()}/${mode}] Starting research job`);
  try {
    const result = await runResearch(mode, marketId);
    console.log(
      `[${marketId.toUpperCase()}/${mode}] Completed. session=${result.sessionId} cost=$${result.totalCostUsd}`,
    );
  } catch (e) {
    console.error(`[${marketId.toUpperCase()}/${mode}] Research job failed:`, e);
  }
}

async function runResearchThenTrade(
  mode: string,
  marketId: string,
): Promise<void> {
  await runResearchJob(mode, marketId);
  const enabled = env.ENABLED_MARKETS.split(",").map((m) => m.trim());
  runTradingEngine(enabled);
}

// Convert market local time cron to UTC-based cron for node-cron
// node-cron doesn't support timezone natively, so we compute UTC offsets
function toUtcCron(
  hour: number | string,
  minute: number,
  tz: string,
): string {
  // Approximate: get current offset for the timezone
  const now = new Date();
  const tzTime = new Date(
    now.toLocaleString("en-US", { timeZone: tz }),
  );
  const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetHours = Math.round(
    (utcTime.getTime() - tzTime.getTime()) / 3600000,
  );

  if (typeof hour === "string" && hour.includes("-")) {
    // Range like "9-15"
    const [start, end] = hour.split("-").map(Number);
    const utcStart = (start + offsetHours + 24) % 24;
    const utcEnd = (end + offsetHours + 24) % 24;
    return `${minute} ${utcStart}-${utcEnd} * * 1-5`;
  }

  const utcHour = (Number(hour) + offsetHours + 24) % 24;
  return `${minute} ${utcHour} * * 1-5`;
}

let runNow: { marketId: string; mode: string } | null = null;

export function setRunNow(marketId: string, mode: string): void {
  runNow = { marketId, mode };
}

export function startScheduler(): void {
  const enabled = env.ENABLED_MARKETS.split(",").map((m) => m.trim());
  const jobs: Array<{ name: string; schedule: string }> = [];

  for (const marketId of enabled) {
    const mkt = MARKETS[marketId];
    if (!mkt) {
      console.warn(`Unknown market: ${marketId}. Skipping.`);
      continue;
    }

    // Premarket
    const premarketCron = toUtcCron(
      mkt.premarketHour,
      mkt.premarketMinute,
      mkt.timezone,
    );
    cron.schedule(premarketCron, () => {
      runResearchJob("premarket", marketId);
    });
    jobs.push({ name: `Premarket Research (${mkt.name})`, schedule: premarketCron });

    // Intraday + Trading (every 10 min during market hours)
    const intradayStart = mkt.openHour;
    const intradayEnd = mkt.closeHour - 1;
    for (const minute of [5, 15, 25, 35, 45, 55]) {
      const intradayCron = toUtcCron(
        `${intradayStart}-${intradayEnd}`,
        minute,
        mkt.timezone,
      );
      cron.schedule(intradayCron, () => {
        runResearchThenTrade("intraday", marketId);
      });
      jobs.push({
        name: `Intraday Research + Trading (${mkt.name})`,
        schedule: intradayCron,
      });
    }

    // EOD Review
    const eodCron = toUtcCron(mkt.eodHour, mkt.eodMinute, mkt.timezone);
    cron.schedule(eodCron, () => {
      runResearchJob("eod", marketId);
    });
    jobs.push({ name: `EOD Review (${mkt.name})`, schedule: eodCron });
  }

  console.log(`Scheduler started with ${jobs.length} jobs:`);
  for (const job of jobs) {
    console.log(`  - ${job.name}: ${job.schedule}`);
  }

  // --run-now
  if (runNow) {
    const { marketId, mode } = runNow;
    console.log(`Immediate execution: ${marketId.toUpperCase()}/${mode}`);
    if (mode === "intraday") {
      runResearchThenTrade(mode, marketId).then(() => {
        console.log("Immediate execution done. Continuing with scheduler...");
      });
    } else {
      runResearchJob(mode, marketId).then(() => {
        console.log("Immediate execution done. Continuing with scheduler...");
      });
    }
  }
}
