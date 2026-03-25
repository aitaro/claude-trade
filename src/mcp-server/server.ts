/** FastMCP サーバーエントリポイント */

import { FastMCP } from "fastmcp";
import { z } from "zod";

import { getQuote, getHistoricalData, getMarketSnapshot } from "./tools/market-data.js";
import { getPositions, getAccountSummary } from "./tools/portfolio.js";
import { writeSignal, getActiveSignals } from "./tools/signals.js";
import { writeResearchReport, getRecentReports } from "./tools/research.js";
import { getNews, searchNews, getEconomicCalendar } from "./tools/news.js";
import { getDecisionHistory, getOrderHistory, getSessionLogs } from "./tools/audit.js";
import { queryPerformance, getTradeStats } from "./tools/analytics.js";
import {
  evaluateSignal,
  recordLesson,
  getRelevantLessons,
  getSignalAccuracy,
} from "./tools/feedback.js";

const mcp = new FastMCP({
  name: "Claude Trade",
  version: "2.0.0",
});

// ── Market Data ──

mcp.addTool({
  name: "get_quote",
  description: "指定銘柄のリアルタイムクォートを取得する",
  parameters: z.object({
    symbol: z.string().describe("ティッカーシンボル (例: AAPL, 7203)"),
    exchange: z.string().default("SMART").describe("取引所 (例: SMART, TSEJ)"),
    currency: z.string().default("USD").describe("通貨 (例: USD, JPY, EUR)"),
  }),
  execute: async ({ symbol, exchange, currency }) =>
    JSON.stringify(await getQuote(symbol, exchange, currency)),
});

mcp.addTool({
  name: "get_historical_data",
  description: "指定銘柄の過去の価格データを取得する",
  parameters: z.object({
    symbol: z.string().describe("ティッカーシンボル"),
    duration: z.string().default("30 D").describe('期間 (例: "30 D", "6 M", "1 Y")'),
    bar_size: z.string().default("1 day").describe('バーサイズ (例: "1 day", "1 hour", "5 mins")'),
    exchange: z.string().default("SMART").describe("取引所"),
    currency: z.string().default("USD").describe("通貨"),
  }),
  execute: async ({ symbol, duration, bar_size, exchange, currency }) =>
    JSON.stringify(await getHistoricalData(symbol, duration, bar_size, exchange, currency)),
});

mcp.addTool({
  name: "get_market_snapshot",
  description: "複数銘柄のクォートを一括取得する",
  parameters: z.object({
    symbols: z.array(z.string()).describe("ティッカーシンボルのリスト"),
    exchange: z.string().default("SMART").describe("取引所"),
    currency: z.string().default("USD").describe("通貨"),
  }),
  execute: async ({ symbols, exchange, currency }) =>
    JSON.stringify(await getMarketSnapshot(symbols, exchange, currency)),
});

// ── Portfolio ──

mcp.addTool({
  name: "get_positions",
  description: "現在のポートフォリオポジション一覧を取得する",
  parameters: z.object({}),
  execute: async () => JSON.stringify(await getPositions()),
});

mcp.addTool({
  name: "get_account_summary",
  description: "口座サマリー（NAV, 現金, 購買力等）を取得する",
  parameters: z.object({}),
  execute: async () => JSON.stringify(await getAccountSummary()),
});

// ── Signals ──

mcp.addTool({
  name: "write_signal",
  description: "トレーディングシグナルを DB に書き込む",
  parameters: z.object({
    symbol: z.string().describe("ティッカーシンボル (例: AAPL)"),
    signal_type: z.enum(["buy", "sell", "hold", "avoid"]).describe("シグナルタイプ"),
    strength: z.number().min(-1).max(1).describe("シグナル強度 (-1.0〜+1.0)"),
    reasoning: z.string().describe("分析理由（テキスト）"),
    confidence: z.number().min(0).max(1).default(0.5).describe("確信度 (0.0〜1.0)"),
    source_strategy: z.string().default("default").describe("戦略名"),
    market_context: z.record(z.unknown()).nullable().default(null).describe("分析時のマーケットデータ"),
    ttl_hours: z.number().default(8).describe("シグナル有効期間（時間）"),
  }),
  execute: async (args) =>
    JSON.stringify(
      await writeSignal(
        args.symbol,
        args.signal_type,
        args.strength,
        args.reasoning,
        args.confidence,
        args.source_strategy,
        args.market_context,
        args.ttl_hours,
      ),
    ),
});

