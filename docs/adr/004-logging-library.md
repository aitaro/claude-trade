# ADR-004: ロギングライブラリに pino を選定

**Status:** Accepted
**Date:** 2026-03-25

## Context

現状は全て `console.log` / `console.error` で、タイムスタンプなし・構造化なし。
GCP (Cloud Run / Cloud Logging) へのデプロイを見据え、構造化ロギング基盤が必要になった。

### 要件

- 構造化 JSON 出力（GCP Cloud Logging 互換: `severity` フィールド）
- ローカル開発では見やすい整形出力
- Child logger でコンテキスト付与（module, market, session 等）
- TypeScript サポート
- 高速・軽量

## 候補比較

| | pino | winston | bunyan | consola | tslog |
|---|---|---|---|---|---|
| **GitHub Stars** | 17.6K | 24.4K | 7.2K | 7.2K | 1.6K |
| **npm DL/week** | 15M | 13M | - | 8M | 500K |
| **GCP 互換** | `formatters.level` 5行 | Google公式transport | Google公式transport | 自作reporter必要 | 要設定 |
| **ローカルDX** | pino-pretty (最高) | まあまあ | CLIパイプ必要 | 最高(組込み) | 良い(組込み) |
| **性能** | 最速 (5-10x) | 遅い | 普通 | 良い | 普通 |
| **TypeScript** | 良い(組込み) | まあまあ | @types | 最高(native) | 最高(native) |
| **Bundle size** | ~190KB | ~500KB+依存30個 | ~150KB | ~30KB | ~50KB, 0deps |
| **Child logger** | 最高(k/v bindings) | 良い | 最高 | 弱い(tagのみ) | 良い |
| **メンテ** | 活発 | 活発 | 放置(2019〜) | 活発 | 活発 |

Star History で pino は 2020 年以降の伸びが最も急で、winston を追い抜く勢い。

## Decision

**pino + pino-pretty** を採用する。

- 本番: JSON 出力 → Cloud Logging がそのままパース
- ローカル: pino-pretty transport でカラー付き・タイムスタンプ付きの整形出力
- `logger.child({ module, market })` でコンテキスト付与

## 不採用理由

- **winston**: 性能が 5-10x 劣る。公式 Google transport があるが、JSON を正しく出すだけで十分
- **bunyan**: 2019 年以降メンテ放置。脱落
- **consola**: child logger が tag のみで構造化コンテキストに弱い。CLI/DX 向け
- **tslog**: エコシステムが小さい (1.6K stars, 500K DL/week)。デフォルトの stack trace 取得がオーバーヘッド

## Consequences

- `packages/server/src/lib/logger.ts` に共有 logger を配置
- 全モジュールの `console.log` / `console.error` を pino に順次置換
- GCP デプロイ時は `NODE_ENV=production` で JSON 出力に自動切替
