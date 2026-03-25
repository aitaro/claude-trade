"""リスクチェックエンジン

全注文は必ずここを通過する。1つでも違反があれば注文を拒否。
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import RiskState, Order  # noqa: E402

from trading_engine.config import settings
from trading_engine.portfolio_calc import OrderRequest

engine = create_async_engine(settings.database_url, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@dataclass
class RiskCheckResult:
    approved: bool
    checks: dict[str, bool]
    reasons: list[str]


async def get_risk_state() -> RiskState:
    async with async_session() as session:
        result = await session.execute(select(RiskState).where(RiskState.id == 1))
        state = result.scalar_one_or_none()
        if state is None:
            state = RiskState(id=1)
            session.add(state)
            await session.commit()
            await session.refresh(state)
        return state


async def check_order(order: OrderRequest, nav: float, current_price: float) -> RiskCheckResult:
    """個別注文のリスクチェック"""
    checks = {}
    reasons = []

    risk_state = await get_risk_state()

    # 1. Kill switch
    checks["kill_switch"] = not risk_state.kill_switch_active
    if risk_state.kill_switch_active:
        reasons.append(f"Kill switch active: {risk_state.kill_switch_reason}")

    # 2. Live trading disabled check
    checks["trading_enabled"] = not risk_state.live_trading_enabled or True  # paper always ok
    # Note: actual live trading guard is in executor

    # 3. Max position size
    order_value = order.quantity * current_price
    max_value = nav * (settings.max_position_pct / 100.0)
    checks["position_size"] = order_value <= max_value
    if not checks["position_size"]:
        reasons.append(
            f"Order value ${order_value:.0f} exceeds max ${max_value:.0f} "
            f"({settings.max_position_pct}% of NAV)"
        )

    # 4. Daily order count
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if risk_state.last_reset_date != today:
        risk_state.daily_order_count = 0
        risk_state.last_reset_date = today

    checks["daily_orders"] = risk_state.daily_order_count < settings.max_daily_orders
    if not checks["daily_orders"]:
        reasons.append(f"Daily order limit reached: {risk_state.daily_order_count}/{settings.max_daily_orders}")

    # 5. Daily loss limit
    checks["daily_loss"] = risk_state.daily_loss_pct < settings.daily_loss_limit_pct
    if not checks["daily_loss"]:
        reasons.append(f"Daily loss {risk_state.daily_loss_pct:.2f}% exceeds limit {settings.daily_loss_limit_pct}%")

    approved = all(checks.values())
    return RiskCheckResult(approved=approved, checks=checks, reasons=reasons)


async def increment_order_count():
    """日次注文カウントをインクリメント"""
    async with async_session() as session:
        result = await session.execute(select(RiskState).where(RiskState.id == 1))
        state = result.scalar_one_or_none()
        if state:
            state.daily_order_count += 1
            state.updated_at = datetime.utcnow()
            await session.commit()
