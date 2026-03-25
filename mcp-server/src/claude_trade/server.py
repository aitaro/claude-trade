"""FastMCP サーバーエントリポイント"""

from contextlib import asynccontextmanager

from fastmcp import FastMCP

from claude_trade.db import init_db
from claude_trade.tools.market_data import get_quote, get_historical_data, get_market_snapshot
from claude_trade.tools.portfolio import get_positions, get_account_summary
from claude_trade.tools.signals import write_signal, get_active_signals
from claude_trade.tools.research import write_research_report, get_recent_reports
from claude_trade.tools.news import get_news, search_news, get_economic_calendar
from claude_trade.tools.audit import get_decision_history, get_order_history, get_session_logs
from claude_trade.tools.analytics import query_performance, get_trade_stats


@asynccontextmanager
async def app_lifespan(server):
    await init_db()
    yield


mcp = FastMCP(
    "Claude Trade",
    instructions="AI Trading Platform - Research Agent MCP Server",
    lifespan=app_lifespan,
)

# Market Data
mcp.tool(get_quote)
mcp.tool(get_historical_data)
mcp.tool(get_market_snapshot)

# Portfolio
mcp.tool(get_positions)
mcp.tool(get_account_summary)

# Signals (Stage 1 → Stage 2 bridge)
mcp.tool(write_signal)
mcp.tool(get_active_signals)

# Research
mcp.tool(write_research_report)
mcp.tool(get_recent_reports)

# News
mcp.tool(get_news)
mcp.tool(search_news)
mcp.tool(get_economic_calendar)

# Audit
mcp.tool(get_decision_history)
mcp.tool(get_order_history)
mcp.tool(get_session_logs)

# Analytics
mcp.tool(query_performance)
mcp.tool(get_trade_stats)


if __name__ == "__main__":
    mcp.run()
