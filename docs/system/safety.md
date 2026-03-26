# 安全制約・リスク管理

## 基本原則

- **Paper Trading のみ** — `live_trading_enabled = false`。実資金での取引は行わない
- **安全側倒し** — Research Agent のエラー → シグナルなし → Trading Engine は何もしない
- **AI と発注の分離** — Claude はシグナル生成のみ。発注判断は deterministic な Python コードが行う

## Risk Engine: 5点バリデーション

Trading Engine は全ての注文に対して以下の5つのチェックを行う。全て通過した場合のみ発注する。

| チェック | 条件 | 閾値 |
|---|---|---|
| kill_switch | Kill Switch が発動していないこと | active = false |
| trading_enabled | Paper Trading が有効であること | live_trading_enabled = false |
| position_size | 1銘柄の注文額が NAV の一定割合以下であること | 10% |
| daily_orders | 日次注文数が上限以下であること | 20注文/日 |
| daily_loss | 日次損失が閾値以下であること | 3% |

## Kill Switch

日次損失が NAV の 3% を超えると自動的に発動。発動すると:
- 全ての新規注文が拒否される
- 手動で解除するまで取引停止
- 発動理由と日時が DB に記録される

## シグナル TTL

シグナルには有効期限がある:
- Intraday シグナル: 8時間（デフォルト）
- Premarket シグナル: 10-12時間
- 期限切れシグナルは Trading Engine に無視される

## ポジション管理

| パラメータ | 値 | 説明 |
|---|---|---|
| max_positions | 8 | 同時保有銘柄数の上限 |
| max_position_pct | 10% | 1銘柄の最大配分（NAV比） |
| target_cash_pct | 20% | 目標現金比率 |
| stop_loss_pct | 5% | 個別銘柄ストップロス |

## IB Gateway の自動復旧

- Docker `restart: unless-stopped` でコンテナ自動再起動
- `EXISTING_SESSION_DETECTED_ACTION: primaryoverride` でセッション競合時に自動復帰
- モバイル/Web からログインして切断された場合、3分間待機してから再接続（ユーザーの操作を優先）

## 監査証跡

全ての判断・注文は DB に記録される:
- `signals` — 生成されたシグナル（reasoning 付き）
- `decisions` — Trading Engine の判断（risk_checks 結果付き）
- `orders` — 発注記録（status, fill_price, error_message 付き）
- `session_logs` — セッション実行記録
