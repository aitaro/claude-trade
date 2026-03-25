"""緊急停止 (Kill Switch)

発動条件:
- 日次損失 > daily_loss_limit_pct
- 手動発動
- 異常検知

発動時:
- 全注文を拒否
- オープン注文をキャンセル
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import RiskState  # noqa: E402

from trading_engine.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def activate_kill_switch(reason: str) -> None:
    """Kill switch を発動する"""
    async with async_session() as session:
        result = await session.execute(select(RiskState).where(RiskState.id == 1))
        state = result.scalar_one_or_none()
        if state is None:
            state = RiskState(id=1)
            session.add(state)

        state.kill_switch_active = True
        state.kill_switch_reason = reason
        state.kill_switch_activated_at = datetime.utcnow()
        state.updated_at = datetime.utcnow()
        await session.commit()
    print(f"[KILL SWITCH] Activated: {reason}")


async def deactivate_kill_switch() -> None:
    """Kill switch を解除する"""
    async with async_session() as session:
        result = await session.execute(select(RiskState).where(RiskState.id == 1))
        state = result.scalar_one_or_none()
        if state:
            state.kill_switch_active = False
            state.kill_switch_reason = None
            state.kill_switch_activated_at = None
            state.updated_at = datetime.utcnow()
            await session.commit()
    print("[KILL SWITCH] Deactivated")


async def check_daily_loss(current_nav: float, starting_nav: float) -> bool:
    """日次損失を確認し、閾値超過なら kill switch 発動"""
    if starting_nav <= 0:
        return False

    loss_pct = (starting_nav - current_nav) / starting_nav * 100
    if loss_pct > settings.daily_loss_limit_pct:
        await activate_kill_switch(
            f"Daily loss {loss_pct:.2f}% exceeded limit {settings.daily_loss_limit_pct}%"
        )
        return True

    # Update daily loss in risk state
    async with async_session() as session:
        result = await session.execute(select(RiskState).where(RiskState.id == 1))
        state = result.scalar_one_or_none()
        if state:
            state.daily_loss_pct = max(0, loss_pct)
            state.updated_at = datetime.utcnow()
            await session.commit()

    return False
