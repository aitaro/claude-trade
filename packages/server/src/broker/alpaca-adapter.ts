/** Alpaca Markets ブローカーアダプター */

import type {
  AccountSummary,
  BarData,
  BrokerAdapter,
  OrderRequest,
  OrderResult,
  Position,
  Quote,
} from "./types.js";

interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper: boolean;
}

export class AlpacaAdapter implements BrokerAdapter {
  readonly name = "alpaca";
  private readonly tradingBase: string;
  private readonly dataBase = "https://data.alpaca.markets";
  private readonly headers: Record<string, string>;

  constructor(private config: AlpacaConfig) {
    this.tradingBase = config.paper
      ? "https://paper-api.alpaca.markets"
      : "https://api.alpaca.markets";
    this.headers = {
      "APCA-API-KEY-ID": config.apiKey,
      "APCA-API-SECRET-KEY": config.apiSecret,
      "Content-Type": "application/json",
    };
  }

  async connect(): Promise<void> {
    // Alpaca は REST API なので接続不要。認証チェックだけ行う
    const res = await this.tradingFetch("/v2/account");
    if (!res.ok) {
      throw new Error(`Alpaca auth failed: ${res.status} ${await res.text()}`);
    }
  }

  disconnect(): void {
    // no-op
  }

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const body = {
      symbol: req.symbol,
      qty: String(req.quantity),
      side: req.side.toLowerCase(),
      type: "market",
      time_in_force: "day",
    };

    const res = await this.tradingFetch("/v2/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        brokerOrderId: "",
        status: "rejected",
        fillPrice: undefined,
        fillQuantity: undefined,
      };
    }

    const order = (await res.json()) as { id: string };

    // 最大 30 秒待って fill を確認
    const filled = await this.waitForFill(order.id, 30_000);
    return filled;
  }

  async getPositions(): Promise<Position[]> {
    const res = await this.tradingFetch("/v2/positions");
    if (!res.ok) return [];

    const raw = (await res.json()) as AlpacaPosition[];
    return raw.map((p) => ({
      symbol: p.symbol,
      quantity: Number(p.qty),
      avgCost: Number(p.avg_entry_price),
      marketPrice: Number(p.current_price),
      marketValue: Number(p.market_value),
      unrealizedPnl: Number(p.unrealized_pl),
    }));
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const res = await this.tradingFetch("/v2/account");
    if (!res.ok) throw new Error(`Alpaca account error: ${res.status}`);

    const a = (await res.json()) as AlpacaAccount;
    return {
      netLiquidation: Number(a.equity),
      totalCash: Number(a.cash),
      buyingPower: Number(a.buying_power),
      currency: "USD",
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const quotes = await this.getQuotes([symbol]);
    return (
      quotes.get(symbol) ?? {
        symbol,
        last: null,
        bid: null,
        ask: null,
        high: null,
        low: null,
        close: null,
        volume: null,
      }
    );
  }

  async getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const result = new Map<string, Quote>();
    if (symbols.length === 0) return result;

    const params = new URLSearchParams({ symbols: symbols.join(",") });
    const res = await this.dataFetch(`/v2/stocks/snapshots?${params.toString()}`);
    if (!res.ok) return result;

    const data = (await res.json()) as Record<string, AlpacaSnapshot>;
    for (const [sym, snap] of Object.entries(data)) {
      result.set(sym, {
        symbol: sym,
        last: snap.latestTrade?.p ?? null,
        bid: snap.latestQuote?.bp ?? null,
        ask: snap.latestQuote?.ap ?? null,
        high: snap.dailyBar?.h ?? null,
        low: snap.dailyBar?.l ?? null,
        close: snap.prevDailyBar?.c ?? null,
        volume: snap.dailyBar?.v ?? null,
      });
    }
    return result;
  }

  async getHistoricalData(symbol: string, duration: string, barSize: string): Promise<BarData[]> {
    // duration: "1 Y", "6 M", "30 D" etc → Alpaca の start パラメータに変換
    const start = this.durationToStart(duration);
    const timeframe = this.barSizeToTimeframe(barSize);

    const params = new URLSearchParams({
      start: start.toISOString(),
      timeframe,
      limit: "1000",
      adjustment: "split",
    });

    const res = await this.dataFetch(`/v2/stocks/${symbol}/bars?${params.toString()}`);
    if (!res.ok) return [];

    const data = (await res.json()) as { bars: AlpacaBar[] };
    return (data.bars ?? []).map((b) => ({
      date: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));
  }

  // --- Private helpers ---

  private async tradingFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.tradingBase}${path}`, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });
  }

  private async dataFetch(path: string): Promise<Response> {
    return fetch(`${this.dataBase}${path}`, { headers: this.headers });
  }

  private async waitForFill(orderId: string, timeoutMs: number): Promise<OrderResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await this.tradingFetch(`/v2/orders/${orderId}`);
      if (!res.ok) break;

      const order = (await res.json()) as AlpacaOrder;
      if (order.status === "filled") {
        return {
          brokerOrderId: order.id,
          status: "filled",
          fillPrice: Number(order.filled_avg_price),
          fillQuantity: Number(order.filled_qty),
        };
      }
      if (
        order.status === "canceled" ||
        order.status === "expired" ||
        order.status === "rejected"
      ) {
        return {
          brokerOrderId: order.id,
          status: order.status === "rejected" ? "rejected" : "cancelled",
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { brokerOrderId: orderId, status: "submitted" };
  }

  private durationToStart(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)\s*([YMWD])/i);
    if (!match) return new Date(now.getTime() - 30 * 86400_000);

    const n = Number.parseInt(match[1]);
    const unit = match[2].toUpperCase();
    switch (unit) {
      case "Y":
        now.setFullYear(now.getFullYear() - n);
        break;
      case "M":
        now.setMonth(now.getMonth() - n);
        break;
      case "W":
        now.setDate(now.getDate() - n * 7);
        break;
      case "D":
        now.setDate(now.getDate() - n);
        break;
    }
    return now;
  }

  private barSizeToTimeframe(barSize: string): string {
    const map: Record<string, string> = {
      "1 min": "1Min",
      "5 mins": "5Min",
      "15 mins": "15Min",
      "1 hour": "1Hour",
      "1 day": "1Day",
      "1 week": "1Week",
      "1 month": "1Month",
    };
    return map[barSize.toLowerCase()] ?? "1Day";
  }
}

// Alpaca API response types
interface AlpacaAccount {
  equity: string;
  cash: string;
  buying_power: string;
  currency: string;
}

interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
}

interface AlpacaOrder {
  id: string;
  status: string;
  filled_avg_price: string | null;
  filled_qty: string | null;
}

interface AlpacaSnapshot {
  latestTrade?: { p: number };
  latestQuote?: { bp: number; ap: number };
  dailyBar?: { h: number; l: number; c: number; v: number };
  prevDailyBar?: { c: number };
}

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
