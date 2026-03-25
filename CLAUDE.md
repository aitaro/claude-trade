# Claude Trade — AI Trading Platform

## 開発方針

- 大規模リファクタを恐れない。構成が正しくないと感じたら積極的に直す
- Biome で lint/format 統一。`npm run lint:fix` で自動修正
- 日付処理は date-fns を使う。`toLocaleString()` は使わない
- フロントの日付フォーマットは `packages/web/src/lib/format.ts` に集約

## アーキテクチャ

三段構成のトレーディングプラットフォーム:

- **Stage 1 (Research Agent)**: Claude Code SDK が Claude を起動 → MCP ツールで市場分析・シグナル生成
- **Stage 2 (Trading Engine)**: Deterministic にリスクチェック・発注
- **Stage 3 (EOD Review)**: 取引振り返り・学習（Claude Code SDK 経由）

## プロジェクト構成

npm workspaces モノレポ:

```
packages/
├── server/           # Backend
│   └── src/
│       ├── mcp-server/      MCP Server (fastmcp TS版)
│       ├── trading-engine/  Deterministic Trading Engine
│       ├── agent/           Agent Runner (Claude Code SDK)
│       ├── api/             tRPC API サーバー
│       ├── db/              共有 DB レイヤー (Drizzle ORM)
│       └── config.ts        共有設定
└── web/              # Dashboard (React + Vite + shadcn/ui)
    └── src/
```

- `prompts/` — Research Agent 用プロンプト
- `strategies/` — 戦略定義 (YAML)
- `scripts/` — 開発用スクリプト

## 開発コマンド

```bash
# 全部一括起動 (tmux)
task dev

# 個別起動
task infra        # Docker (postgres + ib-gateway + pgweb)
task scheduler    # Agent スケジューラ
task api          # tRPC API サーバー (port 3100)
task web          # Web ダッシュボード (port 5173)
task research     # Research Agent 単発実行
task trade        # Trading Engine 単発実行

# DB
npx drizzle-kit push   # スキーマ同期

# Lint & 型チェック
task lint         # Biome check
task lint:fix     # Biome auto-fix
task typecheck    # TypeScript check
```

## MCP サーバー登録

`.claude/mcp.json`:
```json
{
  "mcpServers": {
    "claude-trade": {
      "command": "npx",
      "args": ["tsx", "packages/server/src/mcp-server/server.ts"]
    }
  }
}
```

## DB

PostgreSQL 16 (docker-compose で起動)。テーブルは `packages/server/src/db/schema.ts` で Drizzle ORM で定義。

主要テーブル: signals, research_reports, decisions, orders, risk_state, daily_performance, position_snapshots, account_snapshots, session_logs, signal_outcomes, lessons, news_items

## 安全制約

- Paper Trading のみ（`LIVE_TRADING_ENABLED=false`）
- Kill switch: 日次損失 > 3% で自動発動
- 最大ポジション: NAV の 10%
- 最大日次注文数: 20
- シグナルには有効期限がある（default 8h, premarket 12h）。期限切れは無視される
- Risk Engine の 5-point validation: kill_switch / trading_enabled / position_size / daily_orders / daily_loss
- Research Agent のエラー → シグナルなし → Trading Engine は何もしない（安全側倒し）
