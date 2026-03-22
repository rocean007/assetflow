/**
 * OMNISCIENT DATA COLLECTOR
 *
 * Pulls every possible data signal that could affect asset pricing.
 * All sources are free (no API key required unless stated).
 * Everything runs in parallel. Failures are silently skipped.
 *
 * Categories:
 *   1. Market data       - price, OHLCV history, options, insider trades
 *   2. Financial news    - Reuters, Yahoo, CNBC, Bloomberg, MarketWatch, FT, WSJ
 *   3. Macro/economic    - Fed, ECB, BOJ, BOE, BIS, IMF, World Bank, OECD, BLS, BEA
 *   4. Weather           - 12 agricultural + energy regions (Open-Meteo, free)
 *   5. Commodities       - 20 commodity prices + futures
 *   6. Agriculture       - USDA, FAO, CBOT reports, crop conditions
 *   7. Energy            - EIA, OPEC, IEA, natural gas storage
 *   8. Shipping/trade    - Baltic Dry, container rates, Suez, Panama, port news
 *   9. Geopolitical      - UN, ReliefWeb, crisis alerts, sanctions news
 *  10. Earnings/corp     - earnings calendars, SEC filings news, corporate actions
 *  11. Tech/innovation   - USPTO patents, GitHub trending, HackerNews, AI news
 *  12. Regulatory        - SEC news, CFTC, FDA, FTC, antitrust news
 *  13. Social signals    - Reddit (10 subs), StockTwits, HackerNews, Nitter/X
 *  14. Crypto signals    - Fear & Greed index, crypto news, on-chain proxies
 *  15. Labor/employment  - BLS reports, ADP, layoff news, jobs data
 *  16. Real estate       - housing starts, mortgage rates, REIT news
 *  17. Consumer          - retail sales, consumer confidence, CPI components
 *  18. Healthcare/pharma - FDA approvals, clinical trials news, biotech
 *  19. Environment/ESG   - carbon prices, ESG news, climate policy
 *  20. Options/flow      - unusual options activity proxies via news
 */

const axios = require('axios');
const RSSParser = require('rss-parser');

const rss = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'AssetFlow/1.0 (+https://github.com/assetflow)' },
  customFields: { item: ['media:content', 'media:thumbnail'] }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function safeFeed(url, name, max = 6) {
  try {
    const parsed = await rss.parseURL(url);
    return (parsed.items || []).slice(0, max).map(item => ({
      source: name,
      title: (item.title || '').trim(),
      summary: (item.contentSnippet || item.summary || '').slice(0, 300).trim(),
      url: item.link || '',
      published: item.pubDate || item.isoDate || new Date().toISOString(),
    }));
  } catch (_) { return []; }
}

async function safeGet(url, params = {}, timeout = 8000) {
  try {
    const res = await axios.get(url, {
      params,
      timeout,
      headers: { 'User-Agent': 'AssetFlow/1.0', Accept: 'application/json' }
    });
    return res.data;
  } catch (_) { return null; }
}

async function parallel(fns) {
  const results = await Promise.allSettled(fns.map(f => f()));
  return results.map(r => (r.status === 'fulfilled' ? r.value : null));
}

// ─── 1. MARKET DATA ──────────────────────────────────────────────────────────

async function fetchPrice(symbol, avKey = null) {
  if (avKey) {
    const d = await safeGet('https://www.alphavantage.co/query', { function: 'GLOBAL_QUOTE', symbol, apikey: avKey });
    const q = d?.['Global Quote'];
    if (q?.['05. price']) return {
      symbol, price: parseFloat(q['05. price']), change: parseFloat(q['09. change']),
      changePct: parseFloat(q['10. change percent']), volume: parseInt(q['06. volume']),
      high: parseFloat(q['03. high']), low: parseFloat(q['04. low']), source: 'alphavantage'
    };
  }
  const d = await safeGet(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, { interval: '1d', range: '5d' });
  const meta = d?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;
  const change = meta.regularMarketPrice - meta.previousClose;
  return {
    symbol, price: meta.regularMarketPrice,
    change, changePct: (change / meta.previousClose) * 100,
    volume: meta.regularMarketVolume, high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow, marketCap: meta.marketCap || null, source: 'yahoo'
  };
}

async function fetchHistory(symbol, days = 60, avKey = null) {
  if (avKey) {
    const d = await safeGet('https://www.alphavantage.co/query', { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact', apikey: avKey });
    const series = d?.['Time Series (Daily)'];
    if (series) return Object.entries(series).slice(0, days).map(([date, v]) => ({
      date, open: parseFloat(v['1. open']), high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']), close: parseFloat(v['4. close']), volume: parseInt(v['5. volume'])
    }));
  }
  const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : '1y';
  const d = await safeGet(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, { interval: '1d', range });
  const result = d?.chart?.result?.[0];
  if (!result) return [];
  const { timestamp, indicators } = result;
  const q = indicators.quote[0];
  return timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i]
  })).filter(d => d.close != null);
}

