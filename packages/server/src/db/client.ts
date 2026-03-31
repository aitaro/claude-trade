import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnv } from "../config.js";
import * as schema from "./schema.js";

const env = loadEnv();

const pool = new pg.Pool({
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  host: env.POSTGRES_HOST,
  port: Number(env.POSTGRES_PORT),
  database: env.POSTGRES_DB,
});

export const db = drizzle(pool, { schema });
export { pool };
