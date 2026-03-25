/** 市場データ取得ツール */

import { ibClient } from "../ib-client.js";

export async function getQuote(
  symbol: string,
  exchange = "SMART",
  currency = "USD",
): Promise<Record<string, unknown>> {
  try {
    return await ibClient.withConnection(async () => {
      const quote = await ibClient.getQuote(symbol, exchange, currency);
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
    });
  } catch (e) {
    return { error: String(e), symbol };
  }
}

export async function getHistoricalData(
  symbol: string,
  duration = "30 D",
  barSize = "1 day",
  exchange = "SMART",
  currency = "USD",
): Promise<Record<string, unknown>> {
  try {
    return await ibClient.withConnection(async () => {
      const bars = await ibClient.getHistoricalData(
        symbol,
        duration,
        barSize,
        exchange,
        currency,
      );
      return { symbol, bars, count: bars.length };
    });
  } catch (e) {
    return { error: String(e), symbol };
  }
}

export async function getMarketSnapshot(
  symbols: string[],
  exchange = "SMART",
  currency = "USD",
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  try {
    await ibClient.withConnection(async () => {
      for (const symbol of symbols) {
        const quote = await ibClient.getQuote(symbol, exchange, currency);
        results[symbol] = {
          last: quote.last,
          bid: quote.bid,
          ask: quote.ask,
          volume: quote.volume,
        };
      }
    });
    return results;
  } catch (e) {
    return { error: String(e), partial_results: results };
  }
}
