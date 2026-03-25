import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.utcnow()


# ── Stage 1 → Stage 2 bridge ──


class Signal(SQLModel, table=True):
    """Research Agent が生成したトレーディングシグナル"""

    __tablename__ = "signals"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    symbol: str = Field(index=True)
    signal_type: str  # buy, sell, hold, avoid
    strength: float  # -1.0 (strong sell) to +1.0 (strong buy)
    reasoning: str
    market_context: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    source_strategy: str = "default"
    confidence: float = 0.5  # 0.0 to 1.0
    expires_at: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=_now)


class ResearchReport(SQLModel, table=True):
    """Research Agent の分析レポート"""

    __tablename__ = "research_reports"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    report_type: str  # premarket, intraday, eod, sector, macro
    title: str
    content: str
    symbols_analyzed: list[str] = Field(default_factory=list, sa_column=Column(JSONB))
    key_findings: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    session_id: str = ""
    created_at: datetime = Field(default_factory=_now)


# ── Trading Engine records ──


class Decision(SQLModel, table=True):
    """Trading Engine の発注判断記録"""

    __tablename__ = "decisions"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    signal_id: Optional[uuid.UUID] = Field(default=None, index=True)
    action: str  # buy, sell, hold, skip
    symbol: str = Field(index=True)
    target_quantity: int = 0
    reasoning: str = ""
    risk_checks: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    approved: bool = False
    created_at: datetime = Field(default_factory=_now)


class Order(SQLModel, table=True):
    """発注記録"""

    __tablename__ = "orders"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    decision_id: uuid.UUID = Field(index=True)
    signal_id: Optional[uuid.UUID] = Field(default=None, index=True)
    symbol: str = Field(index=True)
    side: str  # BUY, SELL
    quantity: int
    order_type: str = "MKT"
    limit_price: Optional[float] = None
    status: str = "pending"  # pending, submitted, filled, cancelled, rejected
    ib_order_id: Optional[int] = None
    fill_price: Optional[float] = None
    fill_quantity: Optional[int] = None
    filled_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


# ── Snapshots ──


class PositionSnapshot(SQLModel, table=True):
    """ポジションスナップショット"""

    __tablename__ = "position_snapshots"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    symbol: str = Field(index=True)
    quantity: int
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float = 0.0
    captured_at: datetime = Field(default_factory=_now)


class AccountSnapshot(SQLModel, table=True):
    """口座スナップショット"""

    __tablename__ = "account_snapshots"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    net_liquidation: float
    total_cash: float
    buying_power: float
    gross_position_value: float
    unrealized_pnl: float
    realized_pnl: float
    captured_at: datetime = Field(default_factory=_now)


# ── Risk ──


class RiskState(SQLModel, table=True):
    """リスク制御状態"""

    __tablename__ = "risk_state"

    id: int = Field(default=1, primary_key=True)
    kill_switch_active: bool = False
    kill_switch_reason: Optional[str] = None
    kill_switch_activated_at: Optional[datetime] = None
    live_trading_enabled: bool = False
    daily_loss_pct: float = 0.0
    daily_order_count: int = 0
    last_reset_date: Optional[str] = None  # YYYY-MM-DD
    updated_at: datetime = Field(default_factory=_now)


# ── Performance ──


class DailyPerformance(SQLModel, table=True):
    """日次成績"""

    __tablename__ = "daily_performance"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    date: str = Field(index=True)  # YYYY-MM-DD
    starting_nav: float
    ending_nav: float
    pnl: float
    pnl_pct: float
    trades_count: int = 0
    winners: int = 0
    losers: int = 0
    max_drawdown_pct: float = 0.0
    created_at: datetime = Field(default_factory=_now)


# ── Feedback Loop ──


class SignalOutcome(SQLModel, table=True):
    """シグナルの事後評価"""

    __tablename__ = "signal_outcomes"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    signal_id: uuid.UUID = Field(index=True)
    symbol: str = Field(index=True)
    signal_type: str  # 元のシグナル (buy/sell/hold/avoid)
    strength: float
    confidence: float
    source_strategy: str = ""
    price_at_signal: Optional[float] = None  # シグナル発行時の価格
    price_at_eval: Optional[float] = None  # 評価時の価格
    price_change_pct: Optional[float] = None  # 変化率
    direction_correct: Optional[bool] = None  # 方向は合っていたか
    pnl: Optional[float] = None  # 実現損益 (取引があった場合)
    evaluation: str = ""  # Claude による事後評価テキスト
    evaluated_at: datetime = Field(default_factory=_now)


class Lesson(SQLModel, table=True):
    """自己学習: 繰り返し観測されるパターンや学び"""

    __tablename__ = "lessons"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    lesson_type: str  # signal_accuracy, market_pattern, risk, strategy, info_source
    category: str  # positive, negative, neutral
    symbol: Optional[str] = Field(default=None, index=True)
    source_strategy: Optional[str] = None
    description: str  # 学びの内容
    evidence: dict = Field(default_factory=dict, sa_column=Column(JSONB))
    confidence: float = 0.5  # この学び自体の確度
    observation_count: int = 1  # 同パターンの観測回数
    is_active: bool = True
    expires_at: Optional[datetime] = None  # 古い学びは自然消滅
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ── News ──


class NewsItem(SQLModel, table=True):
    """ニュースキャッシュ"""

    __tablename__ = "news_items"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    source: str  # finnhub, rss
    headline: str
    summary: str = ""
    url: str = ""
    symbols: list[str] = Field(default_factory=list, sa_column=Column(JSONB))
    published_at: Optional[datetime] = None
    sentiment: Optional[float] = None  # -1.0 to 1.0
    fetched_at: datetime = Field(default_factory=_now)


# ── Session ──


class SessionLog(SQLModel, table=True):
    """Claude セッション記録"""

    __tablename__ = "session_logs"

    id: uuid.UUID = Field(default_factory=_uuid, primary_key=True)
    session_type: str  # research, trading, eod_review
    session_id: str = ""
    status: str = "started"  # started, completed, failed
    signals_generated: int = 0
    orders_placed: int = 0
    summary: str = ""
    started_at: datetime = Field(default_factory=_now)
    completed_at: Optional[datetime] = None
