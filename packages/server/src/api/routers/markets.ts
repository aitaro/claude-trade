import { router, publicProcedure } from "../trpc.js";
import { MARKETS, type MarketConfig } from "../../agent/markets.js";
import { isMarketOpen, isTradingDay } from "../../agent/market.js";

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function localNow(tz: string): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

export interface ScheduleJob {
  name: string;
  marketId: string;
  mode: string;
  localTime: string;
  localTzAbbr: string;
  timezone: string;
  nextRunUtc: string | null;
}

const TZ_ABBR: Record<string, string> = {
  "America/New_York": "ET",
  "Asia/Tokyo": "JST",
  "Europe/Paris": "CET",
  "Europe/London": "GMT",
};

function getNextRun(hour: number, minute: number, tz: string): Date | null {
  const now = localNow(tz);
  const today = new Date(now);
  today.setHours(hour, minute, 0, 0);

  if (today > now) {
    // Convert local time back to UTC
    const utcStr = new Date().toLocaleString("en-US", { timeZone: "UTC" });
    const utcNow = new Date(utcStr);
    const offset = now.getTime() - utcNow.getTime();
    return new Date(today.getTime() - offset);
  }
  return null; // Already passed today
}

function buildScheduleJobs(mkt: MarketConfig): ScheduleJob[] {
  const jobs: ScheduleJob[] = [];
  const abbr = TZ_ABBR[mkt.timezone] ?? mkt.timezone;

  // Premarket
  jobs.push({
    name: `Premarket Research`,
    marketId: mkt.marketId,
    mode: "premarket",
    localTime: hhmm(mkt.premarketHour, mkt.premarketMinute),
    localTzAbbr: abbr,
    timezone: mkt.timezone,
    nextRunUtc: getNextRun(mkt.premarketHour, mkt.premarketMinute, mkt.timezone)?.toISOString() ?? null,
  });

  // Intraday (every 30 min during market hours)
  const intradayStart = mkt.openHour;
  const intradayEnd = mkt.closeHour - 1;
  for (let h = intradayStart; h <= intradayEnd; h++) {
    for (const m of [5, 35]) {
      jobs.push({
        name: `Intraday + Trading`,
        marketId: mkt.marketId,
        mode: "intraday",
        localTime: hhmm(h, m),
        localTzAbbr: abbr,
        timezone: mkt.timezone,
        nextRunUtc: getNextRun(h, m, mkt.timezone)?.toISOString() ?? null,
      });
    }
  }

  // EOD Review
  jobs.push({
    name: `EOD Review`,
    marketId: mkt.marketId,
    mode: "eod",
    localTime: hhmm(mkt.eodHour, mkt.eodMinute),
    localTzAbbr: abbr,
    timezone: mkt.timezone,
    nextRunUtc: getNextRun(mkt.eodHour, mkt.eodMinute, mkt.timezone)?.toISOString() ?? null,
  });

  return jobs;
}

export const marketsRouter = router({
  status: publicProcedure.query(() => {
    return Object.values(MARKETS).map((mkt) => {
      const now = localNow(mkt.timezone);
      const open = isMarketOpen(mkt.marketId);
      const tradingDay = isTradingDay(mkt.marketId);

      return {
        marketId: mkt.marketId,
        name: mkt.name,
        timezone: mkt.timezone,
        currency: mkt.ibCurrency,
        isOpen: open,
        isTradingDay: tradingDay,
        openTime: hhmm(mkt.openHour, mkt.openMinute),
        closeTime: hhmm(mkt.closeHour, mkt.closeMinute),
        localTime: hhmm(now.getHours(), now.getMinutes()),
        breakTime:
          mkt.breakStartHour != null
            ? `${hhmm(mkt.breakStartHour, mkt.breakStartMinute!)}–${hhmm(mkt.breakEndHour!, mkt.breakEndMinute!)}`
            : null,
      };
    });
  }),

  schedule: publicProcedure.query(() => {
    const allJobs: ScheduleJob[] = [];
    for (const mkt of Object.values(MARKETS)) {
      allJobs.push(...buildScheduleJobs(mkt));
    }

    // 次回実行があるものだけフィルタして時間順にソート
    const upcoming = allJobs
      .filter((j) => j.nextRunUtc !== null)
      .sort((a, b) => a.nextRunUtc!.localeCompare(b.nextRunUtc!));

    return { upcoming, total: allJobs.length };
  }),
});
