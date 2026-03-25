"""マルチマーケット定義"""

from dataclasses import dataclass, field


@dataclass
class MarketConfig:
    market_id: str
    name: str
    timezone: str
    open_hour: int
    open_minute: int
    close_hour: int
    close_minute: int
    premarket_hour: int
    premarket_minute: int
    eod_hour: int
    eod_minute: int
    strategy_file: str
    ib_exchange: str
    ib_currency: str
    holidays: set[str] = field(default_factory=set)
    # 昼休み (TSE 等)
    break_start_hour: int | None = None
    break_start_minute: int | None = None
    break_end_hour: int | None = None
    break_end_minute: int | None = None


MARKETS: dict[str, MarketConfig] = {
    "us": MarketConfig(
        market_id="us",
        name="US (NYSE/NASDAQ)",
        timezone="US/Eastern",
        open_hour=9, open_minute=30,
        close_hour=16, close_minute=0,
        premarket_hour=5, premarket_minute=50,
        eod_hour=16, eod_minute=15,
        strategy_file="us.yaml",
        ib_exchange="SMART",
        ib_currency="USD",
        holidays={
            # 2026
            "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
            "2026-05-25", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
            # 2027
            "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26",
            "2027-05-31", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
        },
    ),
    "jp": MarketConfig(
        market_id="jp",
        name="Japan (TSE)",
        timezone="Asia/Tokyo",
        open_hour=9, open_minute=0,
        close_hour=15, close_minute=0,
        premarket_hour=8, premarket_minute=0,
        eod_hour=15, eod_minute=15,
        strategy_file="jp.yaml",
        ib_exchange="SMART",
        ib_currency="JPY",
        break_start_hour=11, break_start_minute=30,
        break_end_hour=12, break_end_minute=30,
        holidays={
            # 2026
            "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12",
            "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
            "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
            "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22",
            "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
            "2026-12-31",
        },
    ),
    "eu": MarketConfig(
        market_id="eu",
        name="Europe (Euronext/Xetra)",
        timezone="Europe/Paris",
        open_hour=9, open_minute=0,
        close_hour=17, close_minute=30,
        premarket_hour=8, premarket_minute=0,
        eod_hour=17, eod_minute=45,
        strategy_file="eu.yaml",
        ib_exchange="SMART",
        ib_currency="EUR",
        holidays={
            # 2026 (Euronext)
            "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01",
            "2026-12-25", "2026-12-26",
        },
    ),
    "uk": MarketConfig(
        market_id="uk",
        name="UK (LSE)",
        timezone="Europe/London",
        open_hour=8, open_minute=0,
        close_hour=16, close_minute=30,
        premarket_hour=7, premarket_minute=0,
        eod_hour=16, eod_minute=45,
        strategy_file="uk.yaml",
        ib_exchange="SMART",
        ib_currency="GBP",
        holidays={
            # 2026 (LSE)
            "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
            "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
        },
    ),
}