mcp.addTool({
  name: "get_active_signals",
  description: "アクティブなシグナル一覧を取得する",
  parameters: z.object({
    symbol: z.string().nullable().default(null).describe("特定銘柄に絞る場合のティッカー"),
    source_strategy: z.string().nullable().default(null).describe("特定戦略に絞る場合の戦略名"),
  }),
  execute: async ({ symbol, source_strategy }) =>
    JSON.stringify(await getActiveSignals(symbol, source_strategy)),
});

// ── Research ──

mcp.addTool({
  name: "write_research_report",
  description: "リサーチレポートを DB に保存する",
  parameters: z.object({
    report_type: z.enum(["premarket", "intraday", "eod", "sector", "macro"]).describe("レポートタイプ"),
    title: z.string().describe("レポートタイトル"),
    content: z.string().describe("マークダウン形式のレポート本文"),
    symbols_analyzed: z.array(z.string()).nullable().default(null).describe("分析した銘柄リスト"),
    key_findings: z.record(z.unknown()).nullable().default(null).describe("主要な発見事項"),
    session_id: z.string().default("").describe("Claude セッション ID"),
  }),
  execute: async (args) =>
    JSON.stringify(
      await writeResearchReport(
        args.report_type,
        args.title,
        args.content,
        args.symbols_analyzed,
        args.key_findings,
        args.session_id,
      ),
    ),
});

mcp.addTool({
  name: "get_recent_reports",
  description: "最近のリサーチレポートを取得する",
  parameters: z.object({
    report_type: z.string().nullable().default(null).describe("レポートタイプでフィルタ"),
    limit: z.number().default(10).describe("取得件数"),
  }),
  execute: async ({ report_type, limit }) =>
    JSON.stringify(await getRecentReports(report_type, limit)),
});

// ── News ──

mcp.addTool({
  name: "get_news",
  description: "指定銘柄のニュースを取得する (Finnhub)",
  parameters: z.object({
    symbol: z.string().describe("ティッカーシンボル"),
    days: z.number().default(3).describe("遡る日数"),
  }),
  execute: async ({ symbol, days }) =>
    JSON.stringify(await getNews(symbol, days)),
});

mcp.addTool({
  name: "search_news",
  description: "キーワードでニュースを検索する",
  parameters: z.object({
    query: z.string().describe("検索キーワード"),
  }),
  execute: async ({ query }) => JSON.stringify(await searchNews(query)),
});

mcp.addTool({
  name: "get_economic_calendar",
  description: "経済カレンダー（今週のイベント）を取得する",
  parameters: z.object({}),
  execute: async () => JSON.stringify(await getEconomicCalendar()),
});

// ── Audit ──

mcp.addTool({
  name: "get_decision_history",
  description: "過去の取引判断履歴を取得する",
  parameters: z.object({
    symbol: z.string().nullable().default(null).describe("特定銘柄でフィルタ"),
    limit: z.number().default(20).describe("取得件数"),
  }),
  execute: async ({ symbol, limit }) =>
    JSON.stringify(await getDecisionHistory(symbol, limit)),
});

mcp.addTool({
  name: "get_order_history",
  description: "過去の注文履歴を取得する",
  parameters: z.object({
    symbol: z.string().nullable().default(null).describe("特定銘柄でフィルタ"),
    status: z.string().nullable().default(null).describe("ステータスでフィルタ"),
    limit: z.number().default(20).describe("取得件数"),
  }),
  execute: async ({ symbol, status, limit }) =>
    JSON.stringify(await getOrderHistory(symbol, status, limit)),
});

