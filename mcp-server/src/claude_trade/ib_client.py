"""IB Gateway クライアントラッパー（読み取り専用）

Research Agent はマーケットデータとポジション取得のみ。
発注は Trading Engine (Stage 2) が担当する。
"""

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Optional

from ib_insync import IB, Contract, PortfolioItem, AccountValue

from claude_trade.config import settings


@dataclass
class Quote:
    symbol: str
    last: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None


class IBClient:
    """ib_insync の薄いラッパー。接続管理と読み取り操作のみ。"""

    def __init__(self):
        self._ib = IB()

    @asynccontextmanager
    async def connect(self):
        """IB Gateway への接続をコンテキストマネージャで管理"""
        try:
            await asyncio.wait_for(
                self._ib.connectAsync(
                    host=settings.ib_host,
                    port=settings.ib_port,
                    clientId=settings.ib_client_id,
                    readonly=True,
                ),
                timeout=10,
            )
            yield self
        finally:
            if self._ib.isConnected():
                self._ib.disconnect()

    async def get_quote(self, symbol: str, exchange: str = "SMART", currency: str = "USD") -> Quote:
        contract = Contract(symbol=symbol, secType="STK", exchange=exchange, currency=currency)
        await self._ib.qualifyContractsAsync(contract)
        ticker = self._ib.reqMktData(contract, snapshot=True)
        await asyncio.sleep(2)  # wait for snapshot
        self._ib.cancelMktData(contract)
        return Quote(
            symbol=symbol,
            last=ticker.last if ticker.last == ticker.last else None,
            bid=ticker.bid if ticker.bid == ticker.bid else None,
            ask=ticker.ask if ticker.ask == ticker.ask else None,
            high=ticker.high if ticker.high == ticker.high else None,
            low=ticker.low if ticker.low == ticker.low else None,
            close=ticker.close if ticker.close == ticker.close else None,
            volume=int(ticker.volume) if ticker.volume == ticker.volume else None,
        )

    async def get_positions(self) -> list[PortfolioItem]:
        return self._ib.portfolio()

    async def get_account_summary(self) -> list[AccountValue]:
        await self._ib.reqAccountUpdatesAsync()
        return self._ib.accountSummary()

    async def get_historical_data(
        self,
        symbol: str,
        duration: str = "30 D",
        bar_size: str = "1 day",
        exchange: str = "SMART",
        currency: str = "USD",
    ) -> list[dict]:
        contract = Contract(symbol=symbol, secType="STK", exchange=exchange, currency=currency)
        await self._ib.qualifyContractsAsync(contract)
        bars = await self._ib.reqHistoricalDataAsync(
            contract,
            endDateTime="",
            durationStr=duration,
            barSizeSetting=bar_size,
            whatToShow="TRADES",
            useRTH=True,
        )
        return [
            {
                "date": str(bar.date),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            for bar in bars
        ]


# シングルトン
ib_client = IBClient()
