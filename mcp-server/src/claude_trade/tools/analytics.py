"""成績分析ツール"""

from sqlalchemy import select, func

from claude_trade.db import async_session
from claude_trade.models import DailyPerformance, Order


async def query_performance(
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """日次成績を集計する

    Args:
        start_date: 開始日 (YYYY-MM-DD, 省略で全期間)
        end_date: 終了日 (YYYY-MM-DD, 省略で全期間)
    """
    async with async_session() as session:
        stmt = select(DailyPerformance).order_by(DailyPerformance.date.asc())
        if start_date:
            stmt = stmt.where(DailyPerformance.date >= start_date)
        if end_date:
            stmt = stmt.where(DailyPerformance.date <= end_date)

        result = await session.execute(stmt)
        days = result.scalars().all()

    if not days:
        return {"message": "No performance data found", "days": []}

    total_pnl = sum(d.pnl for d in days)
    total_trades = sum(d.trades_count for d in days)
    total_winners = sum(d.winners for d in days)
    total_losers = sum(d.losers for d in days)
    win_rate = total_winners / total_trades if total_trades > 0 else 0.0
    max_dd = max((d.max_drawdown_pct for d in days), default=0.0)

    pnl_pcts = [d.pnl_pct for d in days]
    avg_daily_return = sum(pnl_pcts) / len(pnl_pcts) if pnl_pcts else 0.0

    # Simplified Sharpe (annualized, assuming 252 trading days)
    if len(pnl_pcts) > 1:
        import statistics
        std_dev = statistics.stdev(pnl_pcts)
        sharpe = (avg_daily_return / std_dev * (252 ** 0.5)) if std_dev > 0 else 0.0
    else:
        sharpe = 0.0

    return {
        "summary": {
            "total_pnl": round(total_pnl, 2),
            "total_trades": total_trades,
            "win_rate": round(win_rate, 4),
            "max_drawdown_pct": round(max_dd, 4),
            "avg_daily_return_pct": round(avg_daily_return, 4),
            "sharpe_ratio": round(sharpe, 2),
            "trading_days": len(days),
        },
        "daily": [
            {
                "date": d.date,
                "pnl": d.pnl,
                "pnl_pct": d.pnl_pct,
                "trades": d.trades_count,
            }
            for d in days[-30:]  # 直近30日
        ],
    }


async def get_trade_stats(symbol: str | None = None) -> dict:
    """注文統計を取得する

    Args:
        symbol: 特定銘柄に絞る場合のティッカー
    """
    async with async_session() as session:
        stmt = select(Order).where(Order.status == "filled")
        if symbol:
            stmt = stmt.where(Order.symbol == symbol.upper())

        result = await session.execute(stmt)
        orders = result.scalars().all()

    if not orders:
        return {"message": "No filled orders found"}

    buys = [o for o in orders if o.side == "BUY"]
    sells = [o for o in orders if o.side == "SELL"]

    return {
        "total_orders": len(orders),
        "buys": len(buys),
        "sells": len(sells),
        "symbols_traded": list(set(o.symbol for o in orders)),
    }
