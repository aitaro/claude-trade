# Claude Trade — AI Trading Platform

AI による自動トレーディングプラットフォーム。Claude が市場分析・シグナル生成を行い、Deterministic な Trading Engine がリスクチェック・発注を実行する。

## システム全体像

```mermaid
graph TB
    subgraph Scheduling["⏰ スケジューラ (cron)"]
        CRON_PRE["5:50 AM<br/>premarket"]
        CRON_INTRA["9:30-15:30<br/>intraday (30-60min毎)"]
        CRON_TRADE["10:00 AM~<br/>trading engine"]
        CRON_EOD["4:15 PM<br/>eod-review"]
    end

    subgraph Stage1["Stage 1: Research Agent"]
        direction TB
        SDK["Agent SDK (Python)<br/>claude_agent_sdk.query()"]
        PROMPTS["プロンプト<br/>premarket / research-loop / eod-review"]
        CLAUDE["Claude (LLM)"]
        SDK -->|プロンプト注入| CLAUDE
        PROMPTS -->|読み込み| SDK
    end

    subgraph MCP["MCP Server (FastMCP)"]
        direction TB
        T_MARKET["get_quote<br/>get_historical_data<br/>get_market_snapshot"]
        T_PORT["get_positions<br/>get_account_summary"]
        T_SIGNAL["write_signal<br/>get_active_signals"]
        T_NEWS["get_news<br/>search_news<br/>get_economic_calendar"]
        T_RESEARCH["write_research_report<br/>get_recent_reports"]
        T_AUDIT["get_decision_history<br/>get_order_history<br/>get_session_logs"]
        T_ANALYTICS["query_performance<br/>get_trade_stats"]
    end

    subgraph DB["PostgreSQL 16"]
        SIGNALS[("signals")]
        REPORTS[("research_reports")]
        DECISIONS[("decisions")]
        ORDERS[("orders")]
        RISK[("risk_state")]
        PERF[("daily_performance")]
        SNAPSHOTS[("position/account<br/>snapshots")]
    end

    subgraph Stage2["Stage 2: Trading Engine (Python)"]
        direction TB
        SIG_READ["Signal Reader<br/>get_latest_signal_per_symbol()"]
        KILL["Kill Switch Check<br/>daily loss > 3% → halt"]
        CALC["Portfolio Calculator<br/>signal → target shares"]
        RISK_ENG["Risk Engine<br/>5-point validation"]
        EXEC["Executor<br/>MarketOrder → IBKR"]
        SIG_READ --> KILL --> CALC --> RISK_ENG --> EXEC
    end

    subgraph Infra["インフラ (Docker)"]
        IB["IB Gateway<br/>Paper Trading<br/>port 4002"]
        PG["PostgreSQL<br/>port 5432"]
    end

    subgraph Strategy["戦略定義"]
        YAML["strategies/default.yaml<br/>watchlist / signal params<br/>position limits / risk"]
    end

    %% Scheduling connections
    CRON_PRE --> SDK
    CRON_INTRA --> SDK
    CRON_TRADE --> SIG_READ
    CRON_EOD --> SDK

    %% Stage 1 flow
    CLAUDE <-->|ツール呼び出し| MCP
    T_MARKET <-->|市場データ| IB
    T_PORT <-->|ポジション| IB
    T_SIGNAL -->|書き込み| SIGNALS
    T_RESEARCH -->|書き込み| REPORTS
    T_AUDIT -->|読み取り| DECISIONS
    T_AUDIT -->|読み取り| ORDERS
    T_ANALYTICS -->|読み取り| PERF

    %% Stage 2 flow
    SIG_READ -->|読み取り| SIGNALS
    EXEC -->|発注| IB
    EXEC -->|記録| ORDERS
    RISK_ENG -->|記録| DECISIONS
    KILL <-->|状態確認/更新| RISK

    %% Strategy
    YAML -.->|パラメータ参照| CLAUDE
    YAML -.->|リスク設定| RISK_ENG

    style Stage1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style Stage2 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style MCP fill:#16213e,stroke:#533483,color:#fff
    style DB fill:#0f3460,stroke:#e94560,color:#fff
    style Infra fill:#1a1a2e,stroke:#533483,color:#fff
    style Scheduling fill:#162447,stroke:#e94560,color:#fff
```

## データフロー

