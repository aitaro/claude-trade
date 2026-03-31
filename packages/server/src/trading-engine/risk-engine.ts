/** リスクチェックエンジン — 全注文は必ずここを通過する */

import { eq } from "drizzle-orm";
import type { OrderRequest } from "../broker/types.js";
import { loadEnv } from "../config.js";
import { db } from "../db/client.js";
import { type RiskState, riskState } from "../db/schema.js";

export interface RiskCheckResult {
  approved: boolean;
  checks: Record<string, boolean>;
  reasons: string[];
}

export async function getRiskState(): Promise<RiskState> {
  const [state] = await db.select().from(riskState).where(eq(riskState.id, 1));

  if (!state) {
    const [created] = await db.insert(riskState).values({ id: 1 }).returning();
    return created;
  }
  return state;
}

export async function checkOrder(
  order: OrderRequest,
  nav: number,
  currentPrice: number,
): Promise<RiskCheckResult> {
  const env = loadEnv();
  const checks: Record<string, boolean> = {};
  const reasons: string[] = [];
  const state = await getRiskState();

  // 1. Kill switch
  checks.kill_switch = !state.killSwitchActive;
  if (state.killSwitchActive) {
    reasons.push(`Kill switch active: ${state.killSwitchReason}`);
  }

  // 2. Live trading disabled check
  checks.trading_enabled = true; // paper always ok

  // 3. Max position size
  const orderValue = order.quantity * currentPrice;
  const maxValue = nav * (env.MAX_POSITION_PCT / 100);
  checks.position_size = orderValue <= maxValue;
  if (!checks.position_size) {
    reasons.push(
      `Order value ${orderValue.toFixed(0)} exceeds max ${maxValue.toFixed(0)} (${env.MAX_POSITION_PCT}% of NAV)`,
    );
  }

  // 4. Daily order count
  const today = new Date().toISOString().slice(0, 10);
  let dailyCount = state.dailyOrderCount ?? 0;
  if (state.lastResetDate !== today) {
    dailyCount = 0;
  }
  checks.daily_orders = dailyCount < env.MAX_DAILY_ORDERS;
  if (!checks.daily_orders) {
    reasons.push(`Daily order limit reached: ${dailyCount}/${env.MAX_DAILY_ORDERS}`);
  }

  // 5. Daily loss limit
  checks.daily_loss = (state.dailyLossPct ?? 0) < env.DAILY_LOSS_LIMIT_PCT;
  if (!checks.daily_loss) {
    reasons.push(
      `Daily loss ${(state.dailyLossPct ?? 0).toFixed(2)}% exceeds limit ${env.DAILY_LOSS_LIMIT_PCT}%`,
    );
  }

  const approved = Object.values(checks).every(Boolean);
  return { approved, checks, reasons };
}

export async function incrementOrderCount(): Promise<void> {
  const state = await getRiskState();
  const today = new Date().toISOString().slice(0, 10);
  const newCount = state.lastResetDate === today ? (state.dailyOrderCount ?? 0) + 1 : 1;

  await db
    .update(riskState)
    .set({
      dailyOrderCount: newCount,
      lastResetDate: today,
      updatedAt: new Date(),
    })
    .where(eq(riskState.id, 1));
}
