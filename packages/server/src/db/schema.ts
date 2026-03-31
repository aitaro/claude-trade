import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ── Stage 1 → Stage 2 bridge ──

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: varchar("symbol").notNull(),
    signalType: varchar("signal_type").notNull(), // buy, sell, hold, avoid
    strength: doublePrecision("strength").notNull(), // -1.0 to +1.0
    reasoning: varchar("reasoning").notNull(),
    marketContext: jsonb("market_context").default({}),
    sourceStrategy: varchar("source_strategy").default("default"),
    confidence: doublePrecision("confidence").default(0.5),
    expiresAt: timestamp("expires_at").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("signals_symbol_idx").on(t.symbol)],
);

export const researchReports = pgTable("research_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportType: varchar("report_type").notNull(), // premarket, intraday, eod, sector, macro
  title: varchar("title").notNull(),
  content: varchar("content").notNull(),
  symbolsAnalyzed: jsonb("symbols_analyzed").default([]),
  keyFindings: jsonb("key_findings").default({}),
  sessionId: varchar("session_id").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Trading Engine records ──

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalId: uuid("signal_id"),
    action: varchar("action").notNull(), // buy, sell, hold, skip
    symbol: varchar("symbol").notNull(),
    targetQuantity: integer("target_quantity").default(0),
    reasoning: varchar("reasoning").default(""),
    riskChecks: jsonb("risk_checks").default({}),
    approved: boolean("approved").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("decisions_signal_id_idx").on(t.signalId),
    index("decisions_symbol_idx").on(t.symbol),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionId: uuid("decision_id").notNull(),
    signalId: uuid("signal_id"),
    symbol: varchar("symbol").notNull(),
    side: varchar("side").notNull(), // BUY, SELL
    quantity: integer("quantity").notNull(),
    orderType: varchar("order_type").default("MKT"),
    limitPrice: doublePrecision("limit_price"),
    status: varchar("status").default("pending"), // pending, submitted, filled, cancelled, rejected
    ibOrderId: integer("ib_order_id"),
    fillPrice: doublePrecision("fill_price"),
    fillQuantity: integer("fill_quantity"),
    filledAt: timestamp("filled_at"),
    errorMessage: varchar("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("orders_decision_id_idx").on(t.decisionId),
    index("orders_signal_id_idx").on(t.signalId),
    index("orders_symbol_idx").on(t.symbol),
  ],
);

// ── Snapshots ──

export const positionSnapshots = pgTable(
  "position_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: varchar("symbol").notNull(),
    quantity: integer("quantity").notNull(),
    avgCost: doublePrecision("avg_cost").notNull(),
    marketPrice: doublePrecision("market_price").notNull(),
    marketValue: doublePrecision("market_value").notNull(),
    unrealizedPnl: doublePrecision("unrealized_pnl").notNull(),
    realizedPnl: doublePrecision("realized_pnl").default(0),
    capturedAt: timestamp("captured_at").defaultNow(),
  },
  (t) => [index("position_snapshots_symbol_idx").on(t.symbol)],
);

export const accountSnapshots = pgTable("account_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  netLiquidation: doublePrecision("net_liquidation").notNull(),
  totalCash: doublePrecision("total_cash").notNull(),
  buyingPower: doublePrecision("buying_power").notNull(),
  grossPositionValue: doublePrecision("gross_position_value").notNull(),
  unrealizedPnl: doublePrecision("unrealized_pnl").notNull(),
  realizedPnl: doublePrecision("realized_pnl").notNull(),
  capturedAt: timestamp("captured_at").defaultNow(),
});

// ── Risk ──

export const riskState = pgTable("risk_state", {
  id: integer("id").primaryKey().default(1),
  killSwitchActive: boolean("kill_switch_active").default(false),
  killSwitchReason: varchar("kill_switch_reason"),
  killSwitchActivatedAt: timestamp("kill_switch_activated_at"),
  liveTradingEnabled: boolean("live_trading_enabled").default(false),
  dailyLossPct: doublePrecision("daily_loss_pct").default(0),
  dailyOrderCount: integer("daily_order_count").default(0),
  lastResetDate: varchar("last_reset_date"), // YYYY-MM-DD
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Performance ──

export const dailyPerformance = pgTable(
  "daily_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: varchar("date").notNull(), // YYYY-MM-DD
    startingNav: doublePrecision("starting_nav").notNull(),
    endingNav: doublePrecision("ending_nav").notNull(),
    pnl: doublePrecision("pnl").notNull(),
    pnlPct: doublePrecision("pnl_pct").notNull(),
    tradesCount: integer("trades_count").default(0),
    winners: integer("winners").default(0),
    losers: integer("losers").default(0),
    maxDrawdownPct: doublePrecision("max_drawdown_pct").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("daily_performance_date_idx").on(t.date)],
);

// ── Feedback Loop ──

export const signalOutcomes = pgTable(
  "signal_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalId: uuid("signal_id").notNull(),
    symbol: varchar("symbol").notNull(),
    signalType: varchar("signal_type").notNull(),
    strength: doublePrecision("strength").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    sourceStrategy: varchar("source_strategy").default(""),
    priceAtSignal: doublePrecision("price_at_signal"),
    priceAtEval: doublePrecision("price_at_eval"),
    priceChangePct: doublePrecision("price_change_pct"),
    directionCorrect: boolean("direction_correct"),
    pnl: doublePrecision("pnl"),
    evaluation: varchar("evaluation").default(""),
    evaluatedAt: timestamp("evaluated_at").defaultNow(),
  },
  (t) => [
    index("signal_outcomes_signal_id_idx").on(t.signalId),
    index("signal_outcomes_symbol_idx").on(t.symbol),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonType: varchar("lesson_type").notNull(), // signal_accuracy, market_pattern, risk, strategy, info_source
    category: varchar("category").notNull(), // positive, negative, neutral
    symbol: varchar("symbol"),
    sourceStrategy: varchar("source_strategy"),
    description: varchar("description").notNull(),
    evidence: jsonb("evidence").default({}),
    confidence: doublePrecision("confidence").default(0.5),
    observationCount: integer("observation_count").default(1),
    isActive: boolean("is_active").default(true),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("lessons_symbol_idx").on(t.symbol)],
);

// ── News ──

export const newsItems = pgTable("news_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source").notNull(), // finnhub, rss
  headline: varchar("headline").notNull(),
  summary: varchar("summary").default(""),
  url: varchar("url").default(""),
  symbols: jsonb("symbols").default([]),
  publishedAt: timestamp("published_at"),
  sentiment: doublePrecision("sentiment"), // -1.0 to 1.0
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// ── Session ──

export const sessionLogs = pgTable("session_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionType: varchar("session_type").notNull(), // research, trading, eod_review
  sessionId: varchar("session_id").default(""),
  status: varchar("status").default("started"), // started, completed, failed
  signalsGenerated: integer("signals_generated").default(0),
  ordersPlaced: integer("orders_placed").default(0),
  summary: varchar("summary").default(""),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Type exports for use in application code
export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type ResearchReport = typeof researchReports.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type PositionSnapshot = typeof positionSnapshots.$inferSelect;
export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type RiskState = typeof riskState.$inferSelect;
export type DailyPerformance = typeof dailyPerformance.$inferSelect;
export type SignalOutcome = typeof signalOutcomes.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type SessionLog = typeof sessionLogs.$inferSelect;
