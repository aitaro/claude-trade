"""IBKR 発注エグゼキューター

Paper Trading のみ。全注文は RiskEngine を通過済みであること。
"""

import asyncio
import uuid
from datetime import datetime

from ib_insync import IB, Contract, MarketOrder, LimitOrder
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import Order, Decision  # noqa: E402

from trading_engine.config import settings
from trading_engine.portfolio_calc import OrderRequest

engine = create_async_engine(settings.database_url, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Executor:
    def __init__(self):
        self._ib = IB()

    async def connect(self):
        await asyncio.wait_for(
            self._ib.connectAsync(
                host=settings.ib_host,
                port=settings.ib_port,
                clientId=settings.ib_client_id,
                readonly=False,
            ),
            timeout=10,
        )
        self._ib.reqMarketDataType(4)  # delayed-frozen data

    def disconnect(self):
        if self._ib.isConnected():
            self._ib.disconnect()

    async def execute_order(self, order_req: OrderRequest, decision_id: uuid.UUID) -> Order:
        """注文を IBKR に送信し、DB に記録する"""
        contract = Contract(
            symbol=order_req.symbol,
            secType="STK",
            exchange=order_req.exchange,
            currency=order_req.currency,
        )
        self._ib.qualifyContracts(contract)

        ib_order = MarketOrder(
            action=order_req.side,
            totalQuantity=order_req.quantity,
        )

        # DB に注文記録を作成
        db_order = Order(
            decision_id=decision_id,
            signal_id=uuid.UUID(order_req.signal_id) if order_req.signal_id else None,
            symbol=order_req.symbol,
            side=order_req.side,
            quantity=order_req.quantity,
            order_type="MKT",
            status="submitted",
        )

        try:
            trade = self._ib.placeOrder(contract, ib_order)
            db_order.ib_order_id = trade.order.orderId
            db_order.status = "submitted"

            # 約定を最大30秒待つ
            for _ in range(30):
                await asyncio.sleep(1)
                if trade.isDone():
                    break

            if trade.orderStatus.status == "Filled":
                db_order.status = "filled"
                db_order.fill_price = trade.orderStatus.avgFillPrice
                db_order.fill_quantity = int(trade.orderStatus.filled)
                db_order.filled_at = datetime.utcnow()
            elif trade.orderStatus.status == "Cancelled":
                db_order.status = "cancelled"
                db_order.error_message = trade.orderStatus.whyHeld or "Cancelled by IB"
            else:
                db_order.status = trade.orderStatus.status.lower()
        except Exception as e:
            db_order.status = "rejected"
            db_order.error_message = str(e)

        async with async_session() as session:
            session.add(db_order)
            await session.commit()
            await session.refresh(db_order)

        return db_order

    async def get_current_positions(self) -> dict[str, int]:
        """現在のポジションを {symbol: quantity} で返す"""
        portfolio = self._ib.portfolio()
        return {p.contract.symbol: int(p.position) for p in portfolio}

    async def get_nav(self) -> tuple[float, str]:
        """NAV (Net Liquidation Value) と基準通貨を取得"""
        summary = self._ib.accountSummary()
        for item in summary:
            if item.tag == "NetLiquidation" and item.currency not in ("BASE", ""):
                return float(item.value), item.currency
        return 0.0, "JPY"

    async def get_fx_rate(self, from_currency: str, to_currency: str) -> float:
        """為替レートを取得する (例: JPY→USD)"""
        if from_currency == to_currency:
            return 1.0

        # IB の Forex ペアで取得
        pair = f"{from_currency}.{to_currency}"
        contract = Contract(
            secType="CASH",
            symbol=from_currency,
            currency=to_currency,
            exchange="IDEALPRO",
        )
        try:
            self._ib.qualifyContracts(contract)
            ticker = self._ib.reqMktData(contract)
            await asyncio.sleep(3)
            self._ib.cancelMktData(contract)
            if ticker.last == ticker.last:
                return ticker.last
            elif ticker.close == ticker.close:
                return ticker.close
        except Exception:
            pass

        # フォールバック: 逆ペアで取得
        try:
            contract = Contract(
                secType="CASH",
                symbol=to_currency,
                currency=from_currency,
                exchange="IDEALPRO",
            )
            self._ib.qualifyContracts(contract)
            ticker = self._ib.reqMktData(contract)
            await asyncio.sleep(3)
            self._ib.cancelMktData(contract)
            if ticker.last == ticker.last:
                return 1.0 / ticker.last
            elif ticker.close == ticker.close:
                return 1.0 / ticker.close
        except Exception:
            pass

        return 0.0

    async def get_current_prices(
        self, symbols: list[str], exchange: str = "SMART", currency: str = "USD",
    ) -> dict[str, float]:
        """複数銘柄の現在価格を取得"""
        prices = {}
        for symbol in symbols:
            contract = Contract(symbol=symbol, secType="STK", exchange=exchange, currency=currency)
            self._ib.qualifyContracts(contract)
            ticker = self._ib.reqMktData(contract)
            await asyncio.sleep(3)
            self._ib.cancelMktData(contract)
            # NaN check: try last, then close
            if ticker.last == ticker.last:
                prices[symbol] = ticker.last
            elif ticker.close == ticker.close:
                prices[symbol] = ticker.close
        return prices