mcp.addTool({
  name: "get_session_logs",
  description: "Claude セッション履歴を取得する",
  parameters: z.object({
    limit: z.number().default(10).describe("取得件数"),
  }),
  execute: async ({ limit }) => JSON.stringify(await getSessionLogs(limit)),
});

// ── Analytics ──

mcp.addTool({
  name: "query_performance",
  description: "日次成績を集計する",
  parameters: z.object({
    start_date: z.string().nullable().default(null).describe("開始日 (YYYY-MM-DD)"),
    end_date: z.string().nullable().default(null).describe("終了日 (YYYY-MM-DD)"),
  }),
  execute: async ({ start_date, end_date }) =>
    JSON.stringify(await queryPerformance(start_date, end_date)),
});

mcp.addTool({
  name: "get_trade_stats",
  description: "注文統計を取得する",
  parameters: z.object({
    symbol: z.string().nullable().default(null).describe("特定銘柄に絞る場合"),
  }),
  execute: async ({ symbol }) => JSON.stringify(await getTradeStats(symbol)),
});

// ── Feedback Loop ──

mcp.addTool({
  name: "evaluate_signal",
  description: "シグナルの事後評価を記録する",
  parameters: z.object({
    signal_id: z.string().describe("評価するシグナルの ID"),
    price_at_signal: z.number().describe("シグナル発行時の価格"),
    price_at_eval: z.number().describe("評価時の価格"),
    evaluation: z.string().describe("事後評価テキスト"),
    pnl: z.number().nullable().default(null).describe("実現損益"),
  }),
  execute: async (args) =>
    JSON.stringify(
      await evaluateSignal(
        args.signal_id,
        args.price_at_signal,
        args.price_at_eval,
        args.evaluation,
        args.pnl,
      ),
    ),
});

mcp.addTool({
  name: "record_lesson",
  description: "学びを記録する。類似の既存 lesson があれば observation_count を増やす",
  parameters: z.object({
    lesson_type: z.enum(["signal_accuracy", "market_pattern", "risk", "strategy", "info_source"]).describe("学びのタイプ"),
    category: z.enum(["positive", "negative", "neutral"]).describe("カテゴリ"),
    description: z.string().describe("学びの内容"),
    symbol: z.string().nullable().default(null).describe("特定銘柄に紐づく場合"),
    source_strategy: z.string().nullable().default(null).describe("マーケットID"),
    evidence: z.record(z.unknown()).nullable().default(null).describe("根拠データ"),
    ttl_days: z.number().default(30).describe("有効期間（日数）"),
  }),
  execute: async (args) =>
    JSON.stringify(
      await recordLesson(
        args.lesson_type,
        args.category,
        args.description,
        args.symbol,
        args.source_strategy,
        args.evidence,
        args.ttl_days,
      ),
    ),
});

mcp.addTool({
  name: "get_relevant_lessons",
  description: "関連する学びを取得する（Research Agent のプロンプトに注入用）",
  parameters: z.object({
    symbol: z.string().nullable().default(null).describe("特定銘柄に絞る場合"),
    source_strategy: z.string().nullable().default(null).describe("マーケットID でフィルタ"),
    lesson_type: z.string().nullable().default(null).describe("タイプでフィルタ"),
    limit: z.number().default(20).describe("取得件数"),
  }),
  execute: async (args) =>
    JSON.stringify(
      await getRelevantLessons(args.symbol, args.source_strategy, args.lesson_type, args.limit),
    ),
});

mcp.addTool({
  name: "get_signal_accuracy",
  description: "シグナル精度のサマリーを取得する",
  parameters: z.object({
    source_strategy: z.string().nullable().default(null).describe("マーケットID でフィルタ"),
    days: z.number().default(30).describe("過去何日分を集計するか"),
  }),
  execute: async ({ source_strategy, days }) =>
    JSON.stringify(await getSignalAccuracy(source_strategy, days)),
});

// ── Start ──

mcp.start({
  transportType: "stdio",
});
