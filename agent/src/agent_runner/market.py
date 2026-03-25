"""マルチマーケット対応の市場開閉判定"""

from datetime import datetime

import pytz

from agent_runner.markets import MARKETS, MarketConfig


def _now_in_tz(mkt: MarketConfig) -> datetime:
    return datetime.now(pytz.timezone(mkt.timezone))


def is_market_open(market_id: str = "us") -> bool:
    mkt = MARKETS[market_id]
    now = _now_in_tz(mkt)

    if now.weekday() >= 5:
        return False
    if now.strftime("%Y-%m-%d") in mkt.holidays:
        return False

    market_open = now.replace(hour=mkt.open_hour, minute=mkt.open_minute, second=0, microsecond=0)
    market_close = now.replace(hour=mkt.close_hour, minute=mkt.close_minute, second=0, microsecond=0)

    if not (market_open <= now <= market_close):
        return False

    # 昼休みチェック (TSE 等)
    if mkt.break_start_hour is not None:
        break_start = now.replace(hour=mkt.break_start_hour, minute=mkt.break_start_minute, second=0, microsecond=0)
        break_end = now.replace(hour=mkt.break_end_hour, minute=mkt.break_end_minute, second=0, microsecond=0)
        if break_start <= now <= break_end:
            return False

    return True


def is_trading_day(market_id: str = "us") -> bool:
    mkt = MARKETS[market_id]
    now = _now_in_tz(mkt)
    if now.weekday() >= 5:
        return False
    return now.strftime("%Y-%m-%d") not in mkt.holidays
