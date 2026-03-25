/** マルチマーケット定義 */

export interface MarketConfig {
  marketId: string;
  name: string;
  timezone: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  premarketHour: number;
  premarketMinute: number;
  eodHour: number;
  eodMinute: number;
  strategyFile: string;
  ibExchange: string;
  ibCurrency: string;
  holidays: Set<string>;
  breakStartHour?: number;
  breakStartMinute?: number;
  breakEndHour?: number;
  breakEndMinute?: number;
}

export const MARKETS: Record<string, MarketConfig> = {
  us: {
    marketId: "us",
    name: "US (NYSE/NASDAQ)",
    timezone: "America/New_York",
    openHour: 9, openMinute: 30,
    closeHour: 16, closeMinute: 0,
    premarketHour: 5, premarketMinute: 50,
    eodHour: 16, eodMinute: 15,
    strategyFile: "us.yaml",
    ibExchange: "SMART",
    ibCurrency: "USD",
    holidays: new Set([
      // 2026
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
      "2026-05-25", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
      // 2027
      "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26",
      "2027-05-31", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
    ]),
  },
  jp: {
    marketId: "jp",
    name: "Japan (TSE)",
    timezone: "Asia/Tokyo",
    openHour: 9, openMinute: 0,
    closeHour: 15, closeMinute: 0,
    premarketHour: 8, premarketMinute: 0,
    eodHour: 15, eodMinute: 15,
    strategyFile: "jp.yaml",
    ibExchange: "SMART",
    ibCurrency: "JPY",
    breakStartHour: 11, breakStartMinute: 30,
    breakEndHour: 12, breakEndMinute: 30,
    holidays: new Set([
      // 2026
      "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12",
      "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
      "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
      "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22",
      "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
      "2026-12-31",
    ]),
  },
  eu: {
    marketId: "eu",
    name: "Europe (Euronext/Xetra)",
    timezone: "Europe/Paris",
    openHour: 9, openMinute: 0,
    closeHour: 17, closeMinute: 30,
    premarketHour: 8, premarketMinute: 0,
    eodHour: 17, eodMinute: 45,
    strategyFile: "eu.yaml",
    ibExchange: "SMART",
    ibCurrency: "EUR",
    holidays: new Set([
      // 2026 (Euronext)
      "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01",
      "2026-12-25", "2026-12-26",
    ]),
  },
  uk: {
    marketId: "uk",
    name: "UK (LSE)",
    timezone: "Europe/London",
    openHour: 8, openMinute: 0,
    closeHour: 16, closeMinute: 30,
    premarketHour: 7, premarketMinute: 0,
    eodHour: 16, eodMinute: 45,
    strategyFile: "uk.yaml",
    ibExchange: "SMART",
    ibCurrency: "GBP",
    holidays: new Set([
      // 2026 (LSE)
      "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
      "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
    ]),
  },
};