async function fetchOptionsSummary(symbol) {
  const d = await safeGet(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`);
  const chain = d?.optionChain?.result?.[0];
  if (!chain) return null;
  const calls = chain.options?.[0]?.calls || [];
  const puts = chain.options?.[0]?.puts || [];
  const totalCallOI = calls.reduce((s, c) => s + (c.openInterest || 0), 0);
  const totalPutOI = puts.reduce((s, c) => s + (c.openInterest || 0), 0);
  const pcRatio = totalPutOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : null;
  return {
    putCallRatio: pcRatio,
    totalCallOI, totalPutOI,
    impliedVolatility: calls[0]?.impliedVolatility?.toFixed(3) || null,
    signal: pcRatio ? (parseFloat(pcRatio) > 1.2 ? 'bearish_options' : parseFloat(pcRatio) < 0.7 ? 'bullish_options' : 'neutral_options') : 'unknown'
  };
}

async function fetchAnalystRatings(symbol) {
  const d = await safeGet(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
    { modules: 'financialData,recommendationTrend,upgradeDowngradeHistory' });
  const s = d?.quoteSummary?.result?.[0];
  if (!s) return null;
  return {
    targetPrice: s.financialData?.targetMeanPrice?.raw,
    currentPrice: s.financialData?.currentPrice?.raw,
    recommendation: s.financialData?.recommendationKey,
    numAnalysts: s.financialData?.numberOfAnalystOpinions?.raw,
    recentUpgrades: (s.upgradeDowngradeHistory?.history || []).slice(0, 3).map(h => ({
      firm: h.firm, action: h.action, toGrade: h.toGrade, date: h.epochGradeDate
    }))
  };
}

async function fetchEarningsData(symbol) {
  const d = await safeGet(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
    { modules: 'calendarEvents,earningsHistory,earningsTrend' });
  const s = d?.quoteSummary?.result?.[0];
  if (!s) return null;
  const nextDate = s.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  return {
    nextEarningsDate: nextDate ? new Date(nextDate * 1000).toISOString().split('T')[0] : null,
    epsEstimate: s.earningsTrend?.trend?.[0]?.earningsEstimate?.avg?.raw,
    revenueEstimate: s.earningsTrend?.trend?.[0]?.revenueEstimate?.avg?.raw,
    lastSurprise: s.earningsHistory?.history?.[0]?.surprisePercent?.raw
  };
}

async function fetchInsiderActivity(symbol) {
  const d = await safeGet(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
    { modules: 'insiderTransactions' });
  const txns = d?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions || [];
  const buys = txns.filter(t => t.transactionText?.toLowerCase().includes('buy'));
  const sells = txns.filter(t => t.transactionText?.toLowerCase().includes('sell'));
  return { recentBuys: buys.length, recentSells: sells.length, netSentiment: buys.length > sells.length ? 'buy' : sells.length > buys.length ? 'sell' : 'neutral' };
}

async function fetchShortInterest(symbol) {
  const d = await safeGet(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`,
    { modules: 'defaultKeyStatistics' });
  const s = d?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
  if (!s) return null;
  return {
    shortRatio: s.shortRatio?.raw,
    shortPercentFloat: s.shortPercentOfFloat?.raw,
    sharesShort: s.sharesShort?.raw,
    signal: s.shortPercentOfFloat?.raw > 0.2 ? 'high_short_interest' : 'normal'
  };
}

// ─── 2. FINANCIAL NEWS ───────────────────────────────────────────────────────

const NEWS_FEEDS = [
  ['https://feeds.reuters.com/reuters/businessNews', 'Reuters Business'],
  ['https://feeds.reuters.com/reuters/technologyNews', 'Reuters Tech'],
  ['https://finance.yahoo.com/news/rssindex', 'Yahoo Finance'],
  ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC Markets'],
  ['https://www.cnbc.com/id/10000664/device/rss/rss.html', 'CNBC Business'],
  ['https://feeds.content.dowjones.io/public/rss/mw_marketpulse', 'MarketWatch'],
  ['https://feeds.content.dowjones.io/public/rss/mw_topstories', 'MarketWatch Top'],
  ['https://feeds.bloomberg.com/economics/news.rss', 'Bloomberg Economics'],
  ['https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'NYT Business'],
  ['https://www.ft.com/?format=rss', 'Financial Times'],
  ['https://seekingalpha.com/market_currents.xml', 'Seeking Alpha'],
  ['https://www.wsj.com/xml/rss/3_7085.xml', 'WSJ Markets'],
  ['https://www.wsj.com/xml/rss/3_7014.xml', 'WSJ Business'],
  ['https://feeds.a.dj.com/rss/RSSMarketsMain.xml', 'Dow Jones Markets'],
  ['https://www.investing.com/rss/news_25.rss', 'Investing.com'],
  ['https://www.zerohedge.com/fullrss2.xml', 'ZeroHedge'],
  ['https://thestreet.com/.rss/full/', 'TheStreet'],
  ['https://www.fool.com/feeds/index.aspx', 'Motley Fool'],
  ['https://finance.yahoo.com/rss/2.0/headline?s=MARKET&region=US&lang=en-US', 'Yahoo Market Headlines'],
];

async function fetchFinancialNews(symbol) {
  const allFeeds = await parallel(
    NEWS_FEEDS.map(([url, name]) => () => safeFeed(url, name, 6))
  );
  const all = allFeeds.flat().filter(Boolean);
  const q = symbol.toLowerCase();
  const relevant = all.filter(n => n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q));
  const general = all.filter(n => !relevant.includes(n));
  return {
    assetSpecific: relevant.slice(0, 20),
    general: general.sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 30)
  };
}

// ─── 3. MACRO / CENTRAL BANKS ────────────────────────────────────────────────

