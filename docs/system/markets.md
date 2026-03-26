# マルチマーケット対応

## 対応市場

| ID | マーケット | 取引所 | 通貨 | タイムゾーン |
|---|---|---|---|---|
| `us` | NYSE / NASDAQ | SMART | USD | US/Eastern |
| `jp` | TSE (東証) | SMART | JPY | Asia/Tokyo |
| `eu` | Euronext / Xetra | SMART | EUR | Europe/Paris |
| `uk` | LSE | SMART | GBP | Europe/London |

全市場 IB の SMART routing を使用。IB が最適な取引所に自動振り分けする。

## スケジュール

各市場に対して3種類のジョブが30分間隔で実行される:

| ジョブ | US (ET) | JP (JST) | EU (CET) | UK (GMT) |
|---|---|---|---|---|
| Premarket | 5:50 | 8:00 | 8:00 | 7:00 |
| Intraday | 9:05-15:35 (30分毎) | 9:05-14:35 (30分毎) | 9:05-16:35 (30分毎) | 8:05-15:35 (30分毎) |
| EOD Review | 16:15 | 15:15 | 17:45 | 16:45 |

UTC タイムラインでの24時間カバレッジ:

```
UTC  0  2  4  6  8  10 12 14 16 18 20 22 24
JP   ████████████                              00:00-06:00
EU              ████████████████              08:00-16:30
UK            ████████████████                08:00-16:30
US                          ██████████████    13:30-20:00
```

## 戦略ファイル

各市場の戦略は `strategies/` ディレクトリに YAML で定義:

- `strategies/us.yaml` — 米国株 (AAPL, MSFT, GOOGL, NVDA, ...)
- `strategies/jp.yaml` — 日本株 (7203, 6758, 8306, ...)
- `strategies/eu.yaml` — 欧州株 (ASML, SAP, MC, ...)
- `strategies/uk.yaml` — 英国株 (AZN, HSBA, BP., ...)

各ファイルには以下が定義される:
- `watchlist` — 監視銘柄リスト
- `exchange` / `currency` — 取引所・通貨設定
- `signal` — シグナル生成パラメータ（min_confidence, TTL 等）
- `position` — ポジション管理（max_positions, max_position_pct 等）
- `technical` — テクニカル指標パラメータ
- `risk` — リスク管理設定

## 通貨変換

口座の基準通貨は JPY（変更不可、IBSJ 口座のため）。

Trading Engine は発注時に NAV を取引通貨に変換する:
1. `get_nav()` → JPY 建ての NAV を取得
2. `get_fx_rate(JPY, USD)` → IB の Forex データで為替レート取得
3. `nav_in_usd = nav_jpy * fx_rate` → USD 建てに変換
4. ポジションサイズ計算は変換後の NAV で実行

## IB 口座構成

IBSJ 統合口座（U24798607）で日本株・海外株の両方を取引可能。

取引許可の設定（IB Client Portal → 口座取引許可 → 株式）:
- 日本: ✅
- 米国: ✅
- 英国: 要申請
- 欧州各国: 要申請

注意: スペイン株は税務上の理由で取引しない方針。
