"""
Data Collector — fetches every available real-time signal in parallel.

All sources are free. No API key required unless stated.

Categories:
  1.  Market:       price, OHLCV, options chain, analyst ratings, earnings, insider trades, short interest
  2.  News:         20 financial RSS feeds
  3.  Macro:        12 central bank / economic institution feeds
  4.  Weather:      Open-Meteo (free, no key) — 12 agricultural/energy regions
  5.  Commodities:  30 instruments via Yahoo Finance
  6.  Agriculture:  USDA, FAO, AgWeb
  7.  Energy:       EIA, OilPrice, Electrek
  8.  Shipping:     FreightWaves, Splash247, Baltic Dry Index
  9.  Geopolitical: UN, ReliefWeb, CFR, Al Jazeera
  10. Regulatory:   SEC, CFTC, FDA, FTC
  11. Tech:         HackerNews, TechCrunch, Ars Technica
  12. Healthcare:   FDA press releases, STAT News
  13. Consumer:     NRF, ConsumerAffairs
  14. ESG:          ESG Today, Carbon Brief
  15. Social:       Reddit (10 subs), StockTwits, HackerNews
  16. Crypto:       CoinTelegraph, Decrypt, Fear & Greed Index
"""
import re
import time
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import feedparser
from ..utils.logger import get_logger

logger = get_logger('assetflow.services.data')

SESSION = requests.Session()
SESSION.headers.update({'User-Agent': 'AssetFlow/2.0 (+https://github.com/assetflow)'})

# ─── HELPERS ────────────────────────────────────────────────────────────────

def safe_get(url: str, params: dict = None, timeout: int = 10) -> Optional[dict]:
    try:
        r = SESSION.get(url, params=params, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def safe_feed(url: str, source: str, max_items: int = 6) -> list:
    try:
        feed = feedparser.parse(url)
        items = []
        for e in feed.entries[:max_items]:
            items.append({
                'source':    source,
                'title':     (e.get('title') or '').strip(),
                'summary':   (e.get('summary') or e.get('description') or '')[:280].strip(),
                'url':       e.get('link', ''),
                'published': e.get('published', e.get('updated', '')),
            })
        return items
    except Exception:
        return []


def run_parallel(tasks: list, max_workers: int = 20) -> list:
    """Run list of (fn, *args) tuples in parallel, return results (None on error)."""
    results = [None] * len(tasks)
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(fn, *args): i for i, (fn, *args) in enumerate(tasks)}
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                results[idx] = fut.result()
            except Exception as e:
                logger.debug(f'Task {idx} failed: {e}')
    return results


# ─── 1. MARKET DATA ─────────────────────────────────────────────────────────

def fetch_price(symbol: str, av_key: str = None) -> Optional[dict]:
    if av_key:
        d = safe_get('https://www.alphavantage.co/query', {'function': 'GLOBAL_QUOTE', 'symbol': symbol, 'apikey': av_key})
        q = (d or {}).get('Global Quote', {})
        if q.get('05. price'):
            return {'symbol': symbol, 'price': float(q['05. price']), 'change': float(q['09. change']),
                    'change_pct': float(q['10. change percent'].strip('%')), 'volume': int(q['06. volume']),
                    'high': float(q['03. high']), 'low': float(q['04. low']), 'source': 'alphavantage'}
    d = safe_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}', {'interval': '1d', 'range': '5d'})
    meta = ((d or {}).get('chart', {}).get('result') or [{}])[0].get('meta', {})
    if meta.get('regularMarketPrice'):
        p = meta['regularMarketPrice']
        pc = meta.get('previousClose', p)
        pct = ((p - pc) / pc * 100) if pc else 0
        return {'symbol': symbol, 'price': p, 'change': p - pc, 'change_pct': round(pct, 2),
                'volume': meta.get('regularMarketVolume'), 'high': meta.get('regularMarketDayHigh'),
                'low': meta.get('regularMarketDayLow'), 'market_cap': meta.get('marketCap'), 'source': 'yahoo'}
    return None


