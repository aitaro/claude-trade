export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  buy: "買いシグナル。strength × confidence に比例して NAV の一定割合を配分",
  sell: "売りシグナル。strength に応じてポジションを縮小/クローズ",
  hold: "現状維持。ポジション変更なし",
  avoid: "回避推奨。新規ポジションを取らない",
};

export const SESSION_MODE_LABELS: Record<string, string> = {
  premarket: "プレマーケット分析。市場開場前にマクロ環境・ニュースをスキャンしてシグナル生成",
  intraday: "日中リサーチ + トレーディング。市場時間中に分析→シグナル→発注を実行",
  eod: "EOD Review。閉場後にシグナル精度評価・学び記録・日次成績を保存",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  started: "セッション開始済み。実行中",
  completed: "正常完了",
  failed: "エラーで失敗。summary にエラー内容が記録される",
  aborted: "Kill switch 発動等で中止",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "発注準備中",
  submitted: "IB に送信済み。約定待ち",
  filled: "約定完了",
  cancelled: "IB によりキャンセル",
  rejected: "リスクチェック不合格またはエラーで拒否",
};

export const ORDER_SIDE_LABELS: Record<string, string> = {
  BUY: "買い注文",
  SELL: "売り注文",
};

export const DECISION_ACTION_LABELS: Record<string, string> = {
  buy: "買い判断",
  sell: "売り判断",
  hold: "保持判断。注文なし",
  skip: "スキップ。条件未達で注文見送り",
};

export const LESSON_TYPE_LABELS: Record<string, string> = {
  signal_accuracy: "シグナル精度に関する学び",
  market_pattern: "市場パターンの観測",
  risk: "リスク管理に関する教訓",
  strategy: "戦略に関する知見",
  info_source: "情報源の信頼性に関する学び",
};

export const LESSON_CATEGORY_LABELS: Record<string, string> = {
  positive: "うまくいったこと。再現したい",
  negative: "失敗・損失。避けたい",
  neutral: "観測事実。判断材料として記録",
};
