# フィードバックループ（自己学習）

## 概要

Claude Trade は自己学習の仕組みを持つ。EOD Review でシグナルの正誤を評価し、パターンを「学び」として DB に蓄積する。翌日の Research Agent は蓄積された学びをプロンプトに注入して分析精度を改善する。

```
Research Agent
  ├── get_relevant_lessons() → 過去の学びを参照して分析
  └── write_signal() → 学びを反映したシグナル生成
       ↓
Trading Engine → 発注 → 約定
       ↓
EOD Review
  ├── evaluate_signal() → 各シグナルの正誤を数値で記録
  ├── record_lesson()   → パターンを学びとして保存
  └── get_signal_accuracy() → 精度傾向を確認
       ↓
翌日の Research Agent ← get_relevant_lessons() で学びが注入される
```

## DB テーブル

### signal_outcomes

シグナルの事後評価を記録する。

| カラム | 型 | 説明 |
|---|---|---|
| signal_id | UUID | 評価対象のシグナル |
| symbol | str | 銘柄 |
| signal_type | str | 元のシグナル (buy/sell/hold/avoid) |
| strength / confidence | float | 元のシグナルの強度・確信度 |
| price_at_signal | float | シグナル発行時の価格 |
| price_at_eval | float | 評価時の価格 |
| price_change_pct | float | 価格変化率 |
| direction_correct | bool | 方向は合っていたか |
| pnl | float | 実現損益（取引があった場合） |
| evaluation | str | Claude による事後評価テキスト |

### lessons

繰り返し観測されるパターンや学びを蓄積する。

| カラム | 型 | 説明 |
|---|---|---|
| lesson_type | str | signal_accuracy / market_pattern / risk / strategy / info_source |
| category | str | positive / negative / neutral |
| symbol | str? | 特定銘柄に紐づく場合 |
| source_strategy | str? | マーケット ID (us, jp, eu, uk) |
| description | str | 学びの内容 |
| evidence | JSONB | 根拠データ |
| confidence | float | この学び自体の確度（繰り返し観測されるほど上がる） |
| observation_count | int | 同パターンの観測回数 |
| expires_at | datetime | 有効期限（デフォルト30日で自然消滅） |

## MCP ツール

### evaluate_signal

シグナルの事後評価を記録する。EOD Review で呼ばれる。

```
evaluate_signal(
  signal_id="...",
  price_at_signal=252.60,
  price_at_eval=255.30,
  evaluation="方向は合っていた。テック株の反発を正しく予測。ただし strength 0.45 は控えめすぎた",
  pnl=4200.0
)
```

方向の正誤は自動判定:
- buy → 価格上昇なら正解
- sell → 価格下落なら正解
- avoid → 価格下落なら正解（避けて正解）
- hold → 価格変動 ±2% 以内なら正解

### record_lesson

学びを保存する。同じ `description` の lesson が既にある場合、`observation_count` が自動的に増加し、`confidence` が 0.1 ずつ上がる。

```
record_lesson(
  lesson_type="signal_accuracy",
  category="negative",
  description="GSK は決算前1週間に過剰に bullish なシグナルを出す傾向",
  symbol="GSK",
  source_strategy="uk",
  evidence={"accuracy": 0.3, "sample_size": 4, "signal_ids": [...]},
  ttl_days=30
)
```

### get_relevant_lessons

Research Agent のプロンプトに注入するための学びを取得する。confidence と observation_count の降順で返す。

```
get_relevant_lessons(
  source_strategy="us",
  symbol="AAPL",  # AAPL固有 + 汎用の両方を取得
  limit=20
)
```

### get_signal_accuracy

シグナル精度のサマリーを取得する。

```
get_signal_accuracy(source_strategy="us", days=30)
→ {
    "overall_accuracy": 0.65,
    "by_type": {
      "buy": {"total": 20, "correct": 14, "accuracy": 0.70},
      "sell": {"total": 8, "correct": 5, "accuracy": 0.625},
      "avoid": {"total": 12, "correct": 10, "accuracy": 0.833}
    }
  }
```

## 学びの自然消滅

`expires_at` により古い学びは自動的に無効化される（デフォルト30日）。市場環境は変化するため、古いパターンに固執しない設計。

同じパターンが再度観測されると `record_lesson` が `expires_at` を更新するため、繰り返し確認されるパターンは消滅しない。
