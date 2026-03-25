"""目標ポートフォリオ計算 → 注文生成"""

from dataclasses import dataclass

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[3] / "mcp-server" / "src"))
from claude_trade.models import Signal  # noqa: E402


@dataclass
class OrderRequest:
    symbol: str
    side: str  # BUY or SELL
    quantity: int
    signal_id: str
    reasoning: str
    exchange: str = "SMART"
    currency: str = "USD"


def calculate_target_shares(
    signal: Signal,
    nav: float,
    current_position: int,
    current_price: float,
    max_position_pct: float,
) -> int:
    """シグナルから目標株数を計算する

    - buy シグナル: strength * confidence に比例して NAV の一定割合を配分
    - sell シグナル: ポジションを縮小/クローズ
    - hold / avoid: 変更なし
    """
    if signal.signal_type in ("hold", "avoid"):
        return current_position

    max_position_value = nav * (max_position_pct / 100.0)

    if signal.signal_type == "buy":
        # strength * confidence で配分率を決定 (0〜max_position_pct)
        alloc_factor = abs(signal.strength) * signal.confidence
        target_value = max_position_value * alloc_factor
        target_shares = int(target_value / current_price) if current_price > 0 else 0
        return target_shares

    if signal.signal_type == "sell":
        # sell の場合: strength に応じてポジションを縮小
        reduce_factor = abs(signal.strength) * signal.confidence
        target_shares = int(current_position * (1 - reduce_factor))
        return max(0, target_shares)

    return current_position


def generate_orders(
    signals: dict[str, Signal],
    nav: float,
    positions: dict[str, int],  # symbol -> current quantity
    prices: dict[str, float],  # symbol -> current price
    max_position_pct: float,
    exchange: str = "SMART",
    currency: str = "USD",
) -> list[OrderRequest]:
    """シグナル群から注文リストを生成する"""
    orders: list[OrderRequest] = []

    for symbol, signal in signals.items():
        current_qty = positions.get(symbol, 0)
        current_price = prices.get(symbol, 0.0)

        if current_price <= 0:
            continue

        target_qty = calculate_target_shares(
            signal, nav, current_qty, current_price, max_position_pct
        )

        diff = target_qty - current_qty

        if diff > 0:
            orders.append(OrderRequest(
                symbol=symbol,
                side="BUY",
                quantity=diff,
                signal_id=str(signal.id),
                reasoning=f"Signal: {signal.signal_type} strength={signal.strength:.2f} conf={signal.confidence:.2f}",
                exchange=exchange,
                currency=currency,
            ))
        elif diff < 0:
            orders.append(OrderRequest(
                symbol=symbol,
                side="SELL",
                quantity=abs(diff),
                signal_id=str(signal.id),
                reasoning=f"Signal: {signal.signal_type} strength={signal.strength:.2f} conf={signal.confidence:.2f}",
                exchange=exchange,
                currency=currency,
            ))

    return orders
