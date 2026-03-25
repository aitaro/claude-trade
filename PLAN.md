# Plan: Claude Trade — Python → TypeScript 全面移行

## Context

Claude Trade は現在 Python 3パッケージ構成（mcp-server, trading-engine, agent）で動作している。Claude Code 自体が TypeScript で書かれており、SDK も TS 版が本家。IB 接続ライブラリも Python/TS ともにコミュニティ製で差がない。コードベースを TS に統一してメンテナンス性を向上させる。

現行 Python コードと `docs/` を仕様書として使い、TS で完全に書き直す。

## Tech Stack

| 役割 | パッケージ |
|---|---|
| Agent SDK | `@anthropic-ai/claude-code` |
| MCP Server | `fastmcp` (TS版 v3.34) |
| IB Client | `@stoqey/ib` (v1.5.3) |
| DB ORM | `drizzle-orm` + `pg` |
| Scheduler | `node-cron` |
| Validation | `zod` |
| Runtime | `tsx` (dev) / `tsc` (build) |

## プロジェクト構成

Python の3パッケージ構成を monorepo に統合:

```
claude-trade/
├── src/
│   ├── mcp-server/          # MCP Server (fastmcp)
│   │   ├── server.ts        # エントリポイント
│   │   ├── tools/
│   │   │   ├── market-data.ts
│   │   │   ├── portfolio.ts
│   │   │   ├── signals.ts
│   │   │   ├── research.ts
│   │   │   ├── news.ts
│   │   │   ├── audit.ts
│   │   │   ├── analytics.ts
│   │   │   └── feedback.ts
│   │   └── ib-client.ts     # @stoqey/ib ラッパー
│   ├── trading-engine/      # Trading Engine
│   │   ├── main.ts          # エントリポイント
│   │   ├── signal-reader.ts
│   │   ├── portfolio-calc.ts
│   │   ├── risk-engine.ts
│   │   ├── executor.ts
│   │   ├── kill-switch.ts
│   │   └── audit.ts
│   ├── agent/               # Agent Runner
│   │   ├── main.ts          # CLI (run / scheduler)
│   │   ├── runner.ts        # Claude Code SDK 呼び出し
│   │   ├── scheduler.ts     # node-cron ジョブ管理
│   │   ├── markets.ts       # マーケット定義
│   │   └── market.ts        # 市場開閉判定
│   └── db/                  # 共有 DB レイヤー
│       ├── schema.ts        # Drizzle スキーマ定義 (全テーブル)
│       ├── client.ts        # DB 接続
│       └── migrate.ts       # マイグレーション
├── drizzle/                 # マイグレーションファイル
├── prompts/                 # そのまま流用
├── strategies/              # そのまま流用
├── scripts/
│   ├── dev-tmux.sh          # そのまま流用
│   └── ib-gateway-entrypoint.sh
├── docs/                    # そのまま流用
├── docker-compose.yml       # postgres + ib-gateway + pgweb (変更なし)
├── Taskfile.yml             # コマンド更新
├── package.json
├── tsconfig.json
└── .env
```

**Python との違い:**
- 3つの独立パッケージ → 1つの monorepo (`src/` 配下)
- DB スキーマを `src/db/` に共有（Python では `sys.path.insert` で無理やり共有していた）
- `pyproject.toml` × 3 → `package.json` × 1

## 実装フェーズ

### Phase 1: 基盤セットアップ
- `package.json`, `tsconfig.json` 作成
- 依存パッケージインストール
- `src/db/schema.ts` — Drizzle で全14テーブル定義
- `src/db/client.ts` — DB 接続
- `src/db/migrate.ts` — マイグレーション

### Phase 2: MCP Server
- `src/mcp-server/server.ts` — fastmcp セットアップ
- `src/mcp-server/ib-client.ts` — @stoqey/ib ラッパー（reqMktData, reqHistoricalData, placeOrder, portfolio, accountSummary, FX rate）
- `src/mcp-server/tools/*.ts` — 全20ツールを移植