const MACRO_FEEDS = [
  ['https://www.federalreserve.gov/feeds/press_all.xml', 'Federal Reserve'],
  ['https://www.ecb.europa.eu/rss/press.html', 'ECB'],
  ['https://www.boj.or.jp/en/announcements/release_2024/rss.xml', 'Bank of Japan'],
  ['https://www.bankofengland.co.uk/rss/news', 'Bank of England'],
  ['https://www.bis.org/doclist/all_speeches.rss', 'BIS Speeches'],
  ['https://www.imf.org/en/News/rss?language=eng', 'IMF'],
  ['https://blogs.worldbank.org/rss.xml', 'World Bank'],
  ['https://www.oecd.org/newsroom/rss/', 'OECD'],
  ['https://www.bls.gov/bls/news.rss', 'BLS (US Jobs/CPI)'],
  ['https://apps.bea.gov/rss/rss.xml', 'BEA (US GDP)'],
  ['https://www.treasury.gov/resource-center/data-chart-center/interest-rates/rss/rss.xml', 'US Treasury'],
  ['https://www.cbo.gov/taxonomy/term/5/feed', 'CBO Budget'],
];

async function fetchMacroData() {
  const results = await parallel(MACRO_FEEDS.map(([url, name]) => () => safeFeed(url, name, 5)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── 4. WEATHER — 12 REGIONS ─────────────────────────────────────────────────

const WEATHER_REGIONS = [
  { name: 'US Midwest (corn/soy belt)', lat: 41.5, lon: -93.6, importance: 'corn, soy, ethanol' },
  { name: 'Great Plains (wheat)', lat: 38.5, lon: -98.0, importance: 'winter wheat' },
  { name: 'Ukraine/Black Sea (wheat)', lat: 48.4, lon: 31.2, importance: 'wheat, sunflower, corn' },
  { name: 'Brazil (soy/coffee/sugar)', lat: -14.2, lon: -51.9, importance: 'soybeans, coffee, sugar, ethanol' },
  { name: 'India (wheat/rice/cotton)', lat: 20.6, lon: 79.1, importance: 'wheat, rice, cotton, onion' },
  { name: 'Australia (wheat/coal)', lat: -27.5, lon: 133.8, importance: 'wheat, coal, LNG' },
  { name: 'Indonesia (palm oil/coal)', lat: -0.8, lon: 113.9, importance: 'palm oil, coal, rubber' },
  { name: 'Texas/Gulf Coast (oil/gas)', lat: 29.7, lon: -95.4, importance: 'crude oil, natural gas, petrochemicals' },
  { name: 'North Sea (oil/gas)', lat: 56.0, lon: 3.0, importance: 'Brent crude, natural gas' },
  { name: 'China (manufacturing/pork)', lat: 35.0, lon: 105.0, importance: 'pork, manufacturing disruption' },
  { name: 'Argentina (soy/corn)', lat: -34.6, lon: -58.4, importance: 'soybeans, corn, beef' },
  { name: 'West Africa (cocoa/oil)', lat: 5.3, lon: -4.0, importance: 'cocoa, crude oil' },
];

const WMO_CODES = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Heavy showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm+hail', 99: 'Thunderstorm+heavy hail'
};

async function fetchWeather() {
  const results = await parallel(WEATHER_REGIONS.map(region => async () => {
    const d = await safeGet('https://api.open-meteo.com/v1/forecast', {
      latitude: region.lat, longitude: region.lon,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,et0_fao_evapotranspiration',
      forecast_days: 4, timezone: 'auto'
    }, 10000);
    if (!d?.daily) return null;
    const dy = d.daily;
    const days = dy.time.map((date, i) => ({
      date,
      maxTemp: dy.temperature_2m_max?.[i],
      minTemp: dy.temperature_2m_min?.[i],
      rain: dy.precipitation_sum?.[i],
      wind: dy.windspeed_10m_max?.[i],
      evapotranspiration: dy.et0_fao_evapotranspiration?.[i],
      condition: WMO_CODES[dy.weathercode?.[i]] || `Code ${dy.weathercode?.[i]}`,
      code: dy.weathercode?.[i]
    }));
    const tomorrow = days[1] || days[0];
    const alerts = [];
    if (tomorrow.rain > 30) alerts.push(`FLOOD RISK: ${tomorrow.rain}mm rain`);
    if (tomorrow.rain === 0 && days[0].rain === 0 && days[2]?.rain === 0) alerts.push('DROUGHT: 3-day zero rainfall');
    if (tomorrow.maxTemp > 40) alerts.push(`EXTREME HEAT: ${tomorrow.maxTemp}C - crop stress`);
    if (tomorrow.minTemp < -3) alerts.push(`FROST RISK: ${tomorrow.minTemp}C - crop damage`);
    if (tomorrow.wind > 70) alerts.push(`STORM: ${tomorrow.wind}km/h winds`);
    if ([95, 96, 99].includes(tomorrow.code)) alerts.push('THUNDERSTORM forecast');
    if ([71, 73, 75, 85, 86].includes(tomorrow.code)) alerts.push('SNOW/BLIZZARD forecast');
    return { region: region.name, importance: region.importance, days, tomorrow, alerts, significant: alerts.length > 0 };
  }));
  return results.filter(Boolean);
}

// ─── 5. COMMODITIES ─────────────────────────────────────────────────────────

const COMMODITY_SYMBOLS = [
  ['GC=F', 'Gold'], ['SI=F', 'Silver'], ['PL=F', 'Platinum'],
  ['CL=F', 'WTI Crude Oil'], ['BZ=F', 'Brent Crude'], ['NG=F', 'Natural Gas'],
  ['ZW=F', 'Wheat'], ['ZC=F', 'Corn'], ['ZS=F', 'Soybeans'], ['ZO=F', 'Oats'],
  ['KC=F', 'Coffee'], ['CT=F', 'Cotton'], ['CC=F', 'Cocoa'], ['SB=F', 'Sugar'],
  ['LE=F', 'Live Cattle'], ['GF=F', 'Feeder Cattle'], ['HE=F', 'Lean Hogs'],
  ['HG=F', 'Copper'], ['ALI=F', 'Aluminum'], ['DX-Y.NYB', 'USD Index'],
  ['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum'], ['^VIX', 'VIX Fear Index'],
  ['^TNX', 'US 10Y Yield'], ['^TYX', 'US 30Y Yield'], ['^IRX', 'US 3M Rate'],
  ['EURUSD=X', 'EUR/USD'], ['JPY=X', 'USD/JPY'], ['GBP=X', 'GBP/USD'], ['CNY=X', 'USD/CNY']
];

async function fetchCommodities() {
  const results = await parallel(COMMODITY_SYMBOLS.map(([sym, name]) => async () => {
    const d = await safeGet(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`, { interval: '1d', range: '2d' }, 6000);
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const pct = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100);
    return { symbol: sym, name, price: meta.regularMarketPrice, changePct: parseFloat(pct.toFixed(2)), direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
  }));
  return results.filter(Boolean);
}

// ─── 6. AGRICULTURE ──────────────────────────────────────────────────────────

const AGRI_FEEDS = [
  ['https://www.usda.gov/rss/home.xml', 'USDA'],
  ['https://www.fao.org/news/rss-feed/en/', 'FAO'],
  ['https://www.agweb.com/rss/news', 'AgWeb'],
  ['https://www.farmprogress.com/rss/all', 'Farm Progress'],
  ['https://www.agriculture.com/rss', 'Agriculture.com'],
  ['https://www.world-grain.com/rss/all', 'World Grain'],
  ['https://www.coffeereview.com/feed/', 'Coffee Review'],
];
async function fetchAgricultureNews() {
  const results = await parallel(AGRI_FEEDS.map(([url, name]) => () => safeFeed(url, name, 5)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── 7. ENERGY ───────────────────────────────────────────────────────────────

const ENERGY_FEEDS = [
  ['https://www.eia.gov/rss/news.xml', 'EIA Energy'],
  ['https://oilprice.com/rss/main', 'OilPrice.com'],
  ['https://www.ogj.com/rss/all-news.rss', 'Oil & Gas Journal'],
  ['https://www.naturalgasintel.com/rss/', 'Natural Gas Intel'],
  ['https://pv-tech.org/feed/', 'PV-Tech Solar'],
  ['https://electrek.co/feed/', 'Electrek EV/Clean'],
  ['https://www.renewableenergyworld.com/feed/', 'Renewable Energy World'],
];
async function fetchEnergyNews() {
  const results = await parallel(ENERGY_FEEDS.map(([url, name]) => () => safeFeed(url, name, 5)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

async function fetchNaturalGasStorage() {
  const feeds = await safeFeed('https://www.eia.gov/naturalgas/storage/dashboard/rss.xml', 'EIA Nat Gas Storage', 3);
  return feeds;
}

// ─── 8. SHIPPING / TRADE ─────────────────────────────────────────────────────

const SHIPPING_FEEDS = [
  ['https://splash247.com/feed/', 'Splash247'],
  ['https://www.tradewindsnews.com/rss', 'TradeWinds'],
  ['https://www.freightwaves.com/news/feed', 'FreightWaves'],
  ['https://www.hellenicshippingnews.com/feed/', 'Hellenic Shipping'],
  ['https://lloydslist.com/rss', 'Lloyds List'],
  ['https://www.joc.com/rss.xml', 'Journal of Commerce'],
];

async function fetchShippingData() {
  const [news, bdi] = await parallel([
    async () => {
      const feeds = await parallel(SHIPPING_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
      return feeds.flat().filter(Boolean);
    },
    async () => {
      const d = await safeGet('https://query1.finance.yahoo.com/v8/finance/chart/BDI', { interval: '1d', range: '5d' }, 6000);
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;
      const pct = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100);
      return {
        value: meta.regularMarketPrice,
        changePct: parseFloat(pct.toFixed(2)),
        direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat',
        note: 'Baltic Dry Index: rising = more shipping demand = global trade expansion'
      };
    }
  ]);
  return { news: news || [], bdi: bdi || null };
}

// ─── 9. GEOPOLITICAL ─────────────────────────────────────────────────────────

const GEO_FEEDS = [
  ['https://reliefweb.int/headlines/rss.xml', 'ReliefWeb Crises'],
  ['https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'UN News'],
  ['https://www.crisisgroup.org/rss.xml', 'ICG Crisis Group'],
  ['https://rss.cfr.org/cfr_all', 'CFR Foreign Policy'],
  ['https://foreignpolicy.com/feed/', 'Foreign Policy'],
  ['https://www.chathamhouse.org/rss.xml', 'Chatham House'],
  ['https://feeds.reuters.com/reuters/worldNews', 'Reuters World'],
  ['https://www.aljazeera.com/xml/rss/all.xml', 'Al Jazeera'],
  ['https://www.bbc.co.uk/news/world/rss.xml', 'BBC World'],
];
async function fetchGeopoliticalNews() {
  const results = await parallel(GEO_FEEDS.map(([url, name]) => () => safeFeed(url, name, 5)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── 10. EARNINGS / CORPORATE ────────────────────────────────────────────────

const EARNINGS_FEEDS = [
  ['https://feeds.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=20&search_text=&output=atom', 'SEC 8-K Filings'],
  ['https://feeds.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=10-Q&dateb=&owner=include&count=10&search_text=&output=atom', 'SEC 10-Q Filings'],
  ['https://www.earningswhispers.com/rss/earningscalendar.rss', 'Earnings Whispers'],
  ['https://feeds.reuters.com/reuters/companyNews', 'Reuters Corporate'],
];
async function fetchEarningsNews() {
  const results = await parallel(EARNINGS_FEEDS.map(([url, name]) => () => safeFeed(url, name, 5)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── 11. TECH / INNOVATION ───────────────────────────────────────────────────

const TECH_FEEDS = [
  ['https://news.ycombinator.com/rss', 'HackerNews'],
  ['https://techcrunch.com/feed/', 'TechCrunch'],
  ['https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica'],
  ['https://www.theverge.com/rss/index.xml', 'The Verge'],
  ['https://venturebeat.com/feed/', 'VentureBeat'],
  ['https://feeds.reuters.com/reuters/technologyNews', 'Reuters Tech'],
  ['https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'NYT Tech'],
  ['https://www.wired.com/feed/rss', 'Wired'],
];
async function fetchTechNews(symbol) {
  const results = await parallel(TECH_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  const all = results.flat().filter(Boolean);
  const q = symbol.toLowerCase();
  return {
    assetSpecific: all.filter(n => n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q)).slice(0, 8),
    general: all.sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 15)
  };
}

// ─── 12. REGULATORY ──────────────────────────────────────────────────────────

const REG_FEEDS = [
  ['https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&dateb=&owner=include&count=10&search_text=&output=atom', 'SEC Latest'],
  ['https://www.cftc.gov/rss/pressroom.xml', 'CFTC'],
  ['https://www.ftc.gov/feeds/news-feed', 'FTC Antitrust'],
  ['https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml', 'FDA'],
  ['https://www.federalregister.gov/api/v1/articles.rss?agencies[]=securities-and-exchange-commission', 'Federal Register SEC'],
  ['https://www.europarl.europa.eu/rss/en/press-releases-full.xml', 'EU Parliament'],
];
async function fetchRegulatoryNews() {
  const results = await parallel(REG_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── 13. SOCIAL MEDIA ────────────────────────────────────────────────────────

function scoreManipulation(post) {
  let score = 0;
  const text = `${post.title} ${post.body || ''}`.toLowerCase();
  if (/\$\d{2,6}(\s|$)/.test(text) && !/(because|due to|analysis|earnings|revenue|data|report)/.test(text)) score += 20;
  if (/(rocket|moon|lambo|apes|hodl|diamond.hand|tendies|squeeze)/.test(text)) score += 20;
  if ((text.match(/[A-Z]{4,}/g) || []).length > 3) score += 10;
  if (/not.financial.advice/.test(text) && /(buy|calls|puts|long|short|yolo)/.test(text)) score += 15;
  if (post.score > 10000 && post.ageMinutes != null && post.ageMinutes < 90) score += 25;
  if ((text.match(/\b[A-Z]{2,5}\b/g) || []).length > 10) score += 10;
  return Math.min(100, score);
}

const REDDIT_SUBS = ['stocks', 'investing', 'wallstreetbets', 'SecurityAnalysis', 'StockMarket', 'options', 'dividends', 'ValueInvesting', 'ETFs', 'Superstonk'];

async function fetchReddit(symbol) {
  const results = await parallel(REDDIT_SUBS.map(sub => async () => {
    const d = await safeGet(`https://www.reddit.com/r/${sub}/search.json`,
      { q: symbol, sort: 'new', limit: 10, t: 'day', restrict_sr: 1 }, 10000);
    return (d?.data?.children || []).map(({ data: p }) => {
      const ageMinutes = (Date.now() / 1000 - p.created_utc) / 60;
      const post = { platform: 'reddit', sub: `r/${sub}`, title: p.title || '', body: (p.selftext || '').slice(0, 400), score: p.score || 0, comments: p.num_comments || 0, upvoteRatio: p.upvote_ratio || 0.5, published: new Date(p.created_utc * 1000).toISOString(), ageMinutes };
      post.manipScore = scoreManipulation(post);
      return post;
    });
  }));
  return results.flat().filter(Boolean).sort((a, b) => new Date(b.published) - new Date(a.published));
}

async function fetchStockTwits(symbol) {
  const d = await safeGet(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`);
  return (d?.messages || []).slice(0, 30).map(m => {
    const post = { platform: 'stocktwits', sub: 'StockTwits', title: (m.body || '').slice(0, 200), body: '', score: m.likes?.total || 0, published: m.created_at || '', nativeSentiment: m.entities?.sentiment?.basic || null };
    post.manipScore = scoreManipulation(post);
    return post;
  });
}

async function fetchNitter(symbol) {
  const instances = ['https://nitter.poast.org', 'https://nitter.privacydev.net', 'https://nitter.1d4.us'];
  for (const inst of instances) {
    try {
      const parsed = await rss.parseURL(`${inst}/search/rss?q=%24${symbol}&f=tweets`);
      return (parsed.items || []).slice(0, 20).map(item => {
        const post = { platform: 'x', sub: 'Twitter/X', title: (item.title || '').slice(0, 200), body: '', score: 0, published: item.pubDate || '' };
        post.manipScore = scoreManipulation(post);
        return post;
      });
    } catch (_) {}
  }
  return [];
}

async function fetchHackerNews(symbol) {
  const d = await safeGet('https://hn.algolia.com/api/v1/search_by_date', { query: symbol, tags: '(story,comment)', hitsPerPage: 15 });
  return (d?.hits || []).map(h => ({ platform: 'hackernews', sub: 'HackerNews', title: h.title || h.comment_text?.slice(0, 100) || '', body: '', score: h.points || 0, published: h.created_at || '', manipScore: 5 }));
}

async function fetchAllSocial(symbol) {
  const [reddit, stocktwits, nitter, hn] = await parallel([
    () => fetchReddit(symbol),
    () => fetchStockTwits(symbol),
    () => fetchNitter(symbol),
    () => fetchHackerNews(symbol)
  ]).then(r => r.map(x => x || []));

  const all = [...reddit, ...stocktwits, ...nitter, ...hn];
  const clean = all.filter(p => p.manipScore < 40);
  const suspicious = all.filter(p => p.manipScore >= 40);
  const st = stocktwits.filter(p => p.nativeSentiment);
  const stBull = st.filter(p => p.nativeSentiment === 'Bullish').length;
  const stBear = st.filter(p => p.nativeSentiment === 'Bearish').length;

  const topPosts = clean.slice(0, 25).map(p =>
    `[${p.platform}/${p.sub}] ${p.title.slice(0, 120)} (score:${p.score}, manip:${p.manipScore}%)`
  ).join('\n');

  const suspectedPosts = suspicious.slice(0, 8).map(p =>
    `[FLAGGED:${p.manipScore}%][${p.platform}] ${p.title.slice(0, 100)}`
  ).join('\n');

  return {
    all, clean, suspicious,
    stats: {
      total: all.length, clean: clean.length, suspicious: suspicious.length,
      byPlatform: { reddit: reddit.length, stocktwits: stocktwits.length, x: nitter.length, hackernews: hn.length },
      stocktwitsSentiment: st.length ? { bullish: stBull, bearish: stBear, total: st.length } : null
    },
    summaryText: `SOCIAL SIGNALS FOR ${symbol}:\nTotal posts: ${all.length} (${clean.length} credible, ${suspicious.length} flagged for manipulation)\nBy platform: Reddit=${reddit.length} StockTwits=${stocktwits.length} X=${nitter.length} HN=${hn.length}\n${st.length ? `StockTwits native sentiment: ${stBull} Bullish / ${stBear} Bearish of ${st.length}\n` : ''}\nCREDIBLE POSTS:\n${topPosts || 'None found'}\n\nFLAGGED (possible manipulation - note: the attempt itself is a signal):\n${suspectedPosts || 'None flagged'}\n\nINSTRUCTION: Weight clean social signals at 10-20% of fundamental signals. A coordination attempt (many flagged posts pushing same direction) may itself predict a short-term price move worth noting.`
  };
}

// ─── 14. CRYPTO SPECIFIC ─────────────────────────────────────────────────────

async function fetchCryptoSignals(symbol) {
  const isCrypto = /btc|eth|crypto|coin|token/i.test(symbol);
  if (!isCrypto) return null;
  const feeds = await parallel([
    () => safeFeed('https://cointelegraph.com/rss', 'CoinTelegraph', 6),
    () => safeFeed('https://decrypt.co/feed', 'Decrypt', 6),
    () => safeFeed('https://coindesk.com/arc/outboundfeeds/rss/', 'CoinDesk', 6),
    async () => {
      const d = await safeGet('https://api.alternative.me/fng/');
      if (!d?.data?.[0]) return null;
      return { source: 'Alternative.me', fearGreed: d.data[0].value, classification: d.data[0].value_classification, title: `Crypto Fear & Greed Index: ${d.data[0].value} (${d.data[0].value_classification})` };
    }
  ]);
  return feeds.flat().filter(Boolean);
}

// ─── 15. LABOR / EMPLOYMENT ──────────────────────────────────────────────────

const LABOR_FEEDS = [
  ['https://www.bls.gov/bls/news.rss', 'BLS Employment'],
  ['https://feeds.reuters.com/reuters/businessNews', 'Reuters Labor'],
  ['https://layoffs.fyi/feed/', 'Layoffs.fyi'],
  ['https://www.shrm.org/pages/news.aspx', 'SHRM HR'],
];
async function fetchLaborData() {
  const results = await parallel(LABOR_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  return results.flat().filter(Boolean);
}

// ─── 16. HEALTHCARE / PHARMA ─────────────────────────────────────────────────

const HEALTH_FEEDS = [
  ['https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml', 'FDA Press Releases'],
  ['https://www.statnews.com/feed/', 'STAT News'],
  ['https://feeds.reuters.com/reuters/healthNews', 'Reuters Health'],
  ['https://www.fiercepharma.com/rss/xml', 'Fierce Pharma'],
  ['https://www.biopharmadive.com/feeds/news/', 'BioPharma Dive'],
];
async function fetchHealthcareNews(symbol) {
  const results = await parallel(HEALTH_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  const all = results.flat().filter(Boolean);
  const q = symbol.toLowerCase();
  return {
    assetSpecific: all.filter(n => n.title.toLowerCase().includes(q)).slice(0, 6),
    general: all.sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 10)
  };
}

// ─── 17. CONSUMER / RETAIL ───────────────────────────────────────────────────

const CONSUMER_FEEDS = [
  ['https://feeds.reuters.com/reuters/businessNews', 'Reuters Consumer'],
  ['https://www.consumeraffairs.com/news_index.rss', 'ConsumerAffairs'],
  ['https://nrf.com/rss.xml', 'NRF Retail'],
  ['https://www.chainstoreage.com/rss.xml', 'Chain Store Age'],
];
async function fetchConsumerData() {
  const results = await parallel(CONSUMER_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  return results.flat().filter(Boolean);
}

// ─── 18. ENVIRONMENT / ESG ───────────────────────────────────────────────────

const ESG_FEEDS = [
  ['https://www.esgtoday.com/feed/', 'ESG Today'],
  ['https://www.carbonbrief.org/feed/', 'Carbon Brief'],
  ['https://www.climatechangenews.com/feed/', 'Climate Change News'],
];
async function fetchESGNews() {
  const results = await parallel(ESG_FEEDS.map(([url, name]) => () => safeFeed(url, name, 4)));
  return results.flat().filter(Boolean);
}

// ─── MASTER WORLD STATE BUILDER ──────────────────────────────────────────────

async function buildWorldState(symbol) {
  console.log(`  [data] Fetching omniscient world state for ${symbol}...`);

  const [
    price, history, optionsSummary, analystRatings, earningsData,
    insiderActivity, shortInterest, financialNews, macroData,
    weather, commodities, agriNews, energyNews, naturalGasStorage,
    shippingData, geopoliticalNews, earningsNews, techNews,
    regulatoryNews, socialData, cryptoSignals, laborData,
    healthcareNews, consumerData, esgNews
  ] = await parallel([
    () => fetchPrice(symbol),
    () => fetchHistory(symbol, 60),
    () => fetchOptionsSummary(symbol),
    () => fetchAnalystRatings(symbol),
    () => fetchEarningsData(symbol),
    () => fetchInsiderActivity(symbol),
    () => fetchShortInterest(symbol),
    () => fetchFinancialNews(symbol),
    () => fetchMacroData(),
    () => fetchWeather(),
    () => fetchCommodities(),
    () => fetchAgricultureNews(),
    () => fetchEnergyNews(),
    () => fetchNaturalGasStorage(),
    () => fetchShippingData(),
    () => fetchGeopoliticalNews(),
    () => fetchEarningsNews(),
    () => fetchTechNews(symbol),
    () => fetchRegulatoryNews(),
    () => fetchAllSocial(symbol),
    () => fetchCryptoSignals(symbol),
    () => fetchLaborData(),
    () => fetchHealthcareNews(symbol),
    () => fetchConsumerData(),
    () => fetchESGNews()
  ]);

  return {
    fetchedAt: new Date().toISOString(), symbol,
    price, history, optionsSummary, analystRatings, earningsData,
    insiderActivity, shortInterest, financialNews, macroData,
    weather, commodities, agriNews, energyNews, naturalGasStorage,
    shippingData, geopoliticalNews, earningsNews, techNews,
    regulatoryNews, social: socialData, cryptoSignals, laborData,
    healthcareNews, consumerData, esgNews
  };
}

// ─── SERIALIZE TO LLM CONTEXT ────────────────────────────────────────────────

function serializeForAgent(ws, role) {
  if (!ws) return 'World state unavailable.';
  const lines = [`=== WORLD STATE FOR ${ws.symbol} (fetched ${ws.fetchedAt?.slice(0, 16)} UTC) ===\n`];

  // Price & market data
  if (ws.price) {
    lines.push(`PRICE: $${ws.price.price?.toFixed(4)} (${ws.price.changePct >= 0 ? '+' : ''}${ws.price.changePct?.toFixed(2)}% today, vol ${ws.price.volume?.toLocaleString()})`);
    if (ws.price.marketCap) lines.push(`Market Cap: $${(ws.price.marketCap / 1e9).toFixed(1)}B`);
  }
  if (ws.optionsSummary) {
    lines.push(`OPTIONS: Put/Call ratio=${ws.optionsSummary.putCallRatio} | Signal=${ws.optionsSummary.signal} | IV=${ws.optionsSummary.impliedVolatility}`);
  }
  if (ws.shortInterest?.shortPercentFloat) {
    lines.push(`SHORT INTEREST: ${(ws.shortInterest.shortPercentFloat * 100).toFixed(1)}% of float (${ws.shortInterest.signal})`);
  }
  if (ws.analystRatings) {
    lines.push(`ANALYST CONSENSUS: ${ws.analystRatings.recommendation?.toUpperCase()} | Target $${ws.analystRatings.targetPrice} (${ws.analystRatings.numAnalysts} analysts)`);
    if (ws.analystRatings.recentUpgrades?.length) lines.push(`  Recent ratings: ${ws.analystRatings.recentUpgrades.map(u => `${u.firm}: ${u.action} -> ${u.toGrade}`).join(', ')}`);
  }
  if (ws.earningsData?.nextEarningsDate) {
    lines.push(`EARNINGS: Next date=${ws.earningsData.nextEarningsDate} | EPS est=$${ws.earningsData.epsEstimate?.toFixed(2)} | Last surprise=${ws.earningsData.lastSurprise?.toFixed(1)}%`);
  }
  if (ws.insiderActivity) {
    lines.push(`INSIDER ACTIVITY: ${ws.insiderActivity.recentBuys} buys vs ${ws.insiderActivity.recentSells} sells (${ws.insiderActivity.netSentiment})`);
  }

  // PRICE HISTORY
  if (ws.history?.length) {
    lines.push(`\nPRICE HISTORY (last 20 days):`);
    ws.history.slice(0, 20).forEach(h => lines.push(`  ${h.date} O=${h.open?.toFixed(2)} H=${h.high?.toFixed(2)} L=${h.low?.toFixed(2)} C=${h.close?.toFixed(2)} V=${h.volume?.toLocaleString()}`));
  }

  // Asset-specific news
  const assetNews = [
    ...(ws.financialNews?.assetSpecific || []),
    ...(ws.techNews?.assetSpecific || []),
    ...(ws.healthcareNews?.assetSpecific || [])
  ];
  if (assetNews.length) {
    lines.push(`\nASSOCIATED NEWS (${assetNews.length} stories):`);
    assetNews.slice(0, 20).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Weather - show ALL significant alerts, plus context
  const sigWeather = (ws.weather || []).filter(w => w.significant);
  const allWeather = ws.weather || [];
  lines.push(`\nWEATHER FORECAST (${allWeather.length} agricultural/energy regions):`);
  allWeather.forEach(w => {
    const s = w.significant ? ' *** ALERT ***' : '';
    lines.push(`  ${w.region} [${w.importance}]${s}`);
    lines.push(`    Tomorrow: ${w.tomorrow?.condition}, max=${w.tomorrow?.maxTemp}C, rain=${w.tomorrow?.rain}mm, wind=${w.tomorrow?.wind}km/h`);
    if (w.alerts.length) w.alerts.forEach(a => lines.push(`    >>> ${a}`));
  });

  // Commodities
  if (ws.commodities?.length) {
    lines.push(`\nCOMMODITY & MARKET PRICES (${ws.commodities.length} instruments):`);
    ws.commodities.forEach(c => {
      const arr = c.direction === 'up' ? 'UP' : c.direction === 'down' ? 'DN' : '--';
      lines.push(`  [${arr}] ${c.name}: $${c.price} (${c.changePct > 0 ? '+' : ''}${c.changePct}%)`);
    });
  }

  // Shipping
  if (ws.shippingData?.bdi) {
    lines.push(`\nSHIPPING: Baltic Dry Index=${ws.shippingData.bdi.value} (${ws.shippingData.bdi.changePct > 0 ? '+' : ''}${ws.shippingData.bdi.changePct}% - ${ws.shippingData.bdi.direction})`);
    lines.push(`  ${ws.shippingData.bdi.note}`);
  }
  if (ws.shippingData?.news?.length) {
    ws.shippingData.news.slice(0, 5).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Macro / central banks
  if (ws.macroData?.length) {
    lines.push(`\nCENTRAL BANKS & MACRO:`);
    ws.macroData.slice(0, 10).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Geopolitical
  if (ws.geopoliticalNews?.length) {
    lines.push(`\nGEOPOLITICAL & CONFLICTS:`);
    ws.geopoliticalNews.slice(0, 10).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Agriculture
  if (ws.agriNews?.length) {
    lines.push(`\nAGRICULTURE & COMMODITIES NEWS:`);
    ws.agriNews.slice(0, 8).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Energy
  if (ws.energyNews?.length) {
    lines.push(`\nENERGY:`);
    ws.energyNews.slice(0, 6).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Regulatory
  if (ws.regulatoryNews?.length) {
    lines.push(`\nREGULATORY (SEC/CFTC/FDA/FTC):`);
    ws.regulatoryNews.slice(0, 6).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Labor
  if (ws.laborData?.length) {
    lines.push(`\nLABOR & EMPLOYMENT:`);
    ws.laborData.slice(0, 4).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Consumer
  if (ws.consumerData?.length) {
    lines.push(`\nCONSUMER & RETAIL:`);
    ws.consumerData.slice(0, 4).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // ESG
  if (ws.esgNews?.length) {
    lines.push(`\nESG & ENVIRONMENT:`);
    ws.esgNews.slice(0, 4).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Crypto
  if (ws.cryptoSignals?.length) {
    lines.push(`\nCRYPTO SIGNALS:`);
    ws.cryptoSignals.slice(0, 6).forEach(n => lines.push(`  [${n.source}] ${n.title || n.fearGreed}`));
  }

  // General news
  const generalNews = ws.financialNews?.general || [];
  if (generalNews.length) {
    lines.push(`\nGENERAL MARKET NEWS (${generalNews.length} stories):`);
    generalNews.slice(0, 20).forEach(n => lines.push(`  [${n.source}] ${n.title}`));
  }

  // Social — full for sentiment roles, summary for others
  if (ws.social) {
    const isSocialRole = ['sentiment', 'social_sentiment'].includes(role);
    if (isSocialRole) {
      lines.push(`\n${ws.social.summaryText}`);
    } else {
      const st = ws.social.stats;
      lines.push(`\nSOCIAL SNAPSHOT: ${st?.total || 0} posts (${st?.clean || 0} credible, ${st?.suspicious || 0} flagged). Reddit=${st?.byPlatform?.reddit || 0} ST=${st?.byPlatform?.stocktwits || 0} X=${st?.byPlatform?.x || 0}`);
      if (st?.stocktwitsSentiment) lines.push(`  StockTwits: ${st.stocktwitsSentiment.bullish}B/${st.stocktwitsSentiment.bearish}Be of ${st.stocktwitsSentiment.total}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  buildWorldState, serializeForAgent,
  fetchPrice, fetchHistory, fetchAllSocial
};