def fetch_history(symbol: str, days: int = 60, av_key: str = None) -> list:
    if av_key:
        d = safe_get('https://www.alphavantage.co/query', {'function': 'TIME_SERIES_DAILY', 'symbol': symbol, 'outputsize': 'compact', 'apikey': av_key})
        series = (d or {}).get('Time Series (Daily)', {})
        if series:
            return [{'date': dt, 'open': float(v['1. open']), 'high': float(v['2. high']),
                     'low': float(v['3. low']), 'close': float(v['4. close']), 'volume': int(v['5. volume'])}
                    for dt, v in list(series.items())[:days]]
    rng = '1mo' if days <= 30 else '3mo' if days <= 90 else '1y'
    d = safe_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}', {'interval': '1d', 'range': rng})
    res = ((d or {}).get('chart', {}).get('result') or [None])[0]
    if not res:
        return []
    ts = res.get('timestamp', [])
    q  = res.get('indicators', {}).get('quote', [{}])[0]
    return [{'date': time.strftime('%Y-%m-%d', time.gmtime(t)), 'open': q.get('open', [None])[i],
             'high': q.get('high', [None])[i], 'low': q.get('low', [None])[i],
             'close': q.get('close', [None])[i], 'volume': q.get('volume', [None])[i]}
            for i, t in enumerate(ts) if q.get('close', [None])[i]]


def fetch_options_summary(symbol: str) -> Optional[dict]:
    d = safe_get(f'https://query2.finance.yahoo.com/v7/finance/options/{symbol}')
    chain = ((d or {}).get('optionChain', {}).get('result') or [None])[0]
    if not chain:
        return None
    opts = (chain.get('options') or [{}])[0]
    calls, puts = opts.get('calls', []), opts.get('puts', [])
    call_oi = sum(c.get('openInterest', 0) for c in calls)
    put_oi  = sum(p.get('openInterest', 0) for p in puts)
    pc = round(put_oi / call_oi, 2) if call_oi else None
    return {'put_call_ratio': pc, 'call_oi': call_oi, 'put_oi': put_oi,
            'iv': round(calls[0].get('impliedVolatility', 0), 3) if calls else None,
            'signal': 'bearish_options' if pc and pc > 1.2 else 'bullish_options' if pc and pc < 0.7 else 'neutral'}


def fetch_analyst_ratings(symbol: str) -> Optional[dict]:
    d = safe_get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',
                 {'modules': 'financialData,recommendationTrend,upgradeDowngradeHistory'})
    s = ((d or {}).get('quoteSummary', {}).get('result') or [{}])[0]
    if not s:
        return None
    fd = s.get('financialData', {})
    hist = s.get('upgradeDowngradeHistory', {}).get('history', [])
    return {'target_price': (fd.get('targetMeanPrice') or {}).get('raw'),
            'current_price': (fd.get('currentPrice') or {}).get('raw'),
            'recommendation': fd.get('recommendationKey'),
            'num_analysts': (fd.get('numberOfAnalystOpinions') or {}).get('raw'),
            'recent_upgrades': [{'firm': h.get('firm'), 'action': h.get('action'), 'grade': h.get('toGrade')} for h in hist[:3]]}


def fetch_earnings_data(symbol: str) -> Optional[dict]:
    d = safe_get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',
                 {'modules': 'calendarEvents,earningsTrend,earningsHistory'})
    s = ((d or {}).get('quoteSummary', {}).get('result') or [{}])[0]
    if not s:
        return None
    dates = s.get('calendarEvents', {}).get('earnings', {}).get('earningsDate', [])
    next_dt = dates[0].get('raw') if dates else None
    trend   = (s.get('earningsTrend', {}).get('trend') or [{}])[0]
    history = (s.get('earningsHistory', {}).get('history') or [{}])[0]
    return {'next_earnings_date': time.strftime('%Y-%m-%d', time.gmtime(next_dt)) if next_dt else None,
            'eps_estimate': (trend.get('earningsEstimate') or {}).get('avg', {}).get('raw'),
            'revenue_estimate': (trend.get('revenueEstimate') or {}).get('avg', {}).get('raw'),
            'last_surprise_pct': (history.get('surprisePercent') or {}).get('raw')}


def fetch_insider_activity(symbol: str) -> Optional[dict]:
    d = safe_get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}', {'modules': 'insiderTransactions'})
    txns = ((d or {}).get('quoteSummary', {}).get('result') or [{}])[0].get('insiderTransactions', {}).get('transactions', [])
    buys  = sum(1 for t in txns if 'buy' in (t.get('transactionText') or '').lower())
    sells = sum(1 for t in txns if 'sell' in (t.get('transactionText') or '').lower())
    return {'recent_buys': buys, 'recent_sells': sells, 'net': 'buy' if buys > sells else 'sell' if sells > buys else 'neutral'}


