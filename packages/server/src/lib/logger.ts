import pino from "pino";
import type { PrettyOptions } from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

// GCP Cloud Logging の severity にマッピング
const GCP_SEVERITY: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

const prettyOptions: PrettyOptions = {
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname,scope",
  singleLine: true,
  messageFormat: "[{scope}] {msg}",
};

const rootLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label) {
      if (isProduction) {
        return { severity: GCP_SEVERITY[label] || "DEFAULT" };
      }
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: prettyOptions,
      },
});

/** scope 付き child logger を作成 (e.g. "scheduler/US/intraday") */
export function createLogger(...parts: string[]): pino.Logger {
  const scope = parts.filter(Boolean).join("/");
  return rootLogger.child({ scope });
}

/** 後方互換: rootLogger をそのまま使う場合 */
export const logger = rootLogger;
export type Logger = pino.Logger;
