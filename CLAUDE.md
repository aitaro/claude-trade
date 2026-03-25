# Claude Trade — AI Trading Platform

## アーキテクチャ

三段構成のトレーディングプラットフォーム:

- **Stage 1 (Research Agent)**: Agent SDK が Claude を起動 → MCP ツールで市場分析・シグナル生成
- **Stage 2 (Trading Engine)**: Python が DB のシグナルを読み、deterministic にリスクチェック・発注
- **Stage 3 (EOD Review)**: 取引振り返り・学習（Agent SDK 経由）

## プロジェクト構成

- `mcp-server/` — FastMCP サーバー（Research Agent 用ツール群: 16ツール）
- `trading-engine/` — Deterministic Trading Engine（Python）
- `prompts/` — Research Agent 用プロンプト (premarket / research-loop / eod-review / final-judge)
- `strategies/` — 戦略定義 (YAML: watchlist, signal params, risk config)
- `scripts/` — cron 用スクリプト (market check, research runner, trading runner, backup)

## 開発コマンド

```bash
# インフラ起動
docker compose up -d

# MCP サーバー起動
cd mcp-server && uv run python -m claude_trade.server

# Trading Engine 実行
cd trading-engine && uv run python -m trading_engine.main
```

## MCP サーバー登録

`.claude/mcp.json` に以下を追加:
```json
{
  "mcpServers": {
    "claude-trade": {
      "command": "uv",
      "args": ["run", "--directory", "mcp-server", "python", "-m", "claude_trade.server"],
      "env": {}
    }
  }
}
```

## DB

PostgreSQL 16 (docker-compose で起動)。テーブルは `mcp-server/src/claude_trade/models.py` で定義。
`init_db()` で自動マイグレーション (create_all)。

主要テーブル: signals, research_reports, decisions, orders, risk_state, daily_performance, position_snapshots, account_snapshots, session_logs

## 安全制約

- Paper Trading のみ（`live_trading_enabled = false`）
- Kill switch: 日次損失 > 3% で自動発動
- 最大ポジション: NAV の 10%
- 最大日次注文数: 20
- シグナルには有効期限がある（default 8h, premarket 12h）。期限切れは無視される
- Risk Engine の 5-point validation: kill_switch / trading_enabled / position_size / daily_orders / daily_loss
- Research Agent のエラー → シグナルなし → Trading Engine は何もしない（安全側倒し）
