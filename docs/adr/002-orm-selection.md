# ADR-002: ORM に Drizzle を選定

**Status:** Accepted
**Date:** 2026-03-25

## Context

TS 移行にあたり、PostgreSQL 用の ORM を選定する必要がある。候補:

| ORM | バンドルサイズ | 特徴 |
|---|---|---|
| Drizzle | 5KB | SQL に近い、依存ゼロ、2025年に Prisma の DL 数を超えた |
| Prisma | 40KB + 50MB | DX 最高、独自 DSL、自動マイグレーション |
| Kysely | 8KB | クエリビルダーのみ（ORM ではない） |
| TypeORM | 中 | レガシー寄り |

## Decision

**Drizzle ORM** を採用する。

## Rationale

1. **軽量**: 5KB でトレーディングアプリのレイテンシに影響しない
2. **型安全**: TypeScript の型推論でスキーマから自動的に型が生成される（コード生成ステップ不要）
3. **SQL 透明性**: 生成される SQL が明確で、何が実行されるか分かる
4. **依存ゼロ**: サプライチェーンリスクが最小
5. **トレンド**: 2025年に Prisma を週間 DL 数で逆転、コミュニティが拡大中

## Trade-offs

- マイグレーション管理は Prisma より手間（SQL ファイルベース）
- Prisma Studio のような GUI は無い（pgweb で代替）
- 情報量は Prisma より少ない（ただし急速に増加中）
