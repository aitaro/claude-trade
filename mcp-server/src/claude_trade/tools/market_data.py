"""市場データ取得ツール"""

from claude_trade.ib_client import ib_client


async def get_quote(symbol: str, exchange: str = "SMART", currency: str = "USD") -> dict:
    """指定銘柄のリアルタイムクォートを取得する

    Args:
        symbol: ティッカーシンボル (例: AAPL, 7203)
        exchange: 取引所 (例: SMART, TSEJ)
        currency: 通貨 (例: USD, JPY, EUR)
    """
    try:
        async with ib_client.connect():
            quote = await ib_client.get_quote(symbol, exchange=exchange, currency=currency)
            return {
                "symbol": quote.symbol,
                "last": quote.last,
                "bid": quote.bid,
                "ask": quote.ask,
                "high": quote.high,
                "low": quote.low,
                "close": quote.close,
                "volume": quote.volume,
            }
    except Exception as e:
        return {"error": str(e), "symbol": symbol}


async def get_historical_data(
    symbol: str,
    duration: str = "30 D",
    bar_size: str = "1 day",
    exchange: str = "SMART",
    currency: str = "USD",
) -> dict:
    """指定銘柄の過去の価格データを取得する

    Args:
        symbol: ティッカーシンボル
        duration: 期間 (例: "30 D", "6 M", "1 Y")
        bar_size: バーサイズ (例: "1 day", "1 hour", "5 mins")
        exchange: 取引所 (例: SMART, TSEJ)
        currency: 通貨 (例: USD, JPY, EUR)
    """
    try:
        async with ib_client.connect():
            bars = await ib_client.get_historical_data(
                symbol, duration, bar_size, exchange=exchange, currency=currency,
            )
            return {"symbol": symbol, "bars": bars, "count": len(bars)}
    except Exception as e:
        return {"error": str(e), "symbol": symbol}


async def get_market_snapshot(
    symbols: list[str],
    exchange: str = "SMART",
    currency: str = "USD",
) -> dict:
    """複数銘柄のクォートを一括取得する

    Args:
        symbols: ティッカーシンボルのリスト (例: ["AAPL", "MSFT"] or ["7203", "6758"])
        exchange: 取引所 (例: SMART, TSEJ)
        currency: 通貨 (例: USD, JPY, EUR)
    """
    results = {}
    try:
        async with ib_client.connect():
            for symbol in symbols:
                quote = await ib_client.get_quote(symbol, exchange=exchange, currency=currency)
                results[symbol] = {
                    "last": quote.last,
                    "bid": quote.bid,
                    "ask": quote.ask,
                    "volume": quote.volume,
                }
    except Exception as e:
        return {"error": str(e), "partial_results": results}
    return results
