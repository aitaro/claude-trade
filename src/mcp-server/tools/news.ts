/** ニュース取得ツール */

import { db } from "../../db/client.js";
import { newsItems } from "../../db/schema.js";
import { loadEnv } from "../../config.js";

const env = loadEnv();

async function fetchFinnhub(path: string): Promise<unknown> {
  const url = `https://finnhub.io/api/v1${path}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json();
}

export async function getNews(
  symbol: string,
  days = 3,
): Promise<Record<string, unknown>> {
  if (!env.FINNHUB_API_KEY) {
    return { error: "FINNHUB_API_KEY not configured" };
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);

  const news = (await fetchFinnhub(
    `/company-news?symbol=${symbol.toUpperCase()}&from=${from}&to=${to}`,
  )) as Array<Record<string, unknown>>;

  const items: Record<string, unknown>[] = [];
  for (const n of news.slice(0, 20)) {
    const publishedAt = n.datetime
      ? new Date((n.datetime as number) * 1000)
      : null;

    await db.insert(newsItems).values({
      source: "finnhub",
      headline: (n.headline as string) || "",
      summary: ((n.summary as string) || "").slice(0, 500),
      url: (n.url as string) || "",
      symbols: [symbol.toUpperCase()],
      publishedAt,
    });

    items.push({
      headline: n.headline,
      summary: ((n.summary as string) || "").slice(0, 500),
      url: n.url,
      published_at: publishedAt?.toISOString() ?? null,
    });
  }

  return { symbol, news: items, count: items.length };
}

export async function searchNews(
  query: string,
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown>[] = [];

  if (env.FINNHUB_API_KEY) {
    const general = (await fetchFinnhub(
      `/news?category=general&minId=0`,
    )) as Array<Record<string, unknown>>;

    for (const n of general.slice(0, 10)) {
      const headline = (n.headline as string) || "";
      const summary = (n.summary as string) || "";
      if (
        headline.toLowerCase().includes(query.toLowerCase()) ||
        summary.toLowerCase().includes(query.toLowerCase())
      ) {
        results.push({
          source: "finnhub",
          headline,
          summary: summary.slice(0, 300),
          url: n.url,
        });
      }
    }
  }

  return { query, results, count: results.length };
}

export async function getEconomicCalendar(): Promise<
  Record<string, unknown>
> {
  if (!env.FINNHUB_API_KEY) {
    return { error: "FINNHUB_API_KEY not configured" };
  }

  const start = new Date(Date.now() - 86400000);
  const end = new Date(Date.now() + 7 * 86400000);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);

  const calendar = (await fetchFinnhub(
    `/calendar/economic?from=${from}&to=${to}`,
  )) as Record<string, unknown>;

  const events: Record<string, unknown>[] = [];
  for (const e of (
    (calendar.economicCalendar as Array<Record<string, unknown>>) ?? []
  ).slice(0, 30)) {
    events.push({
      event: e.event,
      country: e.country,
      date: e.date,
      impact: e.impact,
      actual: e.actual,
      estimate: e.estimate,
      prev: e.prev,
    });
  }

  return { events, count: events.length };
}
