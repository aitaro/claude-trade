/** マルチマーケット対応の市場開閉判定 */

import { MARKETS, type MarketConfig } from "./markets.js";

function nowInTz(mkt: MarketConfig): Date {
  // Get current time in target timezone
  const now = new Date();
  const tzStr = now.toLocaleString("en-US", { timeZone: mkt.timezone });
  return new Date(tzStr);
}

export function isMarketOpen(marketId = "us"): boolean {
  const mkt = MARKETS[marketId];
  if (!mkt) return false;

  const now = nowInTz(mkt);

  // Weekend check
  if (now.getDay() === 0 || now.getDay() === 6) return false;

  // Holiday check
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (mkt.holidays.has(dateStr)) return false;

  // Market hours check
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = mkt.openHour * 60 + mkt.openMinute;
  const closeMinutes = mkt.closeHour * 60 + mkt.closeMinute;

  if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
    return false;
  }

  // Lunch break check (TSE etc.)
  if (mkt.breakStartHour != null && mkt.breakStartMinute != null && mkt.breakEndHour != null && mkt.breakEndMinute != null) {
    const breakStart = mkt.breakStartHour * 60 + mkt.breakStartMinute;
    const breakEnd = mkt.breakEndHour * 60 + mkt.breakEndMinute;
    if (currentMinutes >= breakStart && currentMinutes <= breakEnd) {
      return false;
    }
  }

  return true;
}

export function isTradingDay(marketId = "us"): boolean {
  const mkt = MARKETS[marketId];
  if (!mkt) return false;

  const now = nowInTz(mkt);

  if (now.getDay() === 0 || now.getDay() === 6) return false;

  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return !mkt.holidays.has(dateStr);
}
