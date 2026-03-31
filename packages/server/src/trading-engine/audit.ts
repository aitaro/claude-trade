/** 注文・判断の監査記録 */

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { type Decision, type SessionLog, decisions, sessionLogs } from "../db/schema.js";

export async function recordDecision(
  signalId: string | null,
  action: string,
  symbol: string,
  targetQuantity: number,
  reasoning: string,
  riskChecks: Record<string, boolean>,
  approved: boolean,
): Promise<Decision> {
  const [decision] = await db
    .insert(decisions)
    .values({
      signalId,
      action,
      symbol,
      targetQuantity,
      reasoning,
      riskChecks,
      approved,
    })
    .returning();

  return decision;
}

export async function startSession(sessionType: string): Promise<SessionLog> {
  const [log] = await db
    .insert(sessionLogs)
    .values({
      sessionType,
      status: "started",
    })
    .returning();

  return log;
}

export async function completeSession(
  sessionLog: SessionLog,
  options: {
    status?: string;
    signalsGenerated?: number;
    ordersPlaced?: number;
    summary?: string;
  } = {},
): Promise<void> {
  await db
    .update(sessionLogs)
    .set({
      status: options.status ?? "completed",
      signalsGenerated: options.signalsGenerated ?? 0,
      ordersPlaced: options.ordersPlaced ?? 0,
      summary: options.summary ?? "",
      completedAt: new Date(),
    })
    .where(eq(sessionLogs.id, sessionLog.id));
}
