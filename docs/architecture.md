# アーキテクチャ

## 概要

Claude Trade は3ステージ構成の AI トレーディングプラットフォーム。

```
Stage 1: Research Agent (Claude + MCP) → シグナル生成
Stage 2: Trading Engine (Python)       → リスクチェック・発注
Stage 3: EOD Review (Claude + MCP)     → 振り返り・自己学習
```

AI（Claude）が確率的な判断（何を買うか）を担当し、Python が決定論的な処理（リスクチェック・発注）を担当する。この分離により、AI のミスが直接発注に繋がらない安全設計を実現している。

## コンポーネント

### Agent Runner (`agent/`)

Claude Code SDK を使って Claude をプログラマティックに起動する。APScheduler で各市場のスケジュールを管理し、30分ごとに Research → Trading のサイクルを回す。

- `runner.py` — Claude Code SDK の `query()` を呼び出し、プロンプト + マーケットコンテキストを注入
- `scheduler.py` — 4市場 × 3タイプ（premarket/intraday/eod）= 12ジョブを管理
- `markets.py` — マーケット定義（時間帯、祝日、取引所、通貨）
- `market.py` — 市場開閉判定

### MCP Server (`mcp-server/`)

FastMCP で構築された Claude 用ツール群。Claude はこれらのツールを呼び出してデータ取得・シグナル書き込みを行う。

| カテゴリ | ツール | 用途 |
|---|---|---|
| Market Data | `get_quote`, `get_historical_data`, `get_market_snapshot` | IB Gateway 経由で株価取得 |
| Portfolio | `get_positions`, `get_account_summary` | ポジション・口座情報 |
| Signals | `write_signal`, `get_active_signals` | シグナルの読み書き |
| Research | `write_research_report`, `get_recent_reports` | レポート保存・参照 |
| News | `get_news`, `search_news`, `get_economic_calendar` | ニュース・経済指標 |
| Audit | `get_decision_history`, `get_order_history`, `get_session_logs` | 取引履歴 |
| Analytics | `query_performance`, `get_trade_stats` | 成績分析 |
| Feedback | `evaluate_signal`, `record_lesson`, `get_relevant_lessons`, `get_signal_accuracy` | 自己学習 |

### Trading Engine (`trading-engine/`)

DB のシグナルを読み取り、deterministic にリスクチェック・発注を行う。Claude は一切介在しない。

処理フロー:
1. `signal_reader` — アクティブシグナルを DB から読み取り（market ID でフィルタ）
2. `kill_switch` — 日次損失チェック
3. `portfolio_calc` — シグナルから目標株数を計算、注文リストを生成
4. `risk_engine` — 5点バリデーション（後述）
5. `executor` — IB Gateway に成行注文を送信、約定を最大30秒待機

### インフラ (Docker)

| サービス | イメージ | ポート | 用途 |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | データベース |
| ib-gateway | ghcr.io/gnzsnz/ib-gateway:stable | 4002 | IB API Gateway (Paper Trading) |
| pgweb | sosedoff/pgweb | 8081 | DB GUI |

Agent Runner はローカルで実行（Claude Code の認証がホストの Keychain に依存するため）。

## データフロー

```
Claude (Research)
  → MCP: write_signal(AAPL, buy, 0.8, confidence=0.7)
  → DB: signals テーブルに INSERT

Trading Engine
  → DB: signals テーブルから SELECT (source_strategy="us", is_active=true, expires_at > now)
  → IB: get_nav(), get_positions(), get_current_prices()
  → NAV を取引通貨に変換 (JPY → USD/GBP/EUR)
  → portfolio_calc: 目標株数計算
  → risk_engine: 5点チェック
  → IB: placeOrder(MarketOrder)
  → DB: decisions, orders テーブルに INSERT

Claude (EOD Review)
  → MCP: evaluate_signal() で各シグナルの正誤を記録
  → MCP: record_lesson() で学びを DB に保存
  → 翌日の Research で get_relevant_lessons() が学びをプロンプトに注入
```