def fetch_short_interest(symbol: str) -> Optional[dict]:
    d = safe_get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}', {'modules': 'defaultKeyStatistics'})
    s = ((d or {}).get('quoteSummary', {}).get('result') or [{}])[0].get('defaultKeyStatistics', {})
    pct = (s.get('shortPercentOfFloat') or {}).get('raw')
    return {'short_ratio': (s.get('shortRatio') or {}).get('raw'), 'short_pct_float': pct,
            'signal': 'high_short_interest' if pct and pct > 0.2 else 'normal'} if s else None


# ─── 2. FINANCIAL NEWS ──────────────────────────────────────────────────────

NEWS_FEEDS = [
    ('https://feeds.reuters.com/reuters/businessNews',               'Reuters Business'),
    ('https://feeds.reuters.com/reuters/technologyNews',             'Reuters Tech'),
    ('https://finance.yahoo.com/news/rssindex',                      'Yahoo Finance'),
    ('https://www.cnbc.com/id/100003114/device/rss/rss.html',        'CNBC Markets'),
    ('https://feeds.content.dowjones.io/public/rss/mw_marketpulse', 'MarketWatch'),
    ('https://feeds.content.dowjones.io/public/rss/mw_topstories',  'MarketWatch Top'),
    ('https://feeds.bloomberg.com/economics/news.rss',               'Bloomberg Economics'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',    'NYT Business'),
    ('https://www.ft.com/?format=rss',                               'Financial Times'),
    ('https://seekingalpha.com/market_currents.xml',                 'Seeking Alpha'),
    ('https://www.wsj.com/xml/rss/3_7085.xml',                      'WSJ Markets'),
    ('https://feeds.a.dj.com/rss/RSSMarketsMain.xml',               'Dow Jones Markets'),
    ('https://www.investing.com/rss/news_25.rss',                   'Investing.com'),
    ('https://www.zerohedge.com/fullrss2.xml',                      'ZeroHedge'),
    ('https://thestreet.com/.rss/full/',                             'TheStreet'),
    ('https://www.fool.com/feeds/index.aspx',                       'Motley Fool'),
    ('https://techcrunch.com/feed/',                                 'TechCrunch'),
    ('https://feeds.arstechnica.com/arstechnica/index',             'Ars Technica'),
    ('https://news.ycombinator.com/rss',                             'HackerNews'),
    ('https://venturebeat.com/feed/',                                'VentureBeat'),
]

def fetch_financial_news(symbol: str) -> dict:
    tasks = [(safe_feed, url, src, 5) for url, src in NEWS_FEEDS]
    results = run_parallel(tasks, max_workers=20)
    all_items = [item for batch in results if batch for item in batch]
    q = symbol.lower()
    specific = [n for n in all_items if q in n['title'].lower() or q in n['summary'].lower()]
    general  = sorted([n for n in all_items if n not in specific],
                      key=lambda x: x['published'], reverse=True)
    return {'asset_specific': specific[:20], 'general': general[:30]}


# ─── 3. MACRO / CENTRAL BANKS ───────────────────────────────────────────────

MACRO_FEEDS = [
    ('https://www.federalreserve.gov/feeds/press_all.xml',   'Federal Reserve'),
    ('https://www.ecb.europa.eu/rss/press.html',             'ECB'),
    ('https://www.boj.or.jp/en/announcements/release_2024/rss.xml', 'Bank of Japan'),
    ('https://www.bankofengland.co.uk/rss/news',             'Bank of England'),
    ('https://www.bis.org/doclist/all_speeches.rss',         'BIS'),
    ('https://www.imf.org/en/News/rss?language=eng',         'IMF'),
    ('https://blogs.worldbank.org/rss.xml',                  'World Bank'),
    ('https://www.oecd.org/newsroom/rss/',                   'OECD'),
    ('https://www.bls.gov/bls/news.rss',                     'BLS (Jobs/CPI)'),
    ('https://apps.bea.gov/rss/rss.xml',                     'BEA (GDP)'),
    ('https://www.wto.org/english/news_e/news_e.rss',        'WTO'),
    ('https://www.treasury.gov/resource-center/data-chart-center/interest-rates/rss/rss.xml', 'US Treasury'),
]

def fetch_macro_data() -> list:
    tasks = [(safe_feed, url, src, 4) for url, src in MACRO_FEEDS]
    results = run_parallel(tasks)
    return sorted([i for b in results if b for i in b], key=lambda x: x['published'], reverse=True)


# ─── 4. WEATHER ─────────────────────────────────────────────────────────────

WMO = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Icy fog',
       51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
       71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Showers',81:'Heavy showers',
       82:'Violent showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',
       96:'Thunderstorm+hail',99:'Thunderstorm+heavy hail'}

