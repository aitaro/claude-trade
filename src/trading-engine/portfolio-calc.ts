/** 目標ポートフォリオ計算 → 注文生成 */

import type { Signal } from "../db/schema.js";

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  signalId: string;
  reasoning: string;
  exchange: string;
  currency: string;
}

function calculateTargetShares(
  signal: Signal,
  nav: number,
  currentPosition: number,
  currentPrice: number,
  maxPositionPct: number,
): number {
  if (signal.signalType === "hold" || signal.signalType === "avoid") {
    return currentPosition;
  }

  const maxPositionValue = nav * (maxPositionPct / 100);

  if (signal.signalType === "buy") {
    const allocFactor = Math.abs(signal.strength) * (signal.confidence ?? 0.5);
    const targetValue = maxPositionValue * allocFactor;
    return currentPrice > 0 ? Math.floor(targetValue / currentPrice) : 0;
  }

  if (signal.signalType === "sell") {
    const reduceFactor = Math.abs(signal.strength) * (signal.confidence ?? 0.5);
    return Math.max(0, Math.floor(currentPosition * (1 - reduceFactor)));
  }

  return currentPosition;
}

export function generateOrders(
  signalMap: Map<string, Signal>,
  nav: number,
  positions: Map<string, number>,
  prices: Map<string, number>,
  maxPositionPct: number,
  exchange = "SMART",
  currency = "USD",
): OrderRequest[] {
  const orders: OrderRequest[] = [];

  for (const [symbol, signal] of signalMap) {
    const currentQty = positions.get(symbol) ?? 0;
    const currentPrice = prices.get(symbol) ?? 0;

    if (currentPrice <= 0) continue;

    const targetQty = calculateTargetShares(
      signal,
      nav,
      currentQty,
      currentPrice,
      maxPositionPct,
    );

    const diff = targetQty - currentQty;

    if (diff > 0) {
      orders.push({
        symbol,
        side: "BUY",
        quantity: diff,
        signalId: signal.id,
        reasoning: `Signal: ${signal.signalType} strength=${signal.strength.toFixed(2)} conf=${(signal.confidence ?? 0.5).toFixed(2)}`,
        exchange,
        currency,
      });
    } else if (diff < 0) {
      orders.push({
        symbol,
        side: "SELL",
        quantity: Math.abs(diff),
        signalId: signal.id,
        reasoning: `Signal: ${signal.signalType} strength=${signal.strength.toFixed(2)} conf=${(signal.confidence ?? 0.5).toFixed(2)}`,
        exchange,
        currency,
      });
    }
  }

  return orders;
}
