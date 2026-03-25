"""Agent Runner エントリーポイント

Usage:
    uv run python -m agent_runner.main scheduler     # スケジューラ起動（本番用）
    uv run python -m agent_runner.main run intraday  # 単発実行
"""

import argparse
import asyncio
import logging
import sys

from agent_runner.runner import run_research


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def cmd_run(args):
    """単発で Research Agent を実行する"""
    try:
        result = asyncio.run(run_research(args.mode, args.market))
        logger.info("Session: %s", result["session_id"])
        if result["total_cost_usd"]:
            logger.info("Cost: $%.4f", result["total_cost_usd"])
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(130)
    except Exception:
        logger.exception("Research agent failed")
        sys.exit(1)


def cmd_scheduler(args):
    """スケジューラを起動する"""
    from agent_runner.scheduler import start_scheduler, set_run_now

    if args.run_now:
        parts = args.run_now.split("/")
        if len(parts) != 2:
            logger.error("--run-now format: MARKET/MODE (e.g., us/intraday)")
            sys.exit(1)
        set_run_now(parts[0], parts[1])

    logger.info("Starting agent scheduler...")
    start_scheduler()


def main():
    parser = argparse.ArgumentParser(description="Claude Trade Agent Runner")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # run コマンド
    run_parser = subparsers.add_parser("run", help="単発で Research Agent を実行")
    run_parser.add_argument(
        "mode",
        choices=["premarket", "intraday", "eod"],
        default="intraday",
        nargs="?",
        help="Research mode (default: intraday)",
    )
    run_parser.add_argument(
        "--market",
        choices=["us", "jp", "eu", "uk"],
        default="us",
        help="Target market (default: us)",
    )
    run_parser.set_defaults(func=cmd_run)

    # scheduler コマンド
    sched_parser = subparsers.add_parser("scheduler", help="スケジューラを起動（本番用）")
    sched_parser.add_argument(
        "--run-now",
        metavar="MARKET/MODE",
        help="起動直後に即時実行 (例: us/intraday, jp/premarket)",
    )
    sched_parser.set_defaults(func=cmd_scheduler)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