WEATHER_REGIONS = [
    {'name': 'US Midwest (corn/soy)',    'lat': 41.5,  'lon': -93.6,  'importance': 'corn, soy, ethanol'},
    {'name': 'Great Plains (wheat)',     'lat': 38.5,  'lon': -98.0,  'importance': 'winter wheat'},
    {'name': 'Ukraine (wheat/sunflower)','lat': 48.4,  'lon':  31.2,  'importance': 'wheat, sunflower, corn'},
    {'name': 'Brazil (soy/coffee)',      'lat': -14.2, 'lon': -51.9,  'importance': 'soybeans, coffee, sugar'},
    {'name': 'India (wheat/rice)',       'lat':  20.6, 'lon':  79.1,  'importance': 'wheat, rice, cotton'},
    {'name': 'Australia (wheat/coal)',   'lat': -27.5, 'lon': 133.8,  'importance': 'wheat, coal, LNG'},
    {'name': 'Indonesia (palm oil)',     'lat':  -0.8, 'lon': 113.9,  'importance': 'palm oil, coal'},
    {'name': 'Texas/Gulf (oil/gas)',     'lat':  29.7, 'lon': -95.4,  'importance': 'crude oil, natural gas'},
    {'name': 'North Sea (Brent)',        'lat':  56.0, 'lon':   3.0,  'importance': 'Brent crude, natural gas'},
    {'name': 'China (manufacturing)',    'lat':  35.0, 'lon': 105.0,  'importance': 'manufacturing, pork'},
    {'name': 'Argentina (soy/corn)',     'lat': -34.6, 'lon': -58.4,  'importance': 'soybeans, corn, beef'},
    {'name': 'West Africa (cocoa)',      'lat':   5.3, 'lon':  -4.0,  'importance': 'cocoa, crude oil'},
]

def _fetch_one_weather(region: dict) -> Optional[dict]:
    d = safe_get('https://api.open-meteo.com/v1/forecast', {
        'latitude': region['lat'], 'longitude': region['lon'],
        'daily': 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode',
        'forecast_days': 4, 'timezone': 'auto'
    }, timeout=12)
    if not d or 'daily' not in d:
        return None
    dy = d['daily']
    days = [{'date': dy['time'][i], 'max_temp': dy['temperature_2m_max'][i],
              'min_temp': dy['temperature_2m_min'][i], 'rain': dy['precipitation_sum'][i],
              'wind': dy['windspeed_10m_max'][i], 'code': dy['weathercode'][i],
              'condition': WMO.get(dy['weathercode'][i], f"Code {dy['weathercode'][i]}")}
             for i in range(len(dy['time']))]
    tm = days[1] if len(days) > 1 else days[0]
    alerts = []
    if tm['rain'] and tm['rain'] > 30:        alerts.append(f"FLOOD RISK: {tm['rain']}mm rain")
    if all(d.get('rain', 1) == 0 for d in days[:3]): alerts.append('DROUGHT: 3-day zero rainfall')
    if tm['max_temp'] and tm['max_temp'] > 40: alerts.append(f"EXTREME HEAT: {tm['max_temp']}°C")
    if tm['min_temp'] and tm['min_temp'] < -3: alerts.append(f"FROST RISK: {tm['min_temp']}°C")
    if tm['wind'] and tm['wind'] > 70:         alerts.append(f"STORM: {tm['wind']}km/h winds")
    if tm['code'] in (95, 96, 99):             alerts.append('THUNDERSTORM forecast')
    if tm['code'] in (71, 73, 75, 85, 86):     alerts.append('SNOW/BLIZZARD forecast')
    return {**region, 'days': days, 'tomorrow': tm, 'alerts': alerts, 'significant': bool(alerts)}

def fetch_weather() -> list:
    tasks = [(_fetch_one_weather, r) for r in WEATHER_REGIONS]
    return [r for r in run_parallel(tasks) if r]


# ─── 5. COMMODITIES ─────────────────────────────────────────────────────────

COMMODITY_SYMBOLS = [
    ('GC=F','Gold'), ('SI=F','Silver'), ('PL=F','Platinum'),
    ('CL=F','WTI Crude'), ('BZ=F','Brent Crude'), ('NG=F','Natural Gas'),
    ('ZW=F','Wheat'), ('ZC=F','Corn'), ('ZS=F','Soybeans'),
    ('KC=F','Coffee'), ('CT=F','Cotton'), ('CC=F','Cocoa'), ('SB=F','Sugar'),
    ('LE=F','Live Cattle'), ('HE=F','Lean Hogs'), ('HG=F','Copper'),
    ('DX-Y.NYB','USD Index'), ('BTC-USD','Bitcoin'), ('ETH-USD','Ethereum'),
    ('^VIX','VIX'), ('^TNX','US 10Y Yield'), ('EURUSD=X','EUR/USD'),
    ('JPY=X','USD/JPY'), ('GBP=X','GBP/USD'), ('CNY=X','USD/CNY'),
    ('BDI','Baltic Dry Index'),
]

