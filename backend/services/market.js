const axios = require('axios');
const RSSParser = require('rss-parser');

const rss = new RSSParser({ timeout: 8000 });

// Free RSS/API sources — no key required
const NEWS_FEEDS = [
  { name: 'Reuters Markets', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { name: 'Investing.com', url: 'https://www.investing.com/rss/news_25.rss' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse' },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'Bloomberg Economics', url: 'https://feeds.bloomberg.com/economics/news.rss' },
];

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

/**
 * Fetch news from multiple RSS feeds
 */
async function fetchNews(query = '', maxItems = 30) {
  const results = [];

  await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const parsed = await rss.parseURL(feed.url);
        const items = (parsed.items || []).slice(0, 8).map(item => ({
          source: feed.name,
          title: item.title || '',
          summary: (item.contentSnippet || item.summary || '').slice(0, 300),
          url: item.link || '',
          published: item.pubDate || item.isoDate || new Date().toISOString(),
        }));
        results.push(...items);
      } catch (_) {
        // Silently skip unavailable feeds
      }
    })
  );

  // Filter by query if provided
  if (query) {
    const q = query.toLowerCase();
    return results.filter(r =>
      r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)
    ).slice(0, maxItems);
  }

  return results.sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, maxItems);
}

/**
 * Fetch price data using Alpha Vantage (if key provided) or Yahoo Finance fallback
 */
async function fetchPrice(symbol, apiKey = null) {
  // Try Alpha Vantage
  if (apiKey) {
    try {
      const res = await axios.get(ALPHA_VANTAGE_BASE, {
        params: { function: 'GLOBAL_QUOTE', symbol, apikey: apiKey },
        timeout: 8000,
      });
      const q = res.data['Global Quote'];
      if (q && q['05. price']) {
        return {
          symbol,
          price: parseFloat(q['05. price']),
          change: parseFloat(q['09. change']),
          changePercent: parseFloat(q['10. change percent']),
          volume: parseInt(q['06. volume']),
          high: parseFloat(q['03. high']),
          low: parseFloat(q['04. low']),
          source: 'alphavantage',
        };
      }
    } catch (_) {}
  }

  // Fallback: Yahoo Finance unofficial
  try {
    const res = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      { params: { interval: '1d', range: '5d' }, timeout: 8000 }
    );
    const meta = res.data?.chart?.result?.[0]?.meta;
    if (meta) {
      return {
        symbol,
        price: meta.regularMarketPrice,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        volume: meta.regularMarketVolume,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        source: 'yahoo',
      };
    }
  } catch (_) {}

  return null;
}

/**
 * Fetch historical OHLCV — last N days
 */
async function fetchHistory(symbol, days = 30, apiKey = null) {
  if (apiKey) {
    try {
      const res = await axios.get(ALPHA_VANTAGE_BASE, {
        params: { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact', apikey: apiKey },
        timeout: 10000,
      });
      const series = res.data['Time Series (Daily)'];
      if (series) {
        return Object.entries(series).slice(0, days).map(([date, v]) => ({
          date,
          open: parseFloat(v['1. open']),
          high: parseFloat(v['2. high']),
          low: parseFloat(v['3. low']),
          close: parseFloat(v['4. close']),
          volume: parseInt(v['5. volume']),
        }));
      }
    } catch (_) {}
  }

  // Yahoo fallback
  try {
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : '1y';
    const res = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      { params: { interval: '1d', range }, timeout: 10000 }
    );
    const result = res.data?.chart?.result?.[0];
    if (result) {
      const { timestamp, indicators } = result;
      const quotes = indicators.quote[0];
      return timestamp.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i],
      })).filter(d => d.close != null);
    }
  } catch (_) {}

  return [];
}

/**
 * Fetch macro/sentiment news for specific asset + global context
 */
async function fetchMacroContext(symbol) {
  const [assetNews, globalNews] = await Promise.all([
    fetchNews(symbol, 15),
    fetchNews('economy inflation fed rates commodity', 10),
  ]);
  return { assetNews, globalNews };
}

/**
 * Fetch Finnhub company news if key provided
 */
async function fetchFinnhubNews(symbol, apiKey) {
  if (!apiKey) return [];
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const res = await axios.get(`${FINNHUB_BASE}/company-news`, {
      params: { symbol, from, to, token: apiKey },
      timeout: 8000,
    });
    return (res.data || []).slice(0, 10).map(n => ({
      source: n.source,
      title: n.headline,
      summary: n.summary?.slice(0, 300) || '',
      url: n.url,
      published: new Date(n.datetime * 1000).toISOString(),
      sentiment: n.sentiment,
    }));
  } catch (_) { return []; }
}

module.exports = { fetchNews, fetchPrice, fetchHistory, fetchMacroContext, fetchFinnhubNews };