### Phase 3: Trading Engine
- `src/trading-engine/signal-reader.ts`
- `src/trading-engine/portfolio-calc.ts`
- `src/trading-engine/risk-engine.ts`
- `src/trading-engine/executor.ts`
- `src/trading-engine/kill-switch.ts`
- `src/trading-engine/audit.ts`
- `src/trading-engine/main.ts` — CLI エントリポイント（--market 対応、複数市場対応）

### Phase 4: Agent Runner
- `src/agent/markets.ts` — マーケット定義（4市場）
- `src/agent/market.ts` — 市場開閉判定
- `src/agent/runner.ts` — Claude Code SDK 呼び出し
- `src/agent/scheduler.ts` — node-cron ジョブ管理
- `src/agent/main.ts` — CLI（run / scheduler）

### Phase 5: 統合・テスト
- `Taskfile.yml` 更新（`uv run python` → `npx tsx`）
- `scripts/dev-tmux.sh` 更新
- Docker compose は変更なし（インフラのみ）
- 動作確認: Research → Signal → Trading → Order の E2E フロー

## 主要ファイルの対応表

| Python | TypeScript | 備考 |
|---|---|---|
| `mcp-server/src/claude_trade/models.py` | `src/db/schema.ts` | SQLModel → Drizzle |
| `mcp-server/src/claude_trade/db.py` | `src/db/client.ts` | asyncpg → pg |
| `mcp-server/src/claude_trade/server.py` | `src/mcp-server/server.ts` | fastmcp (Python) → fastmcp (TS) |
| `mcp-server/src/claude_trade/ib_client.py` | `src/mcp-server/ib-client.ts` | ib_insync → @stoqey/ib |
| `mcp-server/src/claude_trade/tools/*.py` | `src/mcp-server/tools/*.ts` | 1:1 移植 |
| `trading-engine/src/trading_engine/main.py` | `src/trading-engine/main.ts` | nest_asyncio 不要 |
| `trading-engine/src/trading_engine/executor.py` | `src/trading-engine/executor.ts` | @stoqey/ib 直接使用 |
| `agent/src/agent_runner/runner.py` | `src/agent/runner.ts` | claude-code-sdk (Python) → @anthropic-ai/claude-code |
| `agent/src/agent_runner/scheduler.py` | `src/agent/scheduler.ts` | apscheduler → node-cron |
| `agent/src/agent_runner/markets.py` | `src/agent/markets.ts` | dataclass → type/const |

## Taskfile 更新

```yaml
research:
  dir: .
  cmds:
    - npx tsx src/agent/main.ts run {{.CLI_ARGS | default "intraday --market us"}}

trade:
  dir: .
  cmds:
    - npx tsx src/trading-engine/main.ts {{.CLI_ARGS | default "--market us"}}

scheduler:
  dir: .
  cmds:
    - npx tsx src/agent/main.ts scheduler
```

## 検証方法

1. `task infra` で Docker 起動（postgres + ib-gateway + pgweb）
2. `npx tsx src/db/migrate.ts` でテーブル作成
3. `task research -- intraday --market uk` で Research Agent 実行 → signals テーブルにレコード確認
4. `task trade -- --market uk` で Trading Engine 実行 → orders テーブルに約定記録確認
5. `task dev` で tmux 起動 → スケジューラが30分ごとにジョブ実行確認
6. pgweb (localhost:8081) で全テーブルのデータ確認

## リスクと対策

| リスク | 対策 |
|---|---|
| @stoqey/ib の API が ib_insync と異なる | EventEmitter ベースなので Promise ラッパーを書く |
| Claude Code TS SDK の API 差異 | Python 版で動作確認済みの機能のみ使用 |
| DB マイグレーション | 既存 Python テーブルと同じスキーマで Drizzle 定義、既存データはそのまま |

## ADR (Architecture Decision Records)

技術選定の根拠は `docs/adr/` に記録:
- [ADR-001: TypeScript 移行](../../docs/adr/001-typescript-migration.md)
- [ADR-002: ORM に Drizzle を選定](../../docs/adr/002-orm-selection.md)
- [ADR-003: IB Client に @stoqey/ib を選定](../../docs/adr/003-ib-client-library.md)
