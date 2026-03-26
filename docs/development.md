# 開発ガイド

## セットアップ

```bash
# 依存関係インストール
pnpm install

# Docker インフラ起動 (PostgreSQL + IB Gateway)
docker compose up -d

# DB スキーマ同期
npx drizzle-kit push

# .env を作成 (初回のみ)
cp .env.example .env
# TWS_USERID, TWS_PASSWORD, FINNHUB_API_KEY を設定
```

## 開発コマンド

```bash
# tmux で一括起動
task dev

# 個別起動
task infra           # Docker (postgres + ib-gateway + pgweb)
task scheduler       # Agent スケジューラ
task api             # tRPC API サーバー (port 3100)
task web             # Web ダッシュボード (port 5173)
task research        # Research Agent 単発実行
task trade           # Trading Engine 単発実行

# DB
task db:migrate      # スキーマ同期
task db:psql         # psql 接続
task db:signals      # アクティブシグナル表示

# Lint & 型チェック
task lint            # Biome check
task lint:fix        # Biome auto-fix
task typecheck       # TypeScript check

# GCE
task gce:log         # GCE ログを tmux 4ペインで表示
task gce:ssh         # GCE に SSH
task gce:status      # GCE サービス状態確認
```

## プロジェクト構成

```
packages/
├── server/
│   └── src/
│       ├── agent/            # Agent Runner (Claude Code SDK)
│       │   ├── main.ts       # エントリポイント (run / scheduler)
│       │   ├── runner.ts     # Claude SDK query 実行
│       │   ├── scheduler.ts  # node-cron ジョブ管理
│       │   ├── markets.ts    # マーケット定義 (US/JP/EU/UK)
│       │   ├── market.ts     # 市場開閉判定
│       │   └── snapshots.ts  # IB スナップショット取得
│       ├── mcp-server/       # MCP Server (fastmcp TS版)
│       ├── trading-engine/   # Deterministic Trading Engine
│       ├── api/              # tRPC API サーバー
│       ├── db/               # Drizzle ORM + PostgreSQL
│       │   ├── schema.ts     # テーブル定義
│       │   └── client.ts     # DB 接続
│       ├── lib/
│       │   └── logger.ts     # pino 構造化ロギング
│       └── config.ts         # 共有設定・環境変数
└── web/                      # Dashboard (React + Vite + shadcn/ui)

deploy/                       # GCE デプロイ設定
prompts/                      # Research Agent プロンプト
strategies/                   # 戦略定義 (YAML)
docs/                         # ドキュメント (VitePress)
```

## 技術スタック

| カテゴリ | ツール |
|---|---|
| ランタイム | Node.js 22 + TypeScript |
| パッケージマネージャ | pnpm |
| DB | PostgreSQL 16 + Drizzle ORM |
| API | tRPC |
| フロントエンド | React 19 + Vite + Tailwind + shadcn/ui |
| IB 接続 | @stoqey/ib |
| AI | Claude Code SDK (@anthropic-ai/claude-code) |
| MCP | fastmcp (TypeScript) |
| スケジューラ | node-cron |
| ログ | pino + pino-pretty |
| Lint/Format | Biome |
| ドキュメント | VitePress |
