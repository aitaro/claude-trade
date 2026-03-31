/** IBKR 発注エグゼキューター — Paper Trading のみ */

import {
  type Contract,
  EventName,
  IBApi,
  type Order as IBOrder,
  type OrderAction,
  OrderType,
  SecType,
} from "@stoqey/ib";
import type { TickType } from "@stoqey/ib";
import type { OrderRequest } from "../broker/types.js";
import { loadEnv } from "../config.js";
import { db } from "../db/client.js";
import { type Order, orders } from "../db/schema.js";

// TickType numeric values
const TICK_BID = 1;
const TICK_ASK = 2;
const TICK_LAST = 4;
const TICK_CLOSE = 9;

let nextReqId = 2000;
function getNextReqId(): number {
  return nextReqId++;
}

export class Executor {
  private ib: IBApi;
  private connected = false;

  constructor() {
    const env = loadEnv();
    this.ib = new IBApi({
      host: env.IB_HOST,
      port: env.IB_PORT,
      clientId: 2, // different from MCP server
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("IB connection timeout")), 10000);

      this.ib.once(EventName.connected, () => {
        clearTimeout(timeout);
        this.connected = true;
        this.ib.reqMarketDataType(1); // live (falls back to delayed if unavailable)
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

  async executeOrder(orderReq: OrderRequest, decisionId: string): Promise<Order> {
    const contract: Contract = {
      symbol: orderReq.symbol,
      secType: SecType.STK,
      exchange: "SMART",
      currency: "USD",
    };

    const ibOrder: IBOrder = {
      action: orderReq.side as OrderAction,
      totalQuantity: orderReq.quantity,
      orderType: OrderType.MKT,
    };

    let dbOrder: Order;

    try {
      // Get next valid order ID
      const orderId = await new Promise<number>((resolve) => {
        this.ib.once(EventName.nextValidId, (id: number) => resolve(id));
        this.ib.reqIds();
      });
      ibOrder.orderId = orderId;

      this.ib.placeOrder(orderId, contract, ibOrder);

      // Wait for fill (up to 30 seconds)
      const fillResult = await new Promise<{
        status: string;
        fillPrice?: number;
        fillQty?: number;
        error?: string;
      }>((resolve) => {
        const timeout = setTimeout(() => resolve({ status: "submitted" }), 30000);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.ib as any).on(
          EventName.orderStatus,
          (
            id: number,
            status: string,
            filled: number,
            _remaining: number,
            avgFillPrice: number,
          ) => {
            if (id !== orderId) return;
            if (status === "Filled") {
              clearTimeout(timeout);
              resolve({
                status: "filled",
                fillPrice: avgFillPrice,
                fillQty: filled,
              });
            } else if (status === "Cancelled") {
              clearTimeout(timeout);
              resolve({ status: "cancelled", error: "Cancelled by IB" });
            }
          },
        );
      });

      [dbOrder] = await db
        .insert(orders)
        .values({
          decisionId,
          signalId: orderReq.signalId,
          symbol: orderReq.symbol,
          side: orderReq.side,
          quantity: orderReq.quantity,
          orderType: "MKT",
          status: fillResult.status,
          ibOrderId: orderId,
          fillPrice: fillResult.fillPrice ?? null,
          fillQuantity: fillResult.fillQty ?? null,
          filledAt: fillResult.status === "filled" ? new Date() : null,
          errorMessage: fillResult.error ?? null,
        })
        .returning();
    } catch (e) {
      [dbOrder] = await db
        .insert(orders)
        .values({
          decisionId,
          signalId: orderReq.signalId,
          symbol: orderReq.symbol,
          side: orderReq.side,
          quantity: orderReq.quantity,
          orderType: "MKT",
          status: "rejected",
          errorMessage: String(e),
        })
        .returning();
    }

    return dbOrder;
  }

  async getCurrentPositions(): Promise<Map<string, number>> {
    return new Promise<Map<string, number>>((resolve) => {
      const positions = new Map<string, number>();

      const handler = (_account: string, contract: Contract, pos: number) => {
        if (contract.symbol) {
          positions.set(contract.symbol, pos);
        }
      };

      const endHandler = () => {
        this.ib.removeListener(EventName.position, handler);
        this.ib.removeListener(EventName.positionEnd, endHandler);
        resolve(positions);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.position, handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.positionEnd, endHandler);
      this.ib.reqPositions();

      setTimeout(() => {
        this.ib.removeListener(EventName.position, handler);
        this.ib.removeListener(EventName.positionEnd, endHandler);
        this.ib.cancelPositions();
        resolve(positions);
      }, 5000);
    });
  }

  async getNav(): Promise<{ nav: number; currency: string }> {
    const reqId = getNextReqId();

    return new Promise<{ nav: number; currency: string }>((resolve) => {
      let result = { nav: 0, currency: "JPY" };

      const handler = (
        _reqId: number,
        _account: string,
        tag: string,
        value: string,
        currency: string,
      ) => {
        if (_reqId !== reqId) return;
        if (tag === "NetLiquidation" && currency !== "BASE" && currency !== "") {
          result = { nav: Number.parseFloat(value), currency };
        }
      };

      const endHandler = (_reqId: number) => {
        if (_reqId !== reqId) return;
        this.ib.removeListener(EventName.accountSummary, handler);
        this.ib.removeListener(EventName.accountSummaryEnd, endHandler);
        this.ib.cancelAccountSummary(reqId);
        resolve(result);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.accountSummary, handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.accountSummaryEnd, endHandler);
      this.ib.reqAccountSummary(reqId, "All", "NetLiquidation");

      setTimeout(() => {
        this.ib.removeListener(EventName.accountSummary, handler);
        this.ib.removeListener(EventName.accountSummaryEnd, endHandler);
        this.ib.cancelAccountSummary(reqId);
        resolve(result);
      }, 5000);
    });
  }

  async getFxRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1.0;

    const rate = await this._fetchFxRate(fromCurrency, toCurrency);
    if (rate > 0) return rate;

    // Fallback: reverse pair
    const reverseRate = await this._fetchFxRate(toCurrency, fromCurrency);
    if (reverseRate > 0) return 1.0 / reverseRate;

    return 0;
  }

  private async _fetchFxRate(symbol: string, currency: string): Promise<number> {
    const reqId = getNextReqId();
    const contract: Contract = {
      secType: "CASH" as SecType,
      symbol,
      currency,
      exchange: "IDEALPRO",
    };

    return new Promise<number>((resolve) => {
      let bid = 0;
      let ask = 0;
      let last = 0;

      const handler = (tickerId: number, tickType: TickType, value: number) => {
        if (tickerId !== reqId) return;
        if (isNaN(value) || value <= 0) return;
        const tt = tickType as unknown as number;
        if (tt === TICK_BID) bid = value;
        else if (tt === TICK_ASK) ask = value;
        else if (tt === TICK_LAST) last = value;
        else if (tt === TICK_CLOSE && last === 0) last = value;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ib as any).on(EventName.tickPrice, handler);
      try {
        this.ib.reqMktData(reqId, contract, "", true, false);
      } catch {
        resolve(0);
        return;
      }

      setTimeout(() => {
        this.ib.cancelMktData(reqId);
        this.ib.removeListener(EventName.tickPrice, handler);
        // FX: prefer last, then bid/ask midpoint
        if (last > 0) resolve(last);
        else if (bid > 0 && ask > 0) resolve((bid + ask) / 2);
        else if (bid > 0) resolve(bid);
        else if (ask > 0) resolve(ask);
        else resolve(0);
      }, 3000);
    });
  }

  async getCurrentPrices(
    symbols: string[],
    exchange = "SMART",
    currency = "USD",
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const symbol of symbols) {
      const reqId = getNextReqId();
      const contract: Contract = {
        symbol,
        secType: SecType.STK,
        exchange,
        currency,
      };

      const price = await new Promise<number>((resolve) => {
        let p = 0;

        const handler = (tickerId: number, tickType: TickType, value: number) => {
          if (tickerId !== reqId) return;
          if (isNaN(value) || value <= 0) return;
          const tt = tickType as unknown as number;
          if (tt === TICK_LAST) p = value;
          else if (tt === TICK_CLOSE && p === 0) p = value;
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.ib as any).on(EventName.tickPrice, handler);
        this.ib.reqMktData(reqId, contract, "", true, false);

        setTimeout(() => {
          this.ib.cancelMktData(reqId);
          this.ib.removeListener(EventName.tickPrice, handler);
          resolve(p);
        }, 3000);
      });

      if (price > 0) prices.set(symbol, price);
    }

    return prices;
  }
}
