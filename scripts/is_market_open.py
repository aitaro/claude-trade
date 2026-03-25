#!/usr/bin/env python3
"""US 市場が開いているか判定する

Exit code 0 = open, 1 = closed
cron スクリプトで使用: python is_market_open.py && run-trading.sh
"""

import sys
from datetime import datetime, timezone, timedelta

ET = timezone(timedelta(hours=-5))  # Eastern Time (EST; DST not handled here)

MARKET_HOLIDAYS_2026 = {
    "2026-01-01",  # New Year's Day
    "2026-01-19",  # MLK Day
    "2026-02-16",  # Presidents' Day
    "2026-04-03",  # Good Friday
    "2026-05-25",  # Memorial Day
    "2026-07-03",  # Independence Day (observed)
    "2026-09-07",  # Labor Day
    "2026-11-26",  # Thanksgiving
    "2026-12-25",  # Christmas
}


def is_market_open() -> bool:
    now = datetime.now(ET)

    # Weekend
    if now.weekday() >= 5:
        return False

    # Holiday
    if now.strftime("%Y-%m-%d") in MARKET_HOLIDAYS_2026:
        return False

    # Market hours: 9:30 - 16:00 ET
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)

    return market_open <= now <= market_close


if __name__ == "__main__":
    if is_market_open():
        print("Market is OPEN")
        sys.exit(0)
    else:
        print("Market is CLOSED")
        sys.exit(1)
