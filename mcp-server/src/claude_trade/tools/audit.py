"""判断履歴照会ツール"""

from sqlalchemy import select

from claude_trade.db import async_session
from claude_trade.models import Decision, Order, SessionLog


async def get_decision_history(
    symbol: str | None = None,
    limit: int = 20,
) -> dict:
    """過去の取引判断履歴を取得する

    Args:
        symbol: 特定銘柄でフィルタ (省略で全銘柄)
        limit: 取得件数 (デフォルト 20)
    """
    async with async_session() as session:
        stmt = select(Decision).order_by(Decision.created_at.desc()).limit(limit)
        if symbol:
            stmt = stmt.where(Decision.symbol == symbol.upper())

        result = await session.execute(stmt)
        decisions = result.scalars().all()

    return {
        "decisions": [
            {
                "id": str(d.id),
                "symbol": d.symbol,
                "action": d.action,
                "target_quantity": d.target_quantity,
                "reasoning": d.reasoning[:300],
                "approved": d.approved,
                "signal_id": str(d.signal_id) if d.signal_id else None,
                "created_at": d.created_at.isoformat(),
            }
            for d in decisions
        ],
        "count": len(decisions),
    }


async def get_order_history(
    symbol: str | None = None,
    status: str | None = None,
    limit: int = 20,
) -> dict:
    """過去の注文履歴を取得する

    Args:
        symbol: 特定銘柄でフィルタ
        status: ステータスでフィルタ (pending/submitted/filled/cancelled/rejected)
        limit: 取得件数
    """
    async with async_session() as session:
        stmt = select(Order).order_by(Order.created_at.desc()).limit(limit)
        if symbol:
            stmt = stmt.where(Order.symbol == symbol.upper())
        if status:
            stmt = stmt.where(Order.status == status)

        result = await session.execute(stmt)
        orders = result.scalars().all()

    return {
        "orders": [
            {
                "id": str(o.id),
                "symbol": o.symbol,
                "side": o.side,
                "quantity": o.quantity,
                "order_type": o.order_type,
                "status": o.status,
                "fill_price": o.fill_price,
                "fill_quantity": o.fill_quantity,
                "created_at": o.created_at.isoformat(),
            }
            for o in orders
        ],
        "count": len(orders),
    }


async def get_session_logs(limit: int = 10) -> dict:
    """Claude セッション履歴を取得する

    Args:
        limit: 取得件数
    """
    async with async_session() as session:
        stmt = select(SessionLog).order_by(SessionLog.started_at.desc()).limit(limit)
        result = await session.execute(stmt)
        logs = result.scalars().all()

    return {
        "sessions": [
            {
                "id": str(s.id),
                "session_type": s.session_type,
                "status": s.status,
                "signals_generated": s.signals_generated,
                "orders_placed": s.orders_placed,
                "summary": s.summary[:200],
                "started_at": s.started_at.isoformat(),
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in logs
        ],
        "count": len(logs),
    }
