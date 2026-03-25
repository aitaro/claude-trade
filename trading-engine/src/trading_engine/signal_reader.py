"""DB からアクティブなシグナルを読み取る"""

import sys
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import col

# Import models from mcp-server (shared)
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import Signal  # noqa: E402

from trading_engine.config import settings


engine = create_async_engine(settings.database_url, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def read_active_signals(source_strategy: str | None = None) -> list[Signal]:
    """有効期限内のアクティブなシグナルを全て読み取る

    Args:
        source_strategy: マーケットIDでフィルタ (例: "us", "jp", "eu")
    """
    now = datetime.utcnow()
    async with async_session() as session:
        stmt = (
            select(Signal)
            .where(Signal.is_active == True)  # noqa: E712
            .where(col(Signal.expires_at) > now)
            .order_by(Signal.created_at.desc())
        )
        if source_strategy:
            stmt = stmt.where(Signal.source_strategy == source_strategy)
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_latest_signal_per_symbol(source_strategy: str | None = None) -> dict[str, Signal]:
    """銘柄ごとに最新のアクティブシグナルを1つずつ返す"""
    signals = await read_active_signals(source_strategy)
    latest: dict[str, Signal] = {}
    for s in signals:
        if s.symbol not in latest:
            latest[s.symbol] = s
    return latest
