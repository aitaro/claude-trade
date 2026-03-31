/** ブローカー抽象化レイヤー — 証券会社非依存のインターフェース */

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

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface AccountSummary {
  netLiquidation: number;
  totalCash: number;
  buyingPower: number;
  currency: string;
}

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  signalId: string;
  reasoning: string;
}

export interface OrderResult {
  brokerOrderId: string;
  status: "submitted" | "filled" | "cancelled" | "rejected";
  fillPrice?: number;
  fillQuantity?: number;
}

export interface BrokerAdapter {
  readonly name: string;

  connect(): Promise<void>;
  disconnect(): void;

  placeOrder(req: OrderRequest): Promise<OrderResult>;
  getPositions(): Promise<Position[]>;
  getAccountSummary(): Promise<AccountSummary>;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Map<string, Quote>>;
  getHistoricalData(symbol: string, duration: string, barSize: string): Promise<BarData[]>;
}
