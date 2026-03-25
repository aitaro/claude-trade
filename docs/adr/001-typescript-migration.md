# ADR-001: Python → TypeScript 全面移行

**Status:** Accepted
**Date:** 2026-03-25

## Context

Claude Trade は Python 3パッケージ構成で構築された。しかし:
- Claude Code 自体が TypeScript で書かれており、SDK も TS 版が本家
- IB 接続ライブラリは Python/TS ともにコミュニティ製（ib_insync の作者は死去、@stoqey/ib は活発にメンテ中）
- 3パッケージ間の models 共有が `sys.path.insert` ハックに依存
- ユーザーの TS への preference

## Decision

Python から TypeScript へ全面移行する。

## Tech Stack

| 役割 | Python (現行) | TypeScript (移行先) |
|---|---|---|
| Agent SDK | claude-code-sdk | @anthropic-ai/claude-code |
| MCP Server | fastmcp (Python) | fastmcp (TS v3.34) |
| IB Client | ib_insync | @stoqey/ib v1.5.3 |
| DB ORM | sqlmodel + asyncpg | drizzle-orm + pg |
| Scheduler | apscheduler | node-cron |
| Validation | pydantic | zod |

## Consequences

- コードベースが単一言語に統一され、メンテナンス性向上
- 3パッケージ → monorepo 統合で DB スキーマ共有が自然に
- @stoqey/ib のコミュニティサイズが小さいリスクあり（Stars 287、1人メンテナー）
- 既存 Python コードは仕様書として保持
