"""シグナル書き込み・読み取りツール"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlmodel import col

from claude_trade.db import async_session
from claude_trade.models import Signal


async def write_signal(
    symbol: str,
    signal_type: str,
    strength: float,
    reasoning: str,
    confidence: float = 0.5,
    source_strategy: str = "default",
    market_context: dict | None = None,
    ttl_hours: float = 8.0,
) -> dict:
    """トレーディングシグナルを DB に書き込む

    Args:
        symbol: ティッカーシンボル (例: AAPL)
        signal_type: "buy", "sell", "hold", "avoid"
        strength: シグナル強度 (-1.0〜+1.0)
        reasoning: 分析理由（テキスト）
        confidence: 確信度 (0.0〜1.0)
        source_strategy: 戦略名
        market_context: 分析時のマーケットデータ (JSON)
        ttl_hours: シグナル有効期間（時間）
    """
    strength = max(-1.0, min(1.0, strength))
    confidence = max(0.0, min(1.0, confidence))

    if signal_type not in ("buy", "sell", "hold", "avoid"):
        return {"error": f"Invalid signal_type: {signal_type}. Must be buy/sell/hold/avoid"}

    signal = Signal(
        symbol=symbol.upper(),
        signal_type=signal_type,
        strength=strength,
        reasoning=reasoning,
        market_context=market_context or {},
        source_strategy=source_strategy,
        confidence=confidence,
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
    )

    async with async_session() as session:
        # 同じ銘柄の古いアクティブシグナルを無効化
        stmt = (
            select(Signal)
            .where(Signal.symbol == signal.symbol)
            .where(Signal.is_active == True)  # noqa: E712
            .where(Signal.source_strategy == source_strategy)
        )
        result = await session.execute(stmt)
        for old_signal in result.scalars():
            old_signal.is_active = False

        session.add(signal)
        await session.commit()
        await session.refresh(signal)

    return {
        "id": str(signal.id),
        "symbol": signal.symbol,
        "signal_type": signal.signal_type,
        "strength": signal.strength,
        "confidence": signal.confidence,
        "expires_at": signal.expires_at.isoformat(),
    }


async def get_active_signals(
    symbol: str | None = None,
    source_strategy: str | None = None,
) -> dict:
    """アクティブなシグナル一覧を取得する

    Args:
        symbol: 特定銘柄に絞る場合のティッカー (省略で全銘柄)
        source_strategy: 特定戦略に絞る場合の戦略名 (省略で全戦略)
    """
    now = datetime.utcnow()
    async with async_session() as session:
        stmt = (
            select(Signal)
            .where(Signal.is_active == True)  # noqa: E712
            .where(col(Signal.expires_at) > now)
        )
        if symbol:
            stmt = stmt.where(Signal.symbol == symbol.upper())
        if source_strategy:
            stmt = stmt.where(Signal.source_strategy == source_strategy)
        stmt = stmt.order_by(Signal.created_at.desc())

        result = await session.execute(stmt)
        signals = result.scalars().all()

    return {
        "signals": [
            {
                "id": str(s.id),
                "symbol": s.symbol,
                "signal_type": s.signal_type,
                "strength": s.strength,
                "confidence": s.confidence,
                "reasoning": s.reasoning[:500],
                "source_strategy": s.source_strategy,
                "expires_at": s.expires_at.isoformat(),
                "created_at": s.created_at.isoformat(),
            }
            for s in signals
        ],
        "count": len(signals),
    }
