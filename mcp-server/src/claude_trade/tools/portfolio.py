"""ポジション・口座照会ツール"""

from claude_trade.ib_client import ib_client


async def get_positions() -> dict:
    """現在のポートフォリオポジション一覧を取得する"""
    try:
        async with ib_client.connect():
            positions = await ib_client.get_positions()
            return {
                "positions": [
                    {
                        "symbol": p.contract.symbol,
                        "quantity": p.position,
                        "avg_cost": p.averageCost,
                        "market_price": p.marketPrice,
                        "market_value": p.marketValue,
                        "unrealized_pnl": p.unrealizedPNL,
                        "realized_pnl": p.realizedPNL,
                    }
                    for p in positions
                ],
                "count": len(positions),
            }
    except Exception as e:
        return {"error": str(e)}


async def get_account_summary() -> dict:
    """口座サマリー（NAV, 現金, 購買力等）を取得する"""
    try:
        async with ib_client.connect():
            summary = await ib_client.get_account_summary()
            result = {}
            for item in summary:
                if item.tag in (
                    "NetLiquidation",
                    "TotalCashValue",
                    "BuyingPower",
                    "GrossPositionValue",
                    "UnrealizedPnL",
                    "RealizedPnL",
                ):
                    result[item.tag] = float(item.value)
            return result
    except Exception as e:
        return {"error": str(e)}
