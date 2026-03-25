"""スケジューラ: 全マーケットのジョブを1プロセスで管理する"""

import asyncio
import logging
import subprocess

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from agent_runner.config import settings
from agent_runner.market import is_market_open, is_trading_day
from agent_runner.markets import MARKETS

logger = logging.getLogger(__name__)


def _run_async(coro):
    asyncio.run(coro)


def _run_research(mode: str, market_id: str):
    """Research Agent を実行する（市場チェック付き）"""
    from agent_runner.runner import run_research

    if mode == "premarket" and not is_trading_day(market_id):
        logger.info("[%s/%s] Not a trading day. Skipping.", market_id.upper(), mode)
        return

    if mode == "intraday" and not is_market_open(market_id):
        logger.info("[%s/%s] Market is closed. Skipping.", market_id.upper(), mode)
        return

    logger.info("[%s/%s] Starting research job", market_id.upper(), mode)
    try:
        result = _run_async(run_research(mode, market_id))
        logger.info(
            "[%s/%s] Completed. session=%s cost=$%s",
            market_id.upper(), mode,
            result.get("session_id", "?"),
            result.get("total_cost_usd", "?"),
        )
    except Exception:
        logger.exception("[%s/%s] Research job failed", market_id.upper(), mode)


def _run_trading_engine(market_ids: list[str]):
    """Trading Engine を subprocess で実行する（複数マーケットを1接続で処理）"""
    open_markets = [m for m in market_ids if is_market_open(m)]
    if not open_markets:
        logger.info("[trading] No open markets. Skipping.")
        return

    markets_str = ",".join(open_markets)
    logger.info("[trading] Starting trading engine for: %s", markets_str.upper())
    try:
        result = subprocess.run(
            ["uv", "run", "python", "-m", "trading_engine.main", "--market", markets_str],
            cwd=str(settings.trading_engine_dir),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            logger.info("[trading] Completed:\n%s", result.stdout[-500:] if result.stdout else "")
        else:
            logger.error("[trading] Failed (exit %d):\n%s", result.returncode, result.stderr[-500:])
    except subprocess.TimeoutExpired:
        logger.error("[trading] Timed out after 300s")
    except Exception:
        logger.exception("[trading] Trading engine failed")


def _run_research_then_trade(mode: str, market_id: str):
    """Research → Trading Engine を連続実行する"""
    _run_research(mode, market_id)
    # 全オープンマーケットのシグナルをまとめて処理
    enabled = [m.strip() for m in settings.enabled_markets.split(",")]
    _run_trading_engine(enabled)


def start_scheduler():
    """スケジューラを起動する"""
    scheduler = BlockingScheduler(timezone=pytz.UTC)
    enabled = [m.strip() for m in settings.enabled_markets.split(",")]

    for market_id in enabled:
        if market_id not in MARKETS:
            logger.warning("Unknown market: %s. Skipping.", market_id)
            continue

        mkt = MARKETS[market_id]
        tz = pytz.timezone(mkt.timezone)

        # Premarket
        scheduler.add_job(
            _run_research,
            CronTrigger(
                hour=mkt.premarket_hour, minute=mkt.premarket_minute,
                day_of_week="mon-fri", timezone=tz,
            ),
            args=["premarket", market_id],
            id=f"premarket_{market_id}",
            name=f"Premarket Research ({mkt.name})",
        )

        # Intraday + Trading: 市場時間中に30分ごと実行
        intraday_start = mkt.open_hour
        intraday_end = mkt.close_hour - 1  # 閉場1時間前まで
        scheduler.add_job(
            _run_research_then_trade,
            CronTrigger(
                hour=f"{intraday_start}-{intraday_end}",
                minute="5,35",  # 毎時05分と35分 (30分間隔)
                day_of_week="mon-fri", timezone=tz,
            ),
            args=["intraday", market_id],
            id=f"intraday_{market_id}",
            name=f"Intraday Research + Trading ({mkt.name})",
        )

        # EOD Review
        scheduler.add_job(
            _run_research,
            CronTrigger(
                hour=mkt.eod_hour, minute=mkt.eod_minute,
                day_of_week="mon-fri", timezone=tz,
            ),
            args=["eod", market_id],
            id=f"eod_{market_id}",
            name=f"EOD Review ({mkt.name})",
        )

    logger.info("Scheduler started with %d jobs:", len(scheduler.get_jobs()))
    for job in scheduler.get_jobs():
        logger.info("  - %s: %s", job.name, job.trigger)

    # --run-now が指定されていたら即時実行
    if _run_now:
        market_id, mode = _run_now
        logger.info("Immediate execution: %s/%s", market_id.upper(), mode)
        if mode == "intraday":
            _run_research_then_trade(mode, market_id)
        else:
            _run_research(mode, market_id)
        logger.info("Immediate execution done. Continuing with scheduler...")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


_run_now: tuple[str, str] | None = None


def set_run_now(market_id: str, mode: str):
    global _run_now
    _run_now = (market_id, mode)