def _fetch_one_commodity(sym: str, name: str) -> Optional[dict]:
    d = safe_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}', {'interval':'1d','range':'2d'}, timeout=6)
    meta = ((d or {}).get('chart',{}).get('result') or [{}])[0].get('meta',{})
    p = meta.get('regularMarketPrice')
    pc = meta.get('previousClose', p)
    if not p:
        return None
    pct = round((p - pc) / pc * 100, 2) if pc else 0
    return {'symbol': sym, 'name': name, 'price': p, 'change_pct': pct,
            'direction': 'up' if pct > 0.5 else 'down' if pct < -0.5 else 'flat'}

def fetch_commodities() -> list:
    tasks = [(_fetch_one_commodity, s, n) for s, n in COMMODITY_SYMBOLS]
    return [r for r in run_parallel(tasks, max_workers=25) if r]


# ─── 6-14. SECTOR NEWS FEEDS ────────────────────────────────────────────────

def _fetch_feeds(feed_list: list, max_per: int = 4) -> list:
    tasks = [(safe_feed, url, src, max_per) for url, src in feed_list]
    results = run_parallel(tasks)
    return sorted([i for b in results if b for i in b], key=lambda x: x['published'], reverse=True)

AGRI_FEEDS = [('https://www.usda.gov/rss/home.xml','USDA'),('https://www.fao.org/news/rss-feed/en/','FAO'),
              ('https://www.agweb.com/rss/news','AgWeb'),('https://www.world-grain.com/rss/all','World Grain')]
ENERGY_FEEDS= [('https://www.eia.gov/rss/news.xml','EIA'),('https://oilprice.com/rss/main','OilPrice'),
               ('https://electrek.co/feed/','Electrek'),('https://pv-tech.org/feed/','PV-Tech')]
SHIPPING_FEEDS=[('https://splash247.com/feed/','Splash247'),('https://www.freightwaves.com/news/feed','FreightWaves'),
                ('https://www.hellenicshippingnews.com/feed/','Hellenic Shipping')]
GEO_FEEDS   = [('https://reliefweb.int/headlines/rss.xml','ReliefWeb'),('https://news.un.org/feed/subscribe/en/news/all/rss.xml','UN News'),
               ('https://rss.cfr.org/cfr_all','CFR'),('https://foreignpolicy.com/feed/','Foreign Policy'),
               ('https://www.aljazeera.com/xml/rss/all.xml','Al Jazeera'),('https://www.bbc.co.uk/news/world/rss.xml','BBC World')]
REG_FEEDS   = [('https://feeds.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=10&search_text=&output=atom','SEC 8-K'),
               ('https://www.cftc.gov/rss/pressroom.xml','CFTC'),('https://www.ftc.gov/feeds/news-feed','FTC'),
               ('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml','FDA')]
HEALTH_FEEDS= [('https://www.statnews.com/feed/','STAT News'),('https://www.fiercepharma.com/rss/xml','Fierce Pharma'),
               ('https://www.biopharmadive.com/feeds/news/','BioPharma Dive')]
CONSUMER_FEEDS=[('https://nrf.com/rss.xml','NRF Retail'),('https://www.consumeraffairs.com/news_index.rss','ConsumerAffairs')]
ESG_FEEDS   = [('https://www.esgtoday.com/feed/','ESG Today'),('https://www.carbonbrief.org/feed/','Carbon Brief')]
CRYPTO_FEEDS= [('https://cointelegraph.com/rss','CoinTelegraph'),('https://decrypt.co/feed','Decrypt'),
               ('https://coindesk.com/arc/outboundfeeds/rss/','CoinDesk')]
LABOR_FEEDS = [('https://www.bls.gov/bls/news.rss','BLS'),('https://layoffs.fyi/feed/','Layoffs.fyi')]

