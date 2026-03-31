/** 市場データ取得ツール */

import { getBroker } from "../../broker/index.js";

export async function getQuote(symbol: string): Promise<Record<string, unknown>> {
  try {
    const broker = getBroker();
    const quote = await broker.getQuote(symbol);
    return {
      symbol: quote.symbol,
      last: quote.last,
      bid: quote.bid,
      ask: quote.ask,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
    };
  } catch (e) {
    return { error: String(e), symbol };
  }
}

export async function getHistoricalData(
  symbol: string,
  duration = "30 D",
  barSize = "1 day",
): Promise<Record<string, unknown>> {
  try {
    const broker = getBroker();
    const bars = await broker.getHistoricalData(symbol, duration, barSize);
    return { symbol, bars, count: bars.length };
  } catch (e) {
    return { error: String(e), symbol };
  }
}

export async function getMarketSnapshot(symbols: string[]): Promise<Record<string, unknown>> {
  try {
    const broker = getBroker();
    const quotes = await broker.getQuotes(symbols);
    const results: Record<string, unknown> = {};
    for (const [symbol, quote] of quotes) {
      results[symbol] = {
        last: quote.last,
        bid: quote.bid,
        ask: quote.ask,
        volume: quote.volume,
      };
    }
    return results;
  } catch (e) {
    return { error: String(e) };
  }
}
