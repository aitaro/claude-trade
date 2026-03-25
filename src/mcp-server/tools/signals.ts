/** シグナル書き込み・読み取りツール */

import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { signals } from "../../db/schema.js";

export async function writeSignal(
  symbol: string,
  signalType: string,
  strength: number,
  reasoning: string,
  confidence = 0.5,
  sourceStrategy = "default",
  marketContext: Record<string, unknown> | null = null,
  ttlHours = 8.0,
): Promise<Record<string, unknown>> {
  strength = Math.max(-1.0, Math.min(1.0, strength));
  confidence = Math.max(0.0, Math.min(1.0, confidence));

  if (!["buy", "sell", "hold", "avoid"].includes(signalType)) {
    return {
      error: `Invalid signal_type: ${signalType}. Must be buy/sell/hold/avoid`,
    };
  }

  const upperSymbol = symbol.toUpperCase();
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  // 同じ銘柄の古いアクティブシグナルを無効化
  await db
    .update(signals)
    .set({ isActive: false })
    .where(
      and(
        eq(signals.symbol, upperSymbol),
        eq(signals.isActive, true),
        eq(signals.sourceStrategy, sourceStrategy),
      ),
    );

  const [signal] = await db
    .insert(signals)
    .values({
      symbol: upperSymbol,
      signalType,
      strength,
      reasoning,
      marketContext: marketContext ?? {},
      sourceStrategy,
      confidence,
      expiresAt,
    })
    .returning();

  return {
    id: signal.id,
    symbol: signal.symbol,
    signal_type: signal.signalType,
    strength: signal.strength,
    confidence: signal.confidence,
    expires_at: signal.expiresAt.toISOString(),
  };
}

export async function getActiveSignals(
  symbol: string | null = null,
  sourceStrategy: string | null = null,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const conditions = [eq(signals.isActive, true), gt(signals.expiresAt, now)];
  if (symbol) {
    conditions.push(eq(signals.symbol, symbol.toUpperCase()));
  }
  if (sourceStrategy) {
    conditions.push(eq(signals.sourceStrategy, sourceStrategy));
  }

  const rows = await db
    .select()
    .from(signals)
    .where(and(...conditions))
    .orderBy(desc(signals.createdAt));

  return {
    signals: rows.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      signal_type: s.signalType,
      strength: s.strength,
      confidence: s.confidence,
      reasoning: s.reasoning.slice(0, 500),
      source_strategy: s.sourceStrategy,
      expires_at: s.expiresAt.toISOString(),
      created_at: s.createdAt?.toISOString(),
    })),
    count: rows.length,
  };
}
