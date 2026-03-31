import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PROJECT_ROOT = resolve(__dirname, "../../..");

export function loadEnv() {
  config({ path: resolve(PROJECT_ROOT, ".env") });

  return {
    // PostgreSQL
    POSTGRES_USER: process.env.POSTGRES_USER || "claude_trade",
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "change_me_in_production",
    POSTGRES_HOST: process.env.POSTGRES_HOST || "localhost",
    POSTGRES_PORT: process.env.POSTGRES_PORT || "5432",
    POSTGRES_DB: process.env.POSTGRES_DB || "claude_trade",

    // Broker
    BROKER: process.env.BROKER || "alpaca",
    ALPACA_API_KEY: process.env.ALPACA_API_KEY || "",
    ALPACA_API_SECRET: process.env.ALPACA_API_SECRET || "",
    ALPACA_PAPER: process.env.ALPACA_PAPER !== "false",

    // Finnhub
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || "",

    // Risk Controls
    MAX_POSITION_PCT: Number(process.env.MAX_POSITION_PCT || "10.0"),
    MAX_DAILY_ORDERS: Number(process.env.MAX_DAILY_ORDERS || "20"),
    DAILY_LOSS_LIMIT_PCT: Number(process.env.DAILY_LOSS_LIMIT_PCT || "3.0"),
    LIVE_TRADING_ENABLED: process.env.LIVE_TRADING_ENABLED === "true",

    // Claude
    MODEL: "claude-sonnet-4-6",
    MAX_TURNS: Number(process.env.MAX_TURNS || "50"),
    ENABLED_MARKETS: process.env.ENABLED_MARKETS || "us,jp,eu,uk",
  };
}

export type Env = ReturnType<typeof loadEnv>;
