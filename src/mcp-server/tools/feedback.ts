/** フィードバックループ: シグナル評価・学習ツール */

import { eq, and, gt, or, isNull, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { signals, signalOutcomes, lessons } from "../../db/schema.js";

export async function evaluateSignal(
  signalId: string,
  priceAtSignal: number,
  priceAtEval: number,
  evaluation: string,
  pnl: number | null = null,
): Promise<Record<string, unknown>> {
  const [signal] = await db
    .select()
    .from(signals)
    .where(eq(signals.id, signalId));

  if (!signal) {
    return { error: `Signal ${signalId} not found` };
  }

  const priceChangePct =
    priceAtSignal > 0
      ? ((priceAtEval - priceAtSignal) / priceAtSignal) * 100
      : 0;

  let directionCorrect: boolean;
  if (signal.signalType === "buy") {
    directionCorrect = priceChangePct > 0;
  } else if (signal.signalType === "sell") {
    directionCorrect = priceChangePct < 0;
  } else if (signal.signalType === "avoid") {
    directionCorrect = priceChangePct < 0;
  } else {
    // hold
    directionCorrect = Math.abs(priceChangePct) < 2.0;
  }

  const [outcome] = await db
    .insert(signalOutcomes)
    .values({
      signalId: signal.id,
      symbol: signal.symbol,
      signalType: signal.signalType,
      strength: signal.strength,
      confidence: signal.confidence ?? 0.5,
      sourceStrategy: signal.sourceStrategy ?? "",
      priceAtSignal,
      priceAtEval,
      priceChangePct: Math.round(priceChangePct * 10000) / 10000,
      directionCorrect,
      pnl,
      evaluation,
    })
    .returning();

  return {
    id: outcome.id,
    symbol: outcome.symbol,
    signal_type: outcome.signalType,
    direction_correct: directionCorrect,
    price_change_pct: outcome.priceChangePct,
    evaluation: evaluation.slice(0, 200),
  };
}

export async function recordLesson(
  lessonType: string,
  category: string,
  description: string,
  symbol: string | null = null,
  sourceStrategy: string | null = null,
  evidence: Record<string, unknown> | null = null,
  ttlDays = 30,
): Promise<Record<string, unknown>> {
  // 類似の既存 lesson を検索
  const conditions = [
    eq(lessons.lessonType, lessonType),
    eq(lessons.isActive, true),
    eq(lessons.description, description),
  ];
  if (symbol) {
    conditions.push(eq(lessons.symbol, symbol.toUpperCase()));
  }

  const [existing] = await db
    .select()
    .from(lessons)
    .where(and(...conditions));

  if (existing) {
    const newConfidence = Math.min(1.0, (existing.confidence ?? 0.5) + 0.1);
    const newExpires = new Date(Date.now() + ttlDays * 86400000);

    await db
      .update(lessons)
      .set({
        observationCount: (existing.observationCount ?? 1) + 1,
        confidence: newConfidence,
        updatedAt: new Date(),
        expiresAt: newExpires,
        ...(evidence ? { evidence } : {}),
      })
      .where(eq(lessons.id, existing.id));

    return {
      id: existing.id,
      action: "updated",
      observation_count: (existing.observationCount ?? 1) + 1,
      confidence: newConfidence,
      description: existing.description.slice(0, 200),
    };
  }

  const [lesson] = await db
    .insert(lessons)
    .values({
      lessonType,
      category,
      description,
      symbol: symbol?.toUpperCase() ?? null,
      sourceStrategy,
      evidence: evidence ?? {},
      confidence: 0.5,
      expiresAt: new Date(Date.now() + ttlDays * 86400000),
    })
    .returning();

  return {
    id: lesson.id,
    action: "created",
    observation_count: 1,
    confidence: lesson.confidence,
    description: lesson.description.slice(0, 200),
  };
}

export async function getRelevantLessons(
  symbol: string | null = null,
  sourceStrategy: string | null = null,
  lessonType: string | null = null,
  limit = 20,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const conditions = [
    eq(lessons.isActive, true),
    or(isNull(lessons.expiresAt), gt(lessons.expiresAt, now)),
  ];

  if (symbol) {
    conditions.push(
      or(eq(lessons.symbol, symbol.toUpperCase()), isNull(lessons.symbol)),
    );
  }
  if (sourceStrategy) {
    conditions.push(
      or(
        eq(lessons.sourceStrategy, sourceStrategy),
        isNull(lessons.sourceStrategy),
      ),
    );
  }
  if (lessonType) {
    conditions.push(eq(lessons.lessonType, lessonType));
  }

  const rows = await db
    .select()
    .from(lessons)
    .where(and(...conditions))
    .orderBy(desc(lessons.confidence), desc(lessons.observationCount))
    .limit(limit);

  return {
    lessons: rows.map((l) => ({
      id: l.id,
      lesson_type: l.lessonType,
      category: l.category,
      symbol: l.symbol,
      description: l.description,
      confidence: l.confidence,
      observation_count: l.observationCount,
      source_strategy: l.sourceStrategy,
      updated_at: l.updatedAt?.toISOString(),
    })),
    count: rows.length,
  };
}

export async function getSignalAccuracy(
  sourceStrategy: string | null = null,
  days = 30,
): Promise<Record<string, unknown>> {
  const cutoff = new Date(Date.now() - days * 86400000);

  const conditions = [gt(signalOutcomes.evaluatedAt, cutoff)];
  if (sourceStrategy) {
    conditions.push(eq(signalOutcomes.sourceStrategy, sourceStrategy));
  }

  const rows = await db
    .select()
    .from(signalOutcomes)
    .where(and(...conditions));

  if (rows.length === 0) {
    return { message: "No signal outcomes found", accuracy: {} };
  }

  const total = rows.length;
  const correct = rows.filter((o) => o.directionCorrect).length;

  const byType: Record<
    string,
    { total: number; correct: number; accuracy: number }
  > = {};
  for (const o of rows) {
    const t = o.signalType;
    if (!byType[t]) byType[t] = { total: 0, correct: 0, accuracy: 0 };
    byType[t].total++;
    if (o.directionCorrect) byType[t].correct++;
  }
  for (const t of Object.keys(byType)) {
    byType[t].accuracy =
      byType[t].total > 0
        ? Math.round((byType[t].correct / byType[t].total) * 10000) / 10000
        : 0;
  }

  const avgConfidence =
    rows.reduce((sum, o) => sum + o.confidence, 0) / total;
  const avgPriceChange =
    rows.reduce((sum, o) => sum + Math.abs(o.priceChangePct ?? 0), 0) / total;

  return {
    period_days: days,
    total_signals: total,
    overall_accuracy: Math.round((correct / total) * 10000) / 10000,
    avg_confidence: Math.round(avgConfidence * 10000) / 10000,
    avg_abs_price_change_pct: Math.round(avgPriceChange * 10000) / 10000,
    by_type: byType,
  };
}
