"""Trading Engine メインエントリポイント

Stage 2: Deterministic Trading Engine
- DB からアクティブシグナルを読み取り
- 目標ポートフォリオを計算
- リスクチェック
- IBKR Paper で発注

Usage:
    uv run python -m trading_engine.main [--market us|jp|eu]
"""

import argparse
import asyncio
import sys
import uuid

import nest_asyncio
nest_asyncio.apply()

import yaml

from trading_engine.signal_reader import get_latest_signal_per_symbol
from trading_engine.portfolio_calc import generate_orders
from trading_engine.risk_engine import check_order, increment_order_count, get_risk_state
from trading_engine.kill_switch import check_daily_loss
from trading_engine.executor import Executor
from trading_engine.audit import record_decision, start_session, complete_session
from trading_engine.config import settings

# 戦略ファイルからマーケット設定を読み込む
STRATEGY_DIR = __import__("pathlib").Path(__file__).resolve().parents[3] / "strategies"

MARKET_DEFAULTS = {
    "us": {"exchange": "SMART", "currency": "USD", "strategy_file": "us.yaml"},
    "jp": {"exchange": "SMART", "currency": "JPY", "strategy_file": "jp.yaml"},
    "eu": {"exchange": "SMART", "currency": "EUR", "strategy_file": "eu.yaml"},
    "uk": {"exchange": "SMART", "currency": "GBP", "strategy_file": "uk.yaml"},
}


def load_market_config(market_id: str) -> dict:
    defaults = MARKET_DEFAULTS.get(market_id, MARKET_DEFAULTS["us"])
    strategy_path = STRATEGY_DIR / defaults["strategy_file"]
    if strategy_path.exists():
        with open(strategy_path, encoding="utf-8") as f:
            strategy = yaml.safe_load(f)
        return {
            "exchange": strategy.get("exchange", defaults["exchange"]),
            "currency": strategy.get("currency", defaults["currency"]),
        }
    return defaults


