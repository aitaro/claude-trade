"""注文・判断の監査記録"""

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import Decision, SessionLog  # noqa: E402

from trading_engine.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def record_decision(
    signal_id: uuid.UUID | None,
    action: str,
    symbol: str,
    target_quantity: int,
    reasoning: str,
    risk_checks: dict,
    approved: bool,
) -> Decision:
    """取引判断を DB に記録する"""
    decision = Decision(
        signal_id=signal_id,
        action=action,
        symbol=symbol,
        target_quantity=target_quantity,
        reasoning=reasoning,
        risk_checks=risk_checks,
        approved=approved,
    )
    async with async_session() as session:
        session.add(decision)
        await session.commit()
        await session.refresh(decision)
    return decision


async def start_session(session_type: str) -> SessionLog:
    """セッション開始を記録"""
    log = SessionLog(session_type=session_type, status="started")
    async with async_session() as session:
        session.add(log)
        await session.commit()
        await session.refresh(log)
    return log


async def complete_session(
    session_log: SessionLog,
    status: str = "completed",
    signals_generated: int = 0,
    orders_placed: int = 0,
    summary: str = "",
) -> None:
    """セッション完了を記録"""
    async with async_session() as session:
        session.add(session_log)
        session_log.status = status
        session_log.signals_generated = signals_generated
        session_log.orders_placed = orders_placed
        session_log.summary = summary
        session_log.completed_at = datetime.utcnow()
        await session.merge(session_log)
        await session.commit()
