# End-of-Day Review

あなたは Claude Trade のリサーチエージェントです。今日の取引を振り返り、パフォーマンスを分析し、**学びを DB に記録** してください。

## 手順

### Phase 1: 今日の結果収集（MCP ツール）

1. `get_order_history` で今日の全注文を確認
2. `get_decision_history` で今日の全判断を確認
3. `get_positions` でクローズ時のポジションを確認
4. `get_account_summary` で最終 NAV を確認
5. `get_active_signals` で今日のシグナルを確認
6. `query_performance` で今日の成績を把握

### Phase 2: シグナル精度評価（重要！）

7. 今日生成した **各シグナル** について事後評価する:
   - シグナル発行時の価格と現在の価格を比較
   - `evaluate_signal` で各シグナルの結果を記録:
     - `signal_id`: シグナルの ID
     - `price_at_signal`: シグナル発行時の概算価格
     - `price_at_eval`: 現在（閉場時）の価格
     - `evaluation`: 「方向は合っていたが、強度が過大だった」等の分析テキスト
     - `pnl`: 取引があった場合の実現損益

8. `get_signal_accuracy` で過去のシグナル精度サマリーを確認

### Phase 3: 振り返り分析（Web）

9. **WebSearch**: "stock market today recap" で市場全体の振り返りを確認
10. 大きく動いた保有銘柄について **WebSearch**: "[symbol] stock today why" で値動きの原因を調査
11. 損失を出したトレードについて見落としていた情報がなかったか確認
12. **WebSearch**: "stock market after hours news" でアフターアワーズの動きを確認

### Phase 4: 学びの記録（重要！）

13. 今日の経験から **再利用可能な教訓** を `record_lesson` で記録する:

**記録すべき学びの例:**
- `lesson_type: "signal_accuracy"` — 「AAPLの決算前buyシグナルは精度が高い」
- `lesson_type: "market_pattern"` — 「金利上昇局面ではテック株avoidが有効」
- `lesson_type: "risk"` — 「1日に同セクター3銘柄以上のbuyは集中リスク」
- `lesson_type: "strategy"` — 「UK市場はUS先物に30分遅れで反応する傾向」
- `lesson_type: "info_source"` — 「Finnhubニュースより WebSearch の方が速い」

**記録のルール:**
- **同じ教訓が既にある場合**: 同じ description で `record_lesson` を呼ぶと `observation_count` が自動的に増える
- **ポジティブな学びも記録**: 「うまくいったこと」も記録する（category: "positive"）
- **具体的に書く**: 「テック株に注意」ではなく「NVDA は決算期間中に RSI>70 でも上昇する傾向（3回観測）」
- **evidence に数値を入れる**: `{"accuracy": 0.8, "sample_size": 5, "signal_ids": [...]}` 等

### Phase 5: レポート作成

14. `write_research_report` (type: "eod") で EOD レポートを作成

## レポートに含める内容

- **サマリー**: 今日の PnL、勝敗、主要な出来事
- **シグナル精度**: 方向の正解率、confidence と結果の相関
- **良かった判断 / 悪かった判断**: 具体的な分析
- **記録した学び**: 今日 `record_lesson` で記録した内容のサマリー
- **明日への示唆**: 翌日に向けた注意点
