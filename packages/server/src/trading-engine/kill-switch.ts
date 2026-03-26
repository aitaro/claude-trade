/** 緊急停止 (Kill Switch) */

import { eq } from "drizzle-orm";
import { loadEnv } from "../config.js";
import { db } from "../db/client.js";
import { riskState } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("kill-switch");

export async function activateKillSwitch(reason: string): Promise<void> {
  const [existing] = await db.select().from(riskState).where(eq(riskState.id, 1));

  if (!existing) {
    await db.insert(riskState).values({
      id: 1,
      killSwitchActive: true,
      killSwitchReason: reason,
      killSwitchActivatedAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(riskState)
      .set({
        killSwitchActive: true,
        killSwitchReason: reason,
        killSwitchActivatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(riskState.id, 1));
  }

  log.error({ reason }, "Kill switch ACTIVATED");
}

export async function deactivateKillSwitch(): Promise<void> {
  await db
    .update(riskState)
    .set({
      killSwitchActive: false,
      killSwitchReason: null,
      killSwitchActivatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(riskState.id, 1));

  log.info("Kill switch deactivated");
}

export async function checkDailyLoss(currentNav: number, startingNav: number): Promise<boolean> {
  if (startingNav <= 0) return false;

  const env = loadEnv();
  const lossPct = ((startingNav - currentNav) / startingNav) * 100;

  if (lossPct > env.DAILY_LOSS_LIMIT_PCT) {
    await activateKillSwitch(
      `Daily loss ${lossPct.toFixed(2)}% exceeded limit ${env.DAILY_LOSS_LIMIT_PCT}%`,
    );
    return true;
  }

  // Update daily loss in risk state
  await db
    .update(riskState)
    .set({
      dailyLossPct: Math.max(0, lossPct),
      updatedAt: new Date(),
    })
    .where(eq(riskState.id, 1));

  return false;
}
