/** 判断履歴照会ツール */

import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { decisions, orders, sessionLogs } from "../../db/schema.js";

export async function getDecisionHistory(
  symbol: string | null = null,
  limit = 20,
): Promise<Record<string, unknown>> {
  let query = db.select().from(decisions).orderBy(desc(decisions.createdAt)).limit(limit);

  if (symbol) {
    query = query.where(eq(decisions.symbol, symbol.toUpperCase())) as typeof query;
  }

  const rows = await query;

  return {
    decisions: rows.map((d) => ({
      id: d.id,
      symbol: d.symbol,
      action: d.action,
      target_quantity: d.targetQuantity,
      reasoning: (d.reasoning ?? "").slice(0, 300),
      approved: d.approved,
      signal_id: d.signalId,
      created_at: d.createdAt?.toISOString(),
    })),
    count: rows.length,
  };
}

export async function getOrderHistory(
  symbol: string | null = null,
  status: string | null = null,
  limit = 20,
): Promise<Record<string, unknown>> {
  let query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);

  if (symbol) {
    query = query.where(eq(orders.symbol, symbol.toUpperCase())) as typeof query;
  }
  if (status) {
    query = query.where(eq(orders.status, status)) as typeof query;
  }

  const rows = await query;

  return {
    orders: rows.map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      quantity: o.quantity,
      order_type: o.orderType,
      status: o.status,
      fill_price: o.fillPrice,
      fill_quantity: o.fillQuantity,
      created_at: o.createdAt?.toISOString(),
    })),
    count: rows.length,
  };
}

export async function getSessionLogs(limit = 10): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(sessionLogs)
    .orderBy(desc(sessionLogs.startedAt))
    .limit(limit);

  return {
    sessions: rows.map((s) => ({
      id: s.id,
      session_type: s.sessionType,
      status: s.status,
      signals_generated: s.signalsGenerated,
      orders_placed: s.ordersPlaced,
      summary: (s.summary ?? "").slice(0, 200),
      started_at: s.startedAt?.toISOString(),
      completed_at: s.completedAt?.toISOString() ?? null,
    })),
    count: rows.length,
  };
}
