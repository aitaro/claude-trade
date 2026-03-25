/**
 * IB Gateway クライアントラッパー（読み取り専用）
 *
 * Research Agent はマーケットデータとポジション取得のみ。
 * 発注は Trading Engine (Stage 2) が担当する。
 */

import {
  IBApi,
  EventName,
  Contract,
  SecType,
  BarSizeSetting,
} from "@stoqey/ib";
import type { TickType } from "@stoqey/ib";
import { loadEnv } from "../config.js";

export interface Quote {
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface BarData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface AccountValue {
  tag: string;
  value: string;
  currency: string;
}

// TickType numeric values (enum not exported as value from @stoqey/ib)
const TICK_LAST = 4;
const TICK_BID = 1;
const TICK_ASK = 2;
const TICK_HIGH = 6;
const TICK_LOW = 7;
const TICK_VOLUME = 8;
const TICK_CLOSE = 9;

let nextReqId = 1000;
function getNextReqId(): number {
  return nextReqId++;
}

export class IBClient {
  private ib: IBApi;
  private connected = false;

  constructor(clientIdOverride?: number) {
    const env = loadEnv();
    this.ib = new IBApi({
      host: env.IB_HOST,
      port: env.IB_PORT,
      clientId: clientIdOverride ?? env.IB_CLIENT_ID,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("IB connection timeout")),
        10000,
      );

      this.ib.once(EventName.connected, () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.ib.once(EventName.error, (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ib.connect();
    });
  }

  disconnect(): void {
    if (this.connected) {
      this.ib.disconnect();
      this.connected = false;
    }
  }

  async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    await this.connect();
    try {
      return await fn();
    } finally {
      this.disconnect();
    }
  }

  get api(): IBApi {
    return this.ib;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async getQuote(
    symbol: string,
    exchange = "SMART",
    currency = "USD",
  ): Promise<Quote> {
    const reqId = getNextReqId();
    const contract: Contract = {
      symbol,
      secType: SecType.STK,
      exchange,
      currency,
    };

    return new Promise<Quote>((resolve) => {
      const quote: Quote = {
        symbol,
        last: null,
        bid: null,
        ask: null,
        high: null,
        low: null,
        close: null,
        volume: null,
      };

      const priceHandler = (
        tickerId: number,
        tickType: TickType,
        value: number,
      ) => {
        if (tickerId !== reqId) return;
        if (isNaN(value) || value <= 0 || value > 1e10) return;

        const tt = tickType as number;
        if (tt === TICK_LAST) quote.last = value;
        else if (tt === TICK_BID) quote.bid = value;
        else if (tt === TICK_ASK) quote.ask = value;
        else if (tt === TICK_HIGH) quote.high = value;
        else if (tt === TICK_LOW) quote.low = value;
        else if (tt === TICK_CLOSE) quote.close = value;
      };

      const sizeHandler = (
        tickerId: number,
        tickType?: TickType,
        value?: number,
      ) => {
        if (tickerId !== reqId) return;
        if (value == null || isNaN(value)) return;
        const tt = tickType as unknown as number;
        if (tt === TICK_VOLUME) quote.volume = Math.floor(value);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.tickPrice, priceHandler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.tickSize, sizeHandler);
      this.ib.reqMktData(reqId, contract, "", true, false);

      setTimeout(() => {
        this.ib.cancelMktData(reqId);
        this.ib.removeListener(EventName.tickPrice, priceHandler);
        this.ib.removeListener(EventName.tickSize, sizeHandler);
        resolve(quote);
      }, 2000);
    });
  }

  async getPositions(): Promise<PortfolioPosition[]> {
    return new Promise<PortfolioPosition[]>((resolve) => {
      const positions: PortfolioPosition[] = [];

      const handler = (
        account: string,
        contract: Contract,
        pos: number,
        avgCost?: number,
      ) => {
        if (contract.symbol) {
          positions.push({
            symbol: contract.symbol,
            quantity: pos,
            avgCost: avgCost ?? 0,
            marketPrice: 0,
            marketValue: 0,
            unrealizedPnl: 0,
            realizedPnl: 0,
          });
        }
      };

      const endHandler = () => {
        this.ib.removeListener(EventName.position, handler);
        this.ib.removeListener(EventName.positionEnd, endHandler);
        resolve(positions);
      };

      this.ib.on(EventName.position, handler);
      this.ib.on(EventName.positionEnd, endHandler);
      this.ib.reqPositions();

      setTimeout(() => {
        this.ib.removeListener(EventName.position, handler);
        this.ib.removeListener(EventName.positionEnd, endHandler);
        this.ib.cancelPositions();
        resolve(positions);
      }, 5000);
    });
  }

  async getAccountSummary(): Promise<AccountValue[]> {
    const reqId = getNextReqId();
    const tags =
      "NetLiquidation,TotalCashValue,BuyingPower,GrossPositionValue,UnrealizedPnL,RealizedPnL";

    return new Promise<AccountValue[]>((resolve) => {
      const values: AccountValue[] = [];

      const handler = (
        _reqId: number,
        _account: string,
        tag: string,
        value: string,
        currency: string,
      ) => {
        if (_reqId !== reqId) return;
        values.push({ tag, value, currency });
      };

      const endHandler = (_reqId: number) => {
        if (_reqId !== reqId) return;
        this.ib.removeListener(EventName.accountSummary, handler);
        this.ib.removeListener(EventName.accountSummaryEnd, endHandler);
        this.ib.cancelAccountSummary(reqId);
        resolve(values);
      };

      this.ib.on(EventName.accountSummary, handler);
      this.ib.on(EventName.accountSummaryEnd, endHandler);
      this.ib.reqAccountSummary(reqId, "All", tags);

      setTimeout(() => {
        this.ib.removeListener(EventName.accountSummary, handler);
        this.ib.removeListener(EventName.accountSummaryEnd, endHandler);
        this.ib.cancelAccountSummary(reqId);
        resolve(values);
      }, 5000);
    });
  }

  async getHistoricalData(
    symbol: string,
    duration = "30 D",
    barSize = "1 day",
    exchange = "SMART",
    currency = "USD",
  ): Promise<BarData[]> {
    const reqId = getNextReqId();
    const contract: Contract = {
      symbol,
      secType: SecType.STK,
      exchange,
      currency,
    };

    return new Promise<BarData[]>((resolve) => {
      const bars: BarData[] = [];
      let resolved = false;

      const handler = (
        _reqId: number,
        time: string,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number,
      ) => {
        if (_reqId !== reqId) return;
        // @stoqey/ib sends a final bar with empty time string as end marker
        if (!time || time.startsWith("finished")) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(bars);
          }
          return;
        }
        bars.push({ date: time, open, high, low, close, volume });
      };

      const cleanup = () => {
        this.ib.removeListener(EventName.historicalData, handler);
      };

      this.ib.on(EventName.historicalData, handler);
      this.ib.reqHistoricalData(
        reqId,
        contract,
        "", // endDateTime
        duration,
        barSize as BarSizeSetting,
        "TRADES" as unknown as never, // WhatToShow not exported, cast through
        1, // useRTH
        1, // formatDate
        false, // keepUpToDate
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(bars);
        }
      }, 30000);
    });
  }
}

// Singleton for MCP server (read-only, clientId=1)
export const ibClient = new IBClient();
