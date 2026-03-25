# 開発ガイド

## セットアップ

```bash
# 初回
task setup

# .env を編集
# TWS_USERID, TWS_PASSWORD, FINNHUB_API_KEY を設定
```

## 開発環境

```bash
# tmux で一括起動（Docker + スケジューラ + ログ）
task dev

# 後から接続
task dev:attach

# 停止
task dev:stop
```

tmux ウィンドウ構成:

| Window | 名前 | 内容 |
|--------|------|------|
| 0 (上ペイン) | scheduler | Agent スケジューラ |
| 0 (下ペイン) | logs | Docker コンテナログ |
| 1 | shell | 作業用シェル |
| 2 | db | DB 操作用 |

操作: `Ctrl-b o` でペイン切り替え、`Ctrl-b n` でウィンドウ切り替え、`Ctrl-b z` でペイン最大化。

## コマンド一覧

```bash
task --list              # 全コマンド一覧

# Research Agent
task research -- intraday --market us
task research -- premarket --market jp
task research -- eod --market eu

# Trading Engine
task trade -- --market us
task trade -- --market uk,eu   # 複数市場を1接続で処理

# DB
task db:signals          # アクティブシグナル一覧
task db:web              # pgweb GUI を開く
task db:psql             # psql 接続

# インフラ
task infra               # Docker 起動
task infra:stop          # Docker 停止
task infra:logs          # Docker ログ
```

## プロジェクト構成

```
claude-trade/
├── agent/                    # Agent Runner (claude-code-sdk)
│   ├── src/agent_runner/
│   │   ├── main.py           # CLI エントリポイント (run / scheduler)
│   │   ├── runner.py         # Claude Code SDK で Research Agent を実行
│   │   ├── scheduler.py      # APScheduler でジョブ管理
│   │   ├── markets.py        # マーケット定義レジストリ
│   │   ├── market.py         # 市場開閉判定
│   │   └── config.py         # 設定
│   └── pyproject.toml
├── mcp-server/               # FastMCP Server (Claude 用ツール)
│   ├── src/claude_trade/
│   │   ├── server.py         # MCP サーバーエントリポイント
│   │   ├── models.py         # SQLModel テーブル定義
│   │   ├── db.py             # DB 接続・初期化
│   │   ├── config.py         # 設定
│   │   ├── ib_client.py      # IB Gateway クライアント
│   │   └── tools/            # MCP ツール群
│   │       ├── market_data.py
│   │       ├── portfolio.py
│   │       ├── signals.py
│   │       ├── research.py
│   │       ├── news.py
│   │       ├── audit.py
│   │       ├── analytics.py
│   │       └── feedback.py   # フィードバックループ
│   └── pyproject.toml
├── trading-engine/           # Deterministic Trading Engine
│   ├── src/trading_engine/
│   │   ├── main.py           # メインループ (--market 対応)
│   │   ├── signal_reader.py  # DB からシグナル読み取り
│   │   ├── portfolio_calc.py # 目標株数計算・注文生成
│   │   ├── risk_engine.py    # 5点リスクチェック
│   │   ├── executor.py       # IB 発注 + 為替レート取得
│   │   ├── kill_switch.py    # Kill Switch 管理
│   │   ├── audit.py          # 判断・セッション記録
│   │   └── config.py
│   └── pyproject.toml
├── prompts/                  # Research Agent 用プロンプト
│   ├── premarket-analysis.md
│   ├── research-loop.md
│   ├── eod-review.md
│   └── final-judge.md
├── strategies/               # 戦略定義 (YAML)
│   ├── us.yaml
│   ├── jp.yaml
│   ├── eu.yaml
│   └── uk.yaml
├── scripts/
│   ├── dev-tmux.sh           # 開発環境 tmux 起動
│   ├── ib-gateway-entrypoint.sh  # IB Gateway 再起動遅延ラッパー
│   └── is_market_open.py
├── docs/                     # ドキュメント
├── docker-compose.yml
├── Taskfile.yml
├── CLAUDE.md
└── README.md
```

## 依存関係

各パッケージは独立した venv を持つ（uv で管理）:

- `agent/` — claude-code-sdk, apscheduler, pytz, pydantic-settings
- `mcp-server/` — fastmcp, sqlalchemy, asyncpg, sqlmodel, ib_insync, httpx, finnhub-python
- `trading-engine/` — sqlalchemy, asyncpg, sqlmodel, ib_insync, pydantic-settings, pyyaml, nest-asyncio, greenlet

パッケージ間でコードを共有する場合は `sys.path.insert` で `mcp-server/src` を参照（models.py の共有）。

## IB Gateway の注意点

- Paper Trading のみ対応
- `network_mode: host` で実行（ホストからの接続を許可するため）
- モバイル/Web ログインで切断された場合、3分待機後に自動再接続
- マーケットデータは delayed-frozen モード（`reqMarketDataType(4)`）
- IB Web Portal にログインしていると `competing live session` エラーが出る → ログアウトして Gateway 再起動
