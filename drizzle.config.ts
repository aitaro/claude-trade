import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const user = process.env.POSTGRES_USER || "claude_trade";
const password = process.env.POSTGRES_PASSWORD || "change_me_in_production";
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const database = process.env.POSTGRES_DB || "claude_trade";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: `postgresql://${user}:${password}@${host}:${port}/${database}`,
  },
});
