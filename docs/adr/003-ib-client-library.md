# ADR-003: IB Client に @stoqey/ib を選定

**Status:** Accepted
**Date:** 2026-03-25

## Context

Interactive Brokers の API は公式では C++/Java/C# のみ。Python/TypeScript はコミュニティ製ラッパーしかない。

| ライブラリ | 言語 | Stars | メンテナー | 状態 |
|---|---|---|---|---|
| ib_insync | Python | 2,700 | Ewald de Wit | 作者死去 (2024)、ib_async に fork |
| @stoqey/ib | TypeScript | 287 | Ceddy Muhoza | 活発にメンテ中 (2025/10 最終更新) |

## Decision

**@stoqey/ib v1.5.3** を採用する。

## Rationale

1. Python の ib_insync も作者死去でコミュニティ fork に依存しており、リスクは同等
2. 使用する IB API は基本的な5機能のみ（reqMktData, reqHistoricalData, placeOrder, portfolio, accountSummary）
3. これらは IB の安定 API で、ライブラリのバグリスクが低い領域
4. TS 統一による開発効率向上がリスクを上回る
5. 最悪、IB 公式 Java API ドキュメントを参照して自前ラッパーを書ける規模

## Risks & Mitigations

| リスク | 確率 | 対策 |
|---|---|---|
| メンテナー離脱 | 中 | fork して自前メンテ（Java API の直接ポートなので構造は単純） |
| バグ | 中 | Paper Trading で十分テスト、基本機能のみ使用 |
| API 互換性崩壊 | 低 | IB の安定 API のみ使用 |
| テスト不足 | 中 | 自前で E2E テストを書く |