def fetch_agri_news():    return _fetch_feeds(AGRI_FEEDS)
def fetch_energy_news():  return _fetch_feeds(ENERGY_FEEDS)
def fetch_shipping_news():return _fetch_feeds(SHIPPING_FEEDS)
def fetch_geo_news():     return _fetch_feeds(GEO_FEEDS)
def fetch_reg_news():     return _fetch_feeds(REG_FEEDS)
def fetch_health_news():  return _fetch_feeds(HEALTH_FEEDS)
def fetch_consumer_news():return _fetch_feeds(CONSUMER_FEEDS)
def fetch_esg_news():     return _fetch_feeds(ESG_FEEDS)
def fetch_crypto_news():  return _fetch_feeds(CRYPTO_FEEDS)
def fetch_labor_news():   return _fetch_feeds(LABOR_FEEDS)


# ─── 15. SOCIAL MEDIA ───────────────────────────────────────────────────────

REDDIT_SUBS = ['stocks','investing','wallstreetbets','SecurityAnalysis','StockMarket',
               'options','dividends','ValueInvesting','ETFs','Superstonk']

def _manip_score(title: str, body: str, score: int = 0, age_min: float = 9999) -> int:
    text = f'{title} {body}'.lower()
    s = 0
    if re.search(r'\$\d{2,6}', text) and not re.search(r'(because|due to|analysis|earnings)', text): s += 20
    if re.search(r'(rocket|moon|lambo|diamond.hand|tendies|squeeze|yolo)', text): s += 20
    if len(re.findall(r'[A-Z]{4,}', title)) > 3: s += 10
    if re.search(r'not.financial.advice', text) and re.search(r'(buy|calls|puts|long|short)', text): s += 15
    if score > 5000 and age_min < 90: s += 25
    if len(re.findall(r'\b[A-Z]{2,5}\b', text)) > 10: s += 10
    return min(100, s)

def _fetch_reddit(symbol: str) -> list:
    posts = []
    for sub in REDDIT_SUBS:
        try:
            r = SESSION.get(f'https://www.reddit.com/r/{sub}/search.json',
                            params={'q': symbol, 'sort': 'new', 'limit': 8, 't': 'day', 'restrict_sr': 1},
                            timeout=10)
            for item in r.json().get('data', {}).get('children', []):
                p = item['data']
                age = (time.time() - p.get('created_utc', time.time())) / 60
                post = {'platform': 'reddit', 'sub': f'r/{sub}', 'title': p.get('title',''),
                        'body': p.get('selftext','')[:300], 'score': p.get('score',0),
                        'comments': p.get('num_comments',0), 'upvote_ratio': p.get('upvote_ratio',0.5)}
                post['manip_score'] = _manip_score(post['title'], post['body'], post['score'], age)
                posts.append(post)
        except Exception:
            pass
    return posts

def _fetch_stocktwits(symbol: str) -> list:
    d = safe_get(f'https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json')
    posts = []
    for m in (d or {}).get('messages', [])[:30]:
        post = {'platform': 'stocktwits', 'sub': 'StockTwits', 'title': (m.get('body',''))[:200],
                'body': '', 'score': (m.get('likes') or {}).get('total', 0),
                'native_sentiment': (m.get('entities') or {}).get('sentiment', {}).get('basic')}
        post['manip_score'] = _manip_score(post['title'], '')
        posts.append(post)
    return posts

def _fetch_nitter(symbol: str) -> list:
    instances = ['https://nitter.poast.org','https://nitter.privacydev.net','https://nitter.1d4.us']
    for inst in instances:
        items = safe_feed(f'{inst}/search/rss?q=%24{symbol}&f=tweets', 'Twitter/X', 15)
        if items:
            for item in items:
                item['platform'] = 'x'
                item['manip_score'] = _manip_score(item['title'], '')
            return items
    return []

