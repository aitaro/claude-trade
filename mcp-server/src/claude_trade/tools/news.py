"""ニュース取得ツール"""

from datetime import datetime, timedelta

import finnhub
import httpx
import feedparser
from sqlalchemy import select
from sqlmodel import col

from claude_trade.config import settings
from claude_trade.db import async_session
from claude_trade.models import NewsItem


def _get_finnhub_client() -> finnhub.Client:
    return finnhub.Client(api_key=settings.finnhub_api_key)


async def get_news(symbol: str, days: int = 3) -> dict:
    """指定銘柄のニュースを取得する (Finnhub)

    Args:
        symbol: ティッカーシンボル
        days: 遡る日数 (デフォルト 3)
    """
    if not settings.finnhub_api_key:
        return {"error": "FINNHUB_API_KEY not configured"}

    client = _get_finnhub_client()
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    news = client.company_news(
        symbol.upper(),
        _from=start.strftime("%Y-%m-%d"),
        to=end.strftime("%Y-%m-%d"),
    )

    items = []
    async with async_session() as session:
        for n in news[:20]:
            item = NewsItem(
                source="finnhub",
                headline=n.get("headline", ""),
                summary=n.get("summary", "")[:500],
                url=n.get("url", ""),
                symbols=[symbol.upper()],
                published_at=datetime.fromtimestamp(n["datetime"]) if n.get("datetime") else None,
            )
            session.add(item)
            items.append({
                "headline": item.headline,
                "summary": item.summary,
                "url": item.url,
                "published_at": item.published_at.isoformat() if item.published_at else None,
            })
        await session.commit()

    return {"symbol": symbol, "news": items, "count": len(items)}


async def search_news(query: str) -> dict:
    """キーワードでニュースを検索する（Finnhub general news + RSS）

    Args:
        query: 検索キーワード
    """
    results = []

    # Finnhub general news
    if settings.finnhub_api_key:
        client = _get_finnhub_client()
        general = client.general_news("general", min_id=0)
        for n in general[:10]:
            headline = n.get("headline", "")
            if query.lower() in headline.lower() or query.lower() in n.get("summary", "").lower():
                results.append({
                    "source": "finnhub",
                    "headline": headline,
                    "summary": n.get("summary", "")[:300],
                    "url": n.get("url", ""),
                })

    return {"query": query, "results": results, "count": len(results)}


async def get_economic_calendar() -> dict:
    """経済カレンダー（今週のイベント）を取得する"""
    if not settings.finnhub_api_key:
        return {"error": "FINNHUB_API_KEY not configured"}

    client = _get_finnhub_client()
    end = datetime.utcnow() + timedelta(days=7)
    start = datetime.utcnow() - timedelta(days=1)

    calendar = client.economic_calendar(
        _from=start.strftime("%Y-%m-%d"),
        to=end.strftime("%Y-%m-%d"),
    )

    events = []
    for e in calendar.get("economicCalendar", [])[:30]:
        events.append({
            "event": e.get("event", ""),
            "country": e.get("country", ""),
            "date": e.get("date", ""),
            "impact": e.get("impact", ""),
            "actual": e.get("actual"),
            "estimate": e.get("estimate"),
            "prev": e.get("prev"),
        })

    return {"events": events, "count": len(events)}
