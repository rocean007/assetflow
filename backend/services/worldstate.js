const axios = require('axios');
const RSSParser = require('rss-parser');

const rss = new RSSParser({ timeout: 8000 });

/**
 * WORLD STATE ENGINE
 *
 * Builds a rich "state of the world right now" context that gets injected
 * into every agent's prompt. This is what makes the model omniscient —
 * agents reason about real current conditions, not just financial news.
 *
 * Sources (all free, no API key required unless noted):
 *   Weather        — Open-Meteo (free, no key)
 *   Conflicts      — ACLED RSS, ReliefWeb
 *   Agriculture    — USDA RSS, FAO news
 *   Shipping       — Baltic Exchange news RSS, FreightWaves RSS
 *   Economic cal   — Investing.com economic calendar RSS
 *   Earnings       — Yahoo Finance earnings RSS
 *   Commodities    — Trading Economics RSS, USDA reports
 *   Central banks  — Fed, ECB, BOJ, BOE press release feeds
 *   Energy         — EIA RSS
 *   Trade/Tariffs  — WTO news RSS, USTR news
 */

// ─── RSS FEEDS ─────────────────────────────────────────────────────────────

const WORLD_FEEDS = {
  conflicts: [
    { name: 'ReliefWeb Disasters', url: 'https://reliefweb.int/headlines/rss.xml' },
    { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml' },
  ],
  agriculture: [
    { name: 'USDA News', url: 'https://www.usda.gov/rss/home.xml' },
    { name: 'FAO News', url: 'https://www.fao.org/news/rss-feed/en/' },
    { name: 'AgWeb', url: 'https://www.agweb.com/rss/news' },
  ],
  shipping: [
    { name: 'TradeWinds', url: 'https://www.tradewindsnews.com/rss' },
    { name: 'Splash247', url: 'https://splash247.com/feed/' },
    { name: 'FreightWaves', url: 'https://www.freightwaves.com/news/feed' },
  ],
  energy: [
    { name: 'EIA News', url: 'https://www.eia.gov/rss/news.xml' },
    { name: 'OilPrice', url: 'https://oilprice.com/rss/main' },
  ],
  centralBanks: [
    { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
    { name: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html' },
    { name: 'BIS', url: 'https://www.bis.org/doclist/all_speeches.rss' },
  ],
  trade: [
    { name: 'WTO News', url: 'https://www.wto.org/english/news_e/news_e.rss' },
    { name: 'Reuters Trade', url: 'https://feeds.reuters.com/reuters/USdomesticNews' },
  ],
  economic: [
    { name: 'IMF News', url: 'https://www.imf.org/en/News/rss?language=eng' },
    { name: 'World Bank', url: 'https://blogs.worldbank.org/rss.xml' },
    { name: 'OECD', url: 'https://www.oecd.org/newsroom/rss/' },
  ],
};

async function fetchFeedGroup(feeds, maxPerFeed = 5) {
  const results = [];
  await Promise.allSettled(feeds.map(async (feed) => {
    try {
      const parsed = await rss.parseURL(feed.url);
      (parsed.items || []).slice(0, maxPerFeed).forEach(item => {
        results.push({
          source: feed.name,
          title: item.title || '',
          summary: (item.contentSnippet || item.summary || '').slice(0, 250),
          published: item.pubDate || item.isoDate || new Date().toISOString(),
        });
      });
    } catch (_) {}
  }));
  return results.sort((a, b) => new Date(b.published) - new Date(a.published));
}

// ─── WEATHER ───────────────────────────────────────────────────────────────

/**
 * Fetch weather for key agricultural/commodity regions.
 * Open-Meteo is free, no API key.
 */
const AGRI_REGIONS = [
  { name: 'US Midwest (corn belt)', lat: 41.5, lon: -93.6 },
  { name: 'Ukraine (wheat)', lat: 48.4, lon: 31.2 },
  { name: 'Brazil (soy/coffee)', lat: -14.2, lon: -51.9 },
  { name: 'India (wheat/rice)', lat: 20.6, lon: 79.1 },
  { name: 'Australia (wheat)', lat: -25.3, lon: 133.8 },
  { name: 'Indonesia (palm oil)', lat: -0.8, lon: 113.9 },
  { name: 'Texas (oil/cotton)', lat: 31.5, lon: -99.3 },
  { name: 'Gulf of Mexico (energy)', lat: 25.0, lon: -89.0 },
];

async function fetchAgriculturalWeather() {
  const weatherReports = [];

  await Promise.allSettled(AGRI_REGIONS.map(async (region) => {
    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: region.lat,
          longitude: region.lon,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode',
          forecast_days: 3,
          timezone: 'auto',
        },
        timeout: 8000,
      });

      const d = res.data?.daily;
      if (!d) return;

      const today = {
        date: d.time?.[0],
        maxTemp: d.temperature_2m_max?.[0],
        minTemp: d.temperature_2m_min?.[0],
        precipitation: d.precipitation_sum?.[0],
        windspeed: d.windspeed_10m_max?.[0],
        code: d.weathercode?.[0],
      };

      const tomorrow = {
        date: d.time?.[1],
        maxTemp: d.temperature_2m_max?.[1],
        minTemp: d.temperature_2m_min?.[1],
        precipitation: d.precipitation_sum?.[1],
        windspeed: d.windspeed_10m_max?.[1],
        code: d.weathercode?.[1],
      };

      const alerts = [];

      // Extreme conditions — these matter for commodity prices
      if (tomorrow.precipitation > 25) alerts.push(`⚠ HEAVY RAIN/FLOOD RISK: ${tomorrow.precipitation}mm expected`);
      if (tomorrow.precipitation === 0 && today.precipitation === 0) alerts.push('⚠ DRY CONDITIONS: No rainfall forecast');
      if (tomorrow.maxTemp > 38) alerts.push(`⚠ EXTREME HEAT: ${tomorrow.maxTemp}°C — potential crop stress`);
      if (tomorrow.minTemp < -5) alerts.push(`⚠ FROST RISK: ${tomorrow.minTemp}°C — potential crop damage`);
      if (tomorrow.windspeed > 60) alerts.push(`⚠ STORM WINDS: ${tomorrow.windspeed} km/h`);
      if ([95, 96, 99].includes(tomorrow.code)) alerts.push('⚠ THUNDERSTORM FORECAST');
      if ([71, 73, 75, 77].includes(tomorrow.code)) alerts.push('⚠ SNOW/BLIZZARD FORECAST');
      if ([85, 86].includes(tomorrow.code)) alerts.push('⚠ HEAVY SNOWFALL FORECAST');

      weatherReports.push({
        region: region.name,
        today,
        tomorrow,
        alerts,
        significant: alerts.length > 0,
      });
    } catch (_) {}
  }));

  return weatherReports;
}

