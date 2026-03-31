/** ブローカーファクトリ — env.BROKER に基づいてアダプターを生成 */

import { AlpacaAdapter } from "./alpaca-adapter.js";
import type { BrokerAdapter } from "./types.js";

export type { BrokerAdapter } from "./types.js";
export type {
  Quote,
  BarData,
  Position,
  AccountSummary,
  OrderRequest,
  OrderResult,
} from "./types.js";

let instance: BrokerAdapter | null = null;

export function createBroker(): BrokerAdapter {
  const broker = process.env.BROKER ?? "alpaca";

  switch (broker) {
    case "alpaca":
      return new AlpacaAdapter({
        apiKey: process.env.ALPACA_API_KEY ?? "",
        apiSecret: process.env.ALPACA_API_SECRET ?? "",
        paper: process.env.ALPACA_PAPER !== "false",
      });
    default:
      throw new Error(`Unknown broker: ${broker}`);
  }
}

/** シングルトンインスタンスを取得（MCP サーバー等で共有） */
export function getBroker(): BrokerAdapter {
  if (!instance) {
    instance = createBroker();
  }
  return instance;
}