def fetch_social(symbol: str) -> dict:
    reddit, stocktwits, nitter = (
        run_parallel([(_fetch_reddit, symbol), (_fetch_stocktwits, symbol), (_fetch_nitter, symbol)])
    )
    reddit, stocktwits, nitter = reddit or [], stocktwits or [], nitter or []
    all_posts = reddit + stocktwits + nitter
    clean = [p for p in all_posts if p.get('manip_score', 0) < 40]
    suspicious = [p for p in all_posts if p.get('manip_score', 0) >= 40]
    st_sents = [p for p in stocktwits if p.get('native_sentiment')]
    st_bull = sum(1 for p in st_sents if p['native_sentiment'] == 'Bullish')
    st_bear = sum(1 for p in st_sents if p['native_sentiment'] == 'Bearish')
    top_posts = '\n'.join(f"[{p['platform']}/{p['sub']}] {p['title'][:120]} (score:{p['score']}, manip:{p['manip_score']}%)"
                          for p in clean[:20])
    susp_posts = '\n'.join(f"[FLAGGED:{p['manip_score']}%][{p['platform']}] {p['title'][:100]}"
                           for p in suspicious[:6])
    summary = (f"SOCIAL SIGNALS FOR {symbol}:\n"
               f"Total: {len(all_posts)} posts ({len(clean)} credible, {len(suspicious)} flagged)\n"
               f"Platforms: Reddit={len(reddit)} StockTwits={len(stocktwits)} X={len(nitter)}\n")
    if st_sents:
        summary += f"StockTwits native: {st_bull} Bullish / {st_bear} Bearish of {len(st_sents)}\n"
    summary += f"\nCREDIBLE POSTS:\n{top_posts or 'None found'}\n"
    summary += f"\nFLAGGED (coordination attempts are themselves a signal):\n{susp_posts or 'None'}"
    return {'all': all_posts, 'clean': clean, 'suspicious': suspicious,
            'stats': {'total': len(all_posts), 'clean': len(clean), 'suspicious': len(suspicious),
                      'by_platform': {'reddit': len(reddit), 'stocktwits': len(stocktwits), 'x': len(nitter)},
                      'stocktwits_sentiment': {'bullish': st_bull, 'bearish': st_bear, 'total': len(st_sents)} if st_sents else None},
            'summary_text': summary}


# ─── MASTER WORLD STATE ──────────────────────────────────────────────────────

def build_world_state(symbol: str, av_key: str = None) -> dict:
    """
    Fetch every data category in parallel.
    Returns a comprehensive world-state dict.
    """
    logger.info(f'Building world state for {symbol}...')
    t0 = time.time()

    tasks = [
        (fetch_price,          symbol, av_key),
        (fetch_history,        symbol, 60, av_key),
        (fetch_options_summary,symbol),
        (fetch_analyst_ratings,symbol),
        (fetch_earnings_data,  symbol),
        (fetch_insider_activity,symbol),
        (fetch_short_interest, symbol),
        (fetch_financial_news, symbol),
        (fetch_macro_data,),
        (fetch_weather,),
        (fetch_commodities,),
        (fetch_agri_news,),
        (fetch_energy_news,),
        (fetch_shipping_news,),
        (fetch_geo_news,),
        (fetch_reg_news,),
        (fetch_health_news,),
        (fetch_consumer_news,),
        (fetch_esg_news,),
        (fetch_social,         symbol),
        (fetch_crypto_news,),
        (fetch_labor_news,),
    ]

    results = run_parallel(tasks, max_workers=22)
    (price, history, options, analyst, earnings, insider, short_int,
     fin_news, macro, weather, commodities, agri, energy, shipping,
     geo, reg, health, consumer, esg, social, crypto, labor) = results

    elapsed = round(time.time() - t0, 1)
    logger.info(f'World state fetched in {elapsed}s for {symbol}')

    return {
        'fetched_at':   time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'symbol':       symbol,
        'price':        price,
        'history':      history or [],
        'options':      options,
        'analyst':      analyst,
        'earnings':     earnings,
        'insider':      insider,
        'short_int':    short_int,
        'fin_news':     fin_news or {},
        'macro':        macro or [],
        'weather':      weather or [],
        'commodities':  commodities or [],
        'agri':         agri or [],
        'energy':       energy or [],
        'shipping':     shipping or [],
        'geo':          geo or [],
        'reg':          reg or [],
        'health':       health or [],
        'consumer':     consumer or [],
        'esg':          esg or [],
        'social':       social or {},
        'crypto':       crypto or [],
        'labor':        labor or [],
        'fetch_elapsed_s': elapsed,
    }


# ─── SERIALIZE FOR LLM PROMPT ────────────────────────────────────────────────

