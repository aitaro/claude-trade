/** DB からアクティブなシグナルを読み取る */

import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { signals, type Signal } from "../db/schema.js";

export async function readActiveSignals(
  sourceStrategy: string | null = null,
): Promise<Signal[]> {
  const now = new Date();
  const conditions = [eq(signals.isActive, true), gt(signals.expiresAt, now)];
  if (sourceStrategy) {
    conditions.push(eq(signals.sourceStrategy, sourceStrategy));
  }

  return db
    .select()
    .from(signals)
    .where(and(...conditions))
    .orderBy(desc(signals.createdAt));
}

export async function getLatestSignalPerSymbol(
  sourceStrategy: string | null = null,
): Promise<Map<string, Signal>> {
  const rows = await readActiveSignals(sourceStrategy);
  const latest = new Map<string, Signal>();
  for (const s of rows) {
    if (!latest.has(s.symbol)) {
      latest.set(s.symbol, s);
    }
  }
  return latest;
}