```mermaid
sequenceDiagram
    participant Cron as ⏰ Cron
    participant SDK as Agent SDK
    participant Claude as Claude (LLM)
    participant MCP as MCP Server
    participant DB as PostgreSQL
    participant TE as Trading Engine
    participant IB as IB Gateway

    Note over Cron,IB: Stage 1: Research (5:50 AM / 30-60min毎)
    Cron->>SDK: プロンプト実行
    SDK->>Claude: research-loop.md
    Claude->>MCP: get_quote(AAPL)
    MCP->>IB: 市場データ取得
    IB-->>MCP: price, volume...
    MCP-->>Claude: quote data
    Claude->>MCP: get_news(AAPL)
    MCP-->>Claude: news items
    Claude->>Claude: 分析・判断
    Claude->>MCP: write_signal(AAPL, buy, 0.8)
    MCP->>DB: INSERT signals
    Claude->>MCP: write_research_report(...)
    MCP->>DB: INSERT research_reports

    Note over Cron,IB: Stage 2: Trading Engine (10:00 AM~)
    Cron->>TE: 起動
    TE->>DB: read active signals
    DB-->>TE: signals[]
    TE->>TE: kill switch check
    TE->>IB: get NAV, positions
    IB-->>TE: account state
    TE->>TE: calculate target shares
    TE->>TE: risk check (5-point)
    TE->>DB: INSERT decision
    TE->>IB: place MarketOrder
    IB-->>TE: order_id
    TE->>DB: INSERT order

    Note over Cron,IB: Stage 3: EOD Review (4:15 PM)
    Cron->>SDK: eod-review.md
    SDK->>Claude: 振り返り指示
    Claude->>MCP: get_order_history()
    MCP->>DB: SELECT orders
    DB-->>MCP: today's orders
    MCP-->>Claude: order data
    Claude->>MCP: query_performance()
    Claude->>Claude: 学びを抽出
    Claude->>MCP: write_research_report(eod)
    MCP->>DB: INSERT eod report
```

## 安全制約

| 制約 | 値 |
|------|-----|
| Trading Mode | Paper Trading のみ |
| Kill Switch | 日次損失 > 3% で自動発動 |
| 最大ポジション | NAV の 10% |
| 最大日次注文数 | 20 |
| シグナル TTL | default 8h / premarket 12h |
| Risk Check | 5-point validation (kill_switch / trading_enabled / position_size / daily_orders / daily_loss) |

## 対応マーケット

| マーケット | 取引所 | 通貨 | 戦略ファイル | Premarket | Intraday (30分毎) | EOD |
|---|---|---|---|---|---|---|
| US | NYSE/NASDAQ | USD | `strategies/us.yaml` | 5:50 ET | 9:05-15:35 ET | 16:15 ET |
| JP | TSE | JPY | `strategies/jp.yaml` | 8:00 JST | 9:05-14:35 JST | 15:15 JST |
| EU | LSE/Euronext | EUR | `strategies/eu.yaml` | 7:00 GMT | 8:05-15:35 GMT | 16:45 GMT |

## セットアップ

```bash
# 初回セットアップ
task setup
# .env を編集 (TWS_USERID, TWS_PASSWORD, FINNHUB_API_KEY)
```

## 実行方法

### 開発環境（tmux 一括起動）

```bash
# tmux で全環境を起動 (Docker インフラ + スケジューラ + ログ + 作業シェル)
task dev

# 後からセッションに接続
task dev:attach
# or: tmux attach -t claude-trade

# 停止
task dev:stop
```

tmux ウィンドウ構成:
| Window | 名前 | 内容 |
|--------|------|------|
| 0 | scheduler | Agent スケジューラ (30分毎に Research + Trading) |
| 1 | logs | Docker コンテナログ |
| 2 | shell | 作業用シェル |
| 3 | db | DB 操作用 |

### 単発実行

```bash
# Research Agent
task research -- intraday --market us
task research -- premarket --market jp
task research -- eod --market eu

# Trading Engine
task trade -- --market us

# DB 確認
task db:signals    # アクティブシグナル一覧
task db:web        # pgweb GUI (http://localhost:8081)
task db:psql       # psql 接続
```

### 全コマンド一覧

```bash
task --list
```

## ドキュメント

- [アーキテクチャ](docs/architecture.md) — システム全体像、コンポーネント、データフロー
- [マルチマーケット対応](docs/markets.md) — 4市場の設定、スケジュール、通貨変換
- [安全制約・リスク管理](docs/safety.md) — Risk Engine、Kill Switch、ポジション管理
- [フィードバックループ](docs/feedback-loop.md) — 自己学習の仕組み、シグナル評価、学びの蓄積
- [データベース](docs/database.md) — テーブル一覧、主要クエリ
- [開発ガイド](docs/development.md) — セットアップ、コマンド、プロジェクト構成
