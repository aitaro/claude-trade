/** スケジューラ: 全マーケットのジョブを1プロセスで管理する */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import cron from "node-cron";
import { PROJECT_ROOT, loadEnv } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { isMarketOpen, isTradingDay } from "./market.js";
import { MARKETS } from "./markets.js";
import { runResearch } from "./runner.js";
import { captureSnapshots } from "./snapshots.js";

const env = loadEnv();
const log = createLogger("scheduler");

// IB Gateway は同時に1つの API 接続しか安定して扱えない。
// 複数市場の Research が同時に MCP 経由で IB に接続すると
// セッション競合で Gateway が落ちる。直列実行で排他制御する。
let researchLock = false;
const researchQueue: Array<() => Promise<void>> = [];

async function enqueueResearch(fn: () => Promise<void>): Promise<void> {
  if (researchLock) {
    log.info("Research already running. Queuing...");
    return new Promise<void>((resolve) => {
      researchQueue.push(async () => {
        await fn();
        resolve();
      });
    });
  }

  researchLock = true;
  try {
    await fn();
  } finally {
    researchLock = false;
    const next = researchQueue.shift();
    if (next) {
      enqueueResearch(next);
    }
  }
}

function runTradingEngine(marketIds: string[]): void {
  const openMarkets = marketIds.filter((m) => isMarketOpen(m));
  if (openMarkets.length === 0) {
    log.info("No open markets. Skipping trading engine.");
    return;
  }

  const marketsStr = openMarkets.join(",");
  log.info({ markets: marketsStr }, "Starting trading engine");

  try {
    const result = execFileSync(
      "npx",
      [
        "tsx",
        resolve(PROJECT_ROOT, "packages/server/src/trading-engine/main.ts"),
        "--market",
        marketsStr,
      ],
      {
        cwd: PROJECT_ROOT,
        timeout: 300000,
        encoding: "utf-8",
      },
    );
    log.info({ output: result.slice(-500) }, "Trading engine completed");
  } catch (e) {
    log.error({ err: e }, "Trading engine failed");
  }
}

async function runResearchJob(mode: string, marketId: string): Promise<void> {
  const jobLog = createLogger("scheduler", marketId.toUpperCase(), mode);

  if (mode === "premarket" && !isTradingDay(marketId)) {
    jobLog.info("Not a trading day. Skipping.");
    return;
  }

  if (mode === "intraday" && !isMarketOpen(marketId)) {
    jobLog.info("Market is closed. Skipping.");
    return;
  }

  jobLog.info("Starting research job");
  try {
    const result = await runResearch(mode, marketId);
    jobLog.info(
      { sessionId: result.sessionId, cost: result.totalCostUsd },
      "Research job completed",
    );
  } catch (e) {
    jobLog.error({ err: e }, "Research job failed");
  }
}

async function runResearchThenTrade(mode: string, marketId: string): Promise<void> {
  await enqueueResearch(async () => {
    // スナップショットを先に取得 (ポートフォリオ可視化用)
    await captureSnapshots();

    await runResearchJob(mode, marketId);
    const enabled = env.ENABLED_MARKETS.split(",").map((m) => m.trim());
    runTradingEngine(enabled);
  });
}

// Convert market local time cron to UTC-based cron for node-cron
// node-cron doesn't support timezone natively, so we compute UTC offsets
function toUtcCron(hour: number | string, minute: number, tz: string): string {
  // Approximate: get current offset for the timezone
  const now = new Date();
  const tzTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetHours = Math.round((utcTime.getTime() - tzTime.getTime()) / 3600000);

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
      log.warn({ marketId }, "Unknown market. Skipping.");
      continue;
    }

    // Premarket
    const premarketCron = toUtcCron(mkt.premarketHour, mkt.premarketMinute, mkt.timezone);
    cron.schedule(premarketCron, () => {
      runResearchJob("premarket", marketId);
    });
    jobs.push({ name: `Premarket Research (${mkt.name})`, schedule: premarketCron });

    // Intraday + Trading (every 30 min during market hours)
    // closeMinute > 0 の場合、closeHour 台の closeMinute 前まで含める
    const intradayStart = mkt.openHour;
    const intradayEndFull = mkt.closeMinute > 0 ? mkt.closeHour : mkt.closeHour - 1;
    for (let h = intradayStart; h <= intradayEndFull; h++) {
      for (const minute of [5, 35]) {
        // closeHour 台では closeMinute より前のみ
        if (h === mkt.closeHour && minute >= mkt.closeMinute) continue;

        const intradayCron = toUtcCron(h, minute, mkt.timezone);
        cron.schedule(intradayCron, () => {
          runResearchThenTrade("intraday", marketId);
        });
        jobs.push({
          name: `Intraday Research + Trading (${mkt.name})`,
          schedule: intradayCron,
        });
      }
    }

    // EOD Review
    const eodCron = toUtcCron(mkt.eodHour, mkt.eodMinute, mkt.timezone);
    cron.schedule(eodCron, () => {
      runResearchJob("eod", marketId);
    });
    jobs.push({ name: `EOD Review (${mkt.name})`, schedule: eodCron });
  }

  log.info({ jobCount: jobs.length }, "Scheduler started");
  for (const job of jobs) {
    log.info({ job: job.name, cron: job.schedule }, "Registered job");
  }

  // --run-now
  if (runNow) {
    const { marketId, mode } = runNow;
    log.info({ market: marketId.toUpperCase(), mode }, "Immediate execution");
    if (mode === "intraday") {
      runResearchThenTrade(mode, marketId).then(() => {
        log.info("Immediate execution done. Continuing with scheduler...");
      });
    } else {
      runResearchJob(mode, marketId).then(() => {
        log.info("Immediate execution done. Continuing with scheduler...");
      });
    }
  }
}