def serialize_world_state(ws: dict, role: str = '', compact: bool = False) -> str:
    """Convert world state to a prompt-ready text block."""
    if not ws:
        return 'World state unavailable.'

    lines = [f"=== WORLD STATE FOR {ws.get('symbol','?')} ({ws.get('fetched_at','')[:16]} UTC) ===\n"]

    # Price & market data
    p = ws.get('price')
    if p:
        lines.append(f"PRICE: ${p['price']:.4f} ({'+' if p['change_pct']>=0 else ''}{p['change_pct']:.2f}% today, vol {p.get('volume') or '?'})")
        if p.get('market_cap'):
            lines.append(f"Market Cap: ${p['market_cap']/1e9:.1f}B")
    opts = ws.get('options')
    if opts:
        lines.append(f"OPTIONS: P/C ratio={opts['put_call_ratio']} | signal={opts['signal']} | IV={opts['iv']}")
    si = ws.get('short_int')
    if si and si.get('short_pct_float'):
        lines.append(f"SHORT INTEREST: {si['short_pct_float']*100:.1f}% float ({si['signal']})")
    an = ws.get('analyst')
    if an and an.get('recommendation'):
        lines.append(f"ANALYST: {an['recommendation'].upper()} | target ${an['target_price']} | {an['num_analysts']} analysts")
        if an.get('recent_upgrades'):
            upgrades = ', '.join(f"{u['firm']}: {u['action']} -> {u['grade']}" for u in an['recent_upgrades'])
            lines.append(f"  Recent: {upgrades}")
    ea = ws.get('earnings')
    if ea and ea.get('next_earnings_date'):
        lines.append(f"EARNINGS: next={ea['next_earnings_date']} | EPS est=${ea['eps_estimate']} | last surprise={ea['last_surprise_pct']}%")
    ins = ws.get('insider')
    if ins:
        lines.append(f"INSIDER: {ins['recent_buys']} buys vs {ins['recent_sells']} sells ({ins['net']})")

    # History
    hist = ws.get('history', [])
    if hist:
        lines.append('\nPRICE HISTORY (last 20 sessions):')
        for h in hist[:20]:
            lines.append(f"  {h['date']} O={h['open']} H={h['high']} L={h['low']} C={h['close']} V={h['volume']}")

    # Asset-specific news
    fn = ws.get('fin_news', {})
    specific = fn.get('asset_specific', [])
    if specific:
        lines.append(f'\nASSET NEWS ({len(specific)} stories):')
        for n in specific[:15]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Weather — all regions
    weather = ws.get('weather', [])
    if weather:
        sig = [w for w in weather if w.get('significant')]
        lines.append(f'\nWEATHER ({len(weather)} regions, {len(sig)} alerts):')
        for w in weather:
            flag = ' *** ALERT ***' if w.get('significant') else ''
            tm = w.get('tomorrow', {})
            lines.append(f"  {w['name']} [{w['importance']}]{flag}")
            lines.append(f"    Tomorrow: {tm.get('condition','?')}, max={tm.get('max_temp')}°C, rain={tm.get('rain')}mm, wind={tm.get('wind')}km/h")
            for a in w.get('alerts', []):
                lines.append(f"    >>> {a}")

    # Commodities
    comms = ws.get('commodities', [])
    if comms:
        lines.append(f'\nCOMMODITIES ({len(comms)} instruments):')
        for c in comms:
            arr = 'UP' if c['direction']=='up' else 'DN' if c['direction']=='down' else '--'
            lines.append(f"  [{arr}] {c['name']}: ${c['price']} ({'+' if c['change_pct']>=0 else ''}{c['change_pct']}%)")

    # Macro
    macro = ws.get('macro', [])
    if macro:
        lines.append('\nCENTRAL BANKS & MACRO:')
        for n in macro[:8]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Geopolitical
    geo = ws.get('geo', [])
    if geo:
        lines.append('\nGEOPOLITICAL & CONFLICTS:')
        for n in geo[:8]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Agriculture
    agri = ws.get('agri', [])
    if agri:
        lines.append('\nAGRICULTURE:')
        for n in agri[:5]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Energy
    energy = ws.get('energy', [])
    if energy:
        lines.append('\nENERGY:')
        for n in energy[:5]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Regulatory
    reg = ws.get('reg', [])
    if reg:
        lines.append('\nREGULATORY:')
        for n in reg[:5]:
            lines.append(f"  [{n['source']}] {n['title']}")

    # Social
    soc = ws.get('social', {})
    is_social_role = role in ('sentiment', 'social_sentiment')
    if soc:
        if is_social_role and not compact:
            lines.append(f"\n{soc.get('summary_text','')}")
        else:
            st = soc.get('stats', {})
            lines.append(f"\nSOCIAL: {st.get('total',0)} posts ({st.get('clean',0)} credible, {st.get('suspicious',0)} flagged)")
            st_sent = st.get('stocktwits_sentiment')
            if st_sent:
                lines.append(f"  StockTwits: {st_sent['bullish']}B/{st_sent['bearish']}Be of {st_sent['total']}")

    # General market news
    general = fn.get('general', [])
    if general:
        lines.append(f'\nMARKET NEWS ({len(general)} stories):')
        for n in general[:15]:
            lines.append(f"  [{n['source']}] {n['title']}")

    full = '\n'.join(lines)
    if compact:
        return full[:3000]
    return full