// ─── COMMODITY PRICES ──────────────────────────────────────────────────────

async function fetchCommodityPrices() {
  // Use Yahoo Finance for key commodity futures
  const commodities = [
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'CL=F', name: 'Crude Oil WTI' },
    { symbol: 'NG=F', name: 'Natural Gas' },
    { symbol: 'ZW=F', name: 'Wheat' },
    { symbol: 'ZC=F', name: 'Corn' },
    { symbol: 'ZS=F', name: 'Soybeans' },
    { symbol: 'KC=F', name: 'Coffee' },
    { symbol: 'CT=F', name: 'Cotton' },
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'DX-Y.NYB', name: 'US Dollar Index' },
  ];

  const results = [];
  await Promise.allSettled(commodities.map(async (c) => {
    try {
      const res = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${c.symbol}`,
        { params: { interval: '1d', range: '2d' }, timeout: 6000 }
      );
      const meta = res.data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const change = meta.regularMarketPrice - meta.previousClose;
        const changePct = (change / meta.previousClose) * 100;
        results.push({
          name: c.name,
          symbol: c.symbol,
          price: meta.regularMarketPrice,
          change: changePct.toFixed(2),
          direction: changePct > 0.5 ? 'up' : changePct < -0.5 ? 'down' : 'flat',
        });
      }
    } catch (_) {}
  }));

  return results;
}

// ─── ECONOMIC INDICATORS ───────────────────────────────────────────────────

async function fetchEconomicCalendar() {
  // Investing.com economic calendar RSS
  const results = [];
  try {
    const parsed = await rss.parseURL('https://www.investing.com/rss/economic_calendar.rss');
    (parsed.items || []).slice(0, 15).forEach(item => {
      results.push({
        title: item.title || '',
        summary: (item.contentSnippet || '').slice(0, 200),
        published: item.pubDate || '',
      });
    });
  } catch (_) {}
  return results;
}

// ─── FREIGHT / SHIPPING INDEX ──────────────────────────────────────────────

async function fetchShippingSignals() {
  // Baltic Dry Index via Yahoo (BDI proxy)
  const shippingData = {};
  try {
    const res = await axios.get(
      'https://query1.finance.yahoo.com/v8/finance/chart/BDI',
      { params: { interval: '1d', range: '5d' }, timeout: 6000 }
    );
    const meta = res.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      const change = meta.regularMarketPrice - meta.previousClose;
      shippingData.bdi = {
        value: meta.regularMarketPrice,
        change: ((change / meta.previousClose) * 100).toFixed(2),
        direction: change > 0 ? 'up' : 'down',
        note: 'Baltic Dry Index — rising = more shipping demand = healthy global trade',
      };
    }
  } catch (_) {}

  // Shipping news
  const shippingNews = await fetchFeedGroup(WORLD_FEEDS.shipping, 4);
  shippingData.news = shippingNews.slice(0, 8);
  return shippingData;
}

// ─── MASTER WORLD STATE BUILDER ────────────────────────────────────────────

/**
 * Build the complete world state context.
 * This runs in parallel with market data fetching.
 * Called once per analysis run — the result is injected into ALL agent prompts.
 */
async function buildWorldState(symbol) {
  const [
    weatherReports,
    commodityPrices,
    conflictNews,
    agriNews,
    energyNews,
    centralBankNews,
    tradeNews,
    economicNews,
    shippingData,
    econCalendar,
  ] = await Promise.allSettled([
    fetchAgriculturalWeather(),
    fetchCommodityPrices(),
    fetchFeedGroup(WORLD_FEEDS.conflicts, 4),
    fetchFeedGroup(WORLD_FEEDS.agriculture, 4),
    fetchFeedGroup(WORLD_FEEDS.energy, 4),
    fetchFeedGroup(WORLD_FEEDS.centralBanks, 4),
    fetchFeedGroup(WORLD_FEEDS.trade, 4),
    fetchFeedGroup(WORLD_FEEDS.economic, 3),
    fetchShippingSignals(),
    fetchEconomicCalendar(),
  ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null));

  return {
    fetchedAt: new Date().toISOString(),
    symbol,
    weather: weatherReports || [],
    commodities: commodityPrices || [],
    conflicts: conflictNews || [],
    agriculture: agriNews || [],
    energy: energyNews || [],
    centralBanks: centralBankNews || [],
    trade: tradeNews || [],
    economic: economicNews || [],
    shipping: shippingData || {},
    econCalendar: econCalendar || [],
  };
}

/**
 * Serialize world state to a compact text block for LLM prompts.
 * Agents receive this as a section of their context.
 */
function worldStateToText(ws) {
  if (!ws) return '';

  const lines = [`WORLD STATE (as of ${ws.fetchedAt?.slice(0, 16)} UTC):`];

  // Weather alerts (only significant ones to save tokens)
  const sigWeather = (ws.weather || []).filter(w => w.significant);
  if (sigWeather.length > 0) {
    lines.push('\n[WEATHER ALERTS — AGRICULTURAL/COMMODITY REGIONS]');
    sigWeather.forEach(w => {
      lines.push(`  ${w.region}: ${w.alerts.join(', ')}`);
      lines.push(`    Tomorrow: max ${w.tomorrow?.maxTemp}°C, rain ${w.tomorrow?.precipitation}mm`);
    });
  }

  // Commodity prices
  if ((ws.commodities || []).length > 0) {
    lines.push('\n[COMMODITY PRICES (% change today)]');
    ws.commodities.forEach(c => {
      const arrow = c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '→';
      lines.push(`  ${arrow} ${c.name}: $${c.price} (${c.change}%)`);
    });
  }

  // Shipping
  if (ws.shipping?.bdi) {
    lines.push(`\n[SHIPPING] Baltic Dry Index: ${ws.shipping.bdi.value} (${ws.shipping.bdi.change}% — ${ws.shipping.bdi.direction})`);
  }

  // Economic calendar
  if ((ws.econCalendar || []).length > 0) {
    lines.push('\n[UPCOMING ECONOMIC EVENTS]');
    ws.econCalendar.slice(0, 6).forEach(e => lines.push(`  • ${e.title}`));
  }

  // Conflict/geopolitical
  if ((ws.conflicts || []).length > 0) {
    lines.push('\n[CONFLICT & HUMANITARIAN ALERTS]');
    ws.conflicts.slice(0, 5).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Central bank
  if ((ws.centralBanks || []).length > 0) {
    lines.push('\n[CENTRAL BANK COMMUNICATIONS]');
    ws.centralBanks.slice(0, 4).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Agriculture
  if ((ws.agriculture || []).length > 0) {
    lines.push('\n[AGRICULTURE & CROP REPORTS]');
    ws.agriculture.slice(0, 5).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Energy
  if ((ws.energy || []).length > 0) {
    lines.push('\n[ENERGY SECTOR]');
    ws.energy.slice(0, 4).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Trade
  if ((ws.trade || []).length > 0) {
    lines.push('\n[TRADE & TARIFF SIGNALS]');
    ws.trade.slice(0, 4).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Economic
  if ((ws.economic || []).length > 0) {
    lines.push('\n[GLOBAL ECONOMIC INSTITUTIONS]');
    ws.economic.slice(0, 3).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  // Shipping news
  if ((ws.shipping?.news || []).length > 0) {
    lines.push('\n[SHIPPING & FREIGHT NEWS]');
    ws.shipping.news.slice(0, 3).forEach(n => lines.push(`  • [${n.source}] ${n.title}`));
  }

  return lines.join('\n');
}

module.exports = { buildWorldState, worldStateToText, fetchAgriculturalWeather, fetchCommodityPrices };
