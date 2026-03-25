# Claude Trade — AI Trading Platform

## アーキテクチャ

三段構成のトレーディングプラットフォーム:

- **Stage 1 (Research Agent)**: Claude Code SDK が Claude を起動 → MCP ツールで市場分析・シグナル生成
- **Stage 2 (Trading Engine)**: Deterministic にリスクチェック・発注
- **Stage 3 (EOD Review)**: 取引振り返り・学習（Claude Code SDK 経由）

## プロジェクト構成

TypeScript monorepo (`src/` 配下):

- `src/mcp-server/` — MCP Server (fastmcp TS版)
- `src/trading-engine/` — Deterministic Trading Engine
- `src/agent/` — Agent Runner (Claude Code SDK)
- `src/db/` — 共有 DB レイヤー (Drizzle ORM)
- `src/config.ts` — 共有設定
- `prompts/` — Research Agent 用プロンプト
- `strategies/` — 戦略定義 (YAML)
- `scripts/` — cron 用スクリプト

## 開発コマンド

```bash
# インフラ起動
docker compose up -d

# DB スキーマ同期
npx drizzle-kit push

# MCP サーバー起動
npx tsx src/mcp-server/server.ts

# Trading Engine 実行
npx tsx src/trading-engine/main.ts --market us

# Research Agent 実行
npx tsx src/agent/main.ts run intraday --market us

# スケジューラ起動
npx tsx src/agent/main.ts scheduler

# 型チェック
npx tsc --noEmit
```

## MCP サーバー登録

`.claude/mcp.json` に以下を追加:
```json
{
  "mcpServers": {
    "claude-trade": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server/server.ts"]
    }
  }
}
```

## DB

PostgreSQL 16 (docker-compose で起動)。テーブルは `src/db/schema.ts` で Drizzle ORM で定義。
`npx drizzle-kit push` でスキーマ同期。

主要テーブル: signals, research_reports, decisions, orders, risk_state, daily_performance, position_snapshots, account_snapshots, session_logs, signal_outcomes, lessons, news_items

## 安全制約

- Paper Trading のみ（`LIVE_TRADING_ENABLED=false`）
- Kill switch: 日次損失 > 3% で自動発動
- 最大ポジション: NAV の 10%
- 最大日次注文数: 20
- シグナルには有効期限がある（default 8h, premarket 12h）。期限切れは無視される
- Risk Engine の 5-point validation: kill_switch / trading_enabled / position_size / daily_orders / daily_loss
- Research Agent のエラー → シグナルなし → Trading Engine は何もしない（安全側倒し）