async def run(market_id: str = "us", shared_executor: Executor | None = None):
    """メイン取引ループ"""
    mkt = load_market_config(market_id)
    exchange = mkt["exchange"]
    currency = mkt["currency"]

    session_log = await start_session("trading")
    orders_placed = 0
    own_executor = shared_executor is None

    try:
        # 1. アクティブシグナルを読み取り (マーケットでフィルタ)
        signals = await get_latest_signal_per_symbol(source_strategy=market_id)
        if not signals:
            print(f"[TRADING/{market_id.upper()}] No active signals found. Nothing to do.")
            await complete_session(session_log, summary=f"No active signals for {market_id}")
            return

        print(f"[TRADING/{market_id.upper()}] Found {len(signals)} active signals: {list(signals.keys())}")

        # 2. Kill switch チェック
        risk_state = await get_risk_state()
        if risk_state.kill_switch_active:
            print(f"[TRADING/{market_id.upper()}] Kill switch active: {risk_state.kill_switch_reason}. Aborting.")
            await complete_session(session_log, status="aborted", summary="Kill switch active")
            return

        # 3. IBKR に接続してポジション・NAV・価格を取得
        executor = shared_executor or Executor()
        if own_executor:
            try:
                await executor.connect()
            except Exception as e:
                print(f"[TRADING/{market_id.upper()}] IB connection failed: {e}. Aborting.")
                await complete_session(session_log, status="failed", summary=f"IB connection failed: {e}")
                return

        try:
            nav_raw, base_currency = await executor.get_nav()
            positions = await executor.get_current_positions()
            prices = await executor.get_current_prices(
                list(signals.keys()), exchange=exchange, currency=currency,
            )

            # NAV を取引通貨に変換
            if base_currency != currency:
                fx_rate = await executor.get_fx_rate(base_currency, currency)
                if fx_rate <= 0:
                    print(f"[TRADING/{market_id.upper()}] Failed to get FX rate {base_currency}->{currency}. Aborting.")
                    await complete_session(session_log, status="failed", summary=f"FX rate unavailable: {base_currency}->{currency}")
                    return
                nav = nav_raw * fx_rate
                print(f"[TRADING/{market_id.upper()}] NAV: {base_currency} {nav_raw:,.0f} -> {currency} {nav:,.0f} (FX: {fx_rate:.6f})")
            else:
                nav = nav_raw
                print(f"[TRADING/{market_id.upper()}] NAV: {currency} {nav:,.0f}")

            print(f"[TRADING/{market_id.upper()}] Positions: {positions}, Prices: {prices}")

            # 4. 日次損失チェック
            killed = await check_daily_loss(nav_raw, nav_raw)  # kill switch は基準通貨ベースで判定
            if killed:
                print(f"[TRADING/{market_id.upper()}] Kill switch triggered by daily loss. Aborting.")
                await complete_session(session_log, status="aborted", summary="Daily loss kill switch")
                return

            # 5. 注文生成
            order_requests = generate_orders(
                signals=signals,
                nav=nav,
                positions=positions,
                prices=prices,
                max_position_pct=settings.max_position_pct,
                exchange=exchange,
                currency=currency,
            )

            if not order_requests:
                print(f"[TRADING/{market_id.upper()}] No orders to execute.")
                await complete_session(session_log, summary="No orders generated")
                return

            print(f"[TRADING/{market_id.upper()}] Generated {len(order_requests)} orders")

            # 6. 各注文をリスクチェック → 発注
            for order_req in order_requests:
                price = prices.get(order_req.symbol, 0.0)
                risk_result = await check_order(order_req, nav, price)

                # 判断を記録
                decision = await record_decision(
                    signal_id=uuid.UUID(order_req.signal_id) if order_req.signal_id else None,
                    action=order_req.side.lower(),
                    symbol=order_req.symbol,
                    target_quantity=order_req.quantity,
                    reasoning=order_req.reasoning,
                    risk_checks=risk_result.checks,
                    approved=risk_result.approved,
                )

                if not risk_result.approved:
                    print(f"[TRADING/{market_id.upper()}] Order REJECTED for {order_req.symbol}: {risk_result.reasons}")
                    continue

                # 発注
                db_order = await executor.execute_order(order_req, decision.id)
                await increment_order_count()
                orders_placed += 1
                print(
                    f"[TRADING/{market_id.upper()}] Order PLACED: {order_req.side} {order_req.quantity} {order_req.symbol} "
                    f"(order_id={db_order.ib_order_id}, status={db_order.status})"
                )

        finally:
            if own_executor:
                executor.disconnect()

        await complete_session(
            session_log,
            orders_placed=orders_placed,
            summary=f"[{market_id.upper()}] Processed {len(signals)} signals, placed {orders_placed} orders",
        )
        print(f"[TRADING/{market_id.upper()}] Session complete. Orders placed: {orders_placed}")

    except Exception as e:
        print(f"[TRADING/{market_id.upper()}] Error: {e}")
        await complete_session(session_log, status="failed", summary=str(e))
        raise


async def run_multiple(market_ids: list[str]):
    """複数マーケットを1つのIB接続で順番に処理する"""
    executor = Executor()
    try:
        await executor.connect()
    except Exception as e:
        print(f"[TRADING] IB connection failed: {e}. Aborting all markets.")
        return

    try:
        for market_id in market_ids:
            try:
                await run(market_id, shared_executor=executor)
            except Exception as e:
                print(f"[TRADING/{market_id.upper()}] Error: {e}")
    finally:
        executor.disconnect()


def main():
    parser = argparse.ArgumentParser(description="Claude Trade Trading Engine")
    parser.add_argument(
        "--market",
        help="Target market(s), comma-separated (e.g., us,uk,eu)",
        default="us",
    )
    args = parser.parse_args()
    markets = [m.strip() for m in args.market.split(",")]
    if len(markets) == 1:
        asyncio.run(run(markets[0]))
    else:
        asyncio.run(run_multiple(markets))


if __name__ == "__main__":
    main()
