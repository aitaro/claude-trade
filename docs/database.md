# データベース

## 概要

PostgreSQL 16 (Docker) を使用。全テーブルは `mcp-server/src/claude_trade/models.py` で SQLModel により定義。`init_db()` で自動マイグレーション（create_all）。

接続先: `postgresql+asyncpg://claude_trade:***@localhost:5432/claude_trade`

DB GUI: http://localhost:8081 (pgweb)

## テーブル一覧

### Stage 1 → Stage 2 ブリッジ

| テーブル | 説明 | 書き込み元 | 読み取り元 |
|---|---|---|---|
| `signals` | トレーディングシグナル | Research Agent (MCP) | Trading Engine |
| `research_reports` | 分析レポート | Research Agent (MCP) | EOD Review |

### Trading Engine レコード

| テーブル | 説明 |
|---|---|
| `decisions` | 発注判断記録（risk_checks 結果含む） |
| `orders` | 発注記録（status, fill_price, ib_order_id 含む） |

### スナップショット

| テーブル | 説明 |
|---|---|
| `position_snapshots` | ポジションスナップショット |
| `account_snapshots` | 口座スナップショット |

### リスク・パフォーマンス

| テーブル | 説明 |
|---|---|
| `risk_state` | Kill Switch 状態、日次損失、注文カウント |
| `daily_performance` | 日次成績（PnL, Sharpe, drawdown） |

### フィードバックループ

| テーブル | 説明 |
|---|---|
| `signal_outcomes` | シグナルの事後評価（方向正誤、価格変化） |
| `lessons` | 自己学習の蓄積（パターン、observation_count） |

### その他

| テーブル | 説明 |
|---|---|
| `news_items` | ニュースキャッシュ |
| `session_logs` | Claude セッション記録 |

## 主要なクエリパターン

### アクティブシグナルの取得（Trading Engine）

```sql
SELECT * FROM signals
WHERE is_active = true
  AND expires_at > now()
  AND source_strategy = 'us'
ORDER BY created_at DESC;
```

### シグナル精度の集計

```sql
SELECT signal_type,
       COUNT(*) as total,
       SUM(CASE WHEN direction_correct THEN 1 ELSE 0 END) as correct,
       ROUND(AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END), 4) as accuracy
FROM signal_outcomes
WHERE evaluated_at > now() - interval '30 days'
GROUP BY signal_type;
```

### 有効な学びの取得

```sql
SELECT * FROM lessons
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY confidence DESC, observation_count DESC
LIMIT 20;
```

## タイムスタンプ

全タイムスタンプは UTC（timezone-naive な `datetime`）で保存。`datetime.utcnow()` を使用。

基準通貨は JPY だが、DB には通貨情報は含まない。通貨変換は Trading Engine のランタイムで行う。
