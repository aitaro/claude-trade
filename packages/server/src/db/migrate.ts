import { sql } from "drizzle-orm";
import { createLogger } from "../lib/logger.js";
import { db, pool } from "./client.js";
import * as schema from "./schema.js";

const log = createLogger("migrate");

async function migrate() {
  log.info("Running migrations...");

  // create_all equivalent: create tables if not exist using Drizzle push
  // For simplicity, we use raw SQL to create tables based on schema
  // In production, use drizzle-kit generate + migrate

  const tables = [
    schema.signals,
    schema.researchReports,
    schema.decisions,
    schema.orders,
    schema.positionSnapshots,
    schema.accountSnapshots,
    schema.riskState,
    schema.dailyPerformance,
    schema.signalOutcomes,
    schema.lessons,
    schema.newsItems,
    schema.sessionLogs,
  ];

  // Enable uuid-ossp extension for gen_random_uuid()
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // Use drizzle-kit push for schema sync (programmatic)
  // For now, we just verify connection
  const result = await db.execute(sql`SELECT 1 as ok`);
  log.info({ result: result.rows[0] }, "DB connection OK");

  log.info({ tables: tables.map((t) => t._.name) }, "Tables defined");
  log.info("To sync schema, run: npx drizzle-kit push");

  await pool.end();
}

migrate().catch((err) => {
  log.error({ err }, "Migration failed");
  process.exit(1);
});
