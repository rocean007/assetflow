"""
Data Collector — every real-time source, all in parallel, all free.
"""
import re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
import requests
import feedparser
from ..utils.logger import get_logger
log = get_logger('assetflow.data')

S = requests.Session()
S.headers.update({'User-Agent':'AssetFlow/2.0','Accept':'application/json'})

def _get(url, params=None, timeout=10):
    try:
        r = S.get(url, params=params, timeout=timeout); r.raise_for_status(); return r.json()
    except: return None

def _feed(url, name, n=6):
    try:
        f = feedparser.parse(url)
        return [{'source':name,'title':(e.get('title')or'').strip(),
                 'summary':(e.get('summary')or e.get('description')or'')[:280].strip(),
                 'url':e.get('link',''),'published':e.get('published',e.get('updated',''))}
                for e in f.entries[:n]]
    except: return []

def _par(tasks, workers=22):
    results = [None]*len(tasks)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fn,*args): i for i,(fn,*args) in enumerate(tasks)}
        for fut in as_completed(futs):
            try: results[futs[fut]] = fut.result()
            except: pass
    return results

# ── MARKET DATA ──────────────────────────────────────────────────────────────
def fetch_price(symbol, av_key=None):
    if av_key:
        d = _get('https://www.alphavantage.co/query',{'function':'GLOBAL_QUOTE','symbol':symbol,'apikey':av_key})
        q = (d or {}).get('Global Quote',{})
        if q.get('05. price'):
            p,pc = float(q['05. price']), float(q['08. previous close'])
            return dict(symbol=symbol,price=p,change=p-pc,change_pct=round((p-pc)/pc*100,2),
                        volume=int(q['06. volume']),source='alphavantage')
    d = _get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}',{'interval':'1d','range':'5d'})
    meta = ((d or {}).get('chart',{}).get('result') or [{}])[0].get('meta',{})
    if meta.get('regularMarketPrice'):
        p,pc = meta['regularMarketPrice'], meta.get('previousClose', meta['regularMarketPrice'])
        return dict(symbol=symbol,price=p,change=round(p-pc,4),change_pct=round((p-pc)/pc*100,2),
                    volume=meta.get('regularMarketVolume'),market_cap=meta.get('marketCap'),source='yahoo')
    return None

def fetch_history(symbol, days=60, av_key=None):
    if av_key:
        d = _get('https://www.alphavantage.co/query',{'function':'TIME_SERIES_DAILY','symbol':symbol,'outputsize':'compact','apikey':av_key})
        s = (d or {}).get('Time Series (Daily)',{})
        if s: return [{'date':dt,'open':float(v['1. open']),'high':float(v['2. high']),
                       'low':float(v['3. low']),'close':float(v['4. close']),'volume':int(v['5. volume'])}
                      for dt,v in list(s.items())[:days]]
    rng = '1mo' if days<=30 else '3mo' if days<=90 else '1y'
    d = _get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}',{'interval':'1d','range':rng})
    res = ((d or {}).get('chart',{}).get('result') or [None])[0]
    if not res: return []
    ts,q = res.get('timestamp',[]),res.get('indicators',{}).get('quote',[{}])[0]
    return [{'date':time.strftime('%Y-%m-%d',time.gmtime(t)),'open':q.get('open',[None])[i],
             'high':q.get('high',[None])[i],'low':q.get('low',[None])[i],
             'close':q.get('close',[None])[i],'volume':q.get('volume',[None])[i]}
            for i,t in enumerate(ts) if q.get('close',[None])[i]]

def fetch_options(symbol):
    d = _get(f'https://query2.finance.yahoo.com/v7/finance/options/{symbol}')
    chain = ((d or {}).get('optionChain',{}).get('result') or [None])[0]
    if not chain: return None
    opts = (chain.get('options') or [{}])[0]
    calls,puts = opts.get('calls',[]),opts.get('puts',[])
    co = sum(c.get('openInterest',0) for c in calls)
    po = sum(p.get('openInterest',0) for p in puts)
    pc = round(po/co,2) if co else None
    return {'put_call_ratio':pc,'call_oi':co,'put_oi':po,
            'iv':round(calls[0].get('impliedVolatility',0),3) if calls else None,
            'signal':'bearish_options' if pc and pc>1.2 else 'bullish_options' if pc and pc<0.7 else 'neutral'}

def fetch_analyst(symbol):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',
             {'modules':'financialData,upgradeDowngradeHistory'})
    s = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0]
    fd = s.get('financialData',{})
    hist = s.get('upgradeDowngradeHistory',{}).get('history',[])
    if not fd: return None
    return {'target':  (fd.get('targetMeanPrice') or {}).get('raw'),
            'current': (fd.get('currentPrice') or {}).get('raw'),
            'rec':     fd.get('recommendationKey'),
            'n':       (fd.get('numberOfAnalystOpinions') or {}).get('raw'),
            'recent':  [{'firm':h.get('firm'),'action':h.get('action'),'grade':h.get('toGrade')} for h in hist[:3]]}

def fetch_earnings(symbol):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',
             {'modules':'calendarEvents,earningsTrend,earningsHistory'})
    s = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0]
    dates = s.get('calendarEvents',{}).get('earnings',{}).get('earningsDate',[])
    nd = dates[0].get('raw') if dates else None
    trend = (s.get('earningsTrend',{}).get('trend') or [{}])[0]
    hist = (s.get('earningsHistory',{}).get('history') or [{}])[0]
    return {'next_date':time.strftime('%Y-%m-%d',time.gmtime(nd)) if nd else None,
            'eps_est':(trend.get('earningsEstimate') or {}).get('avg',{}).get('raw'),
            'last_surprise':(hist.get('surprisePercent') or {}).get('raw')}

def fetch_insider(symbol):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',{'modules':'insiderTransactions'})
    txns = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0].get('insiderTransactions',{}).get('transactions',[])
    buys  = sum(1 for t in txns if 'buy'  in (t.get('transactionText') or '').lower())
    sells = sum(1 for t in txns if 'sell' in (t.get('transactionText') or '').lower())
    return {'buys':buys,'sells':sells,'net':'buy' if buys>sells else 'sell' if sells>buys else 'neutral'}

def fetch_short(symbol):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}',{'modules':'defaultKeyStatistics'})
    s = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0].get('defaultKeyStatistics',{})
    pct = (s.get('shortPercentOfFloat') or {}).get('raw')
    return {'short_pct':pct,'signal':'high_short' if pct and pct>0.2 else 'normal'} if s else None

# ── NEWS FEEDS ───────────────────────────────────────────────────────────────
NEWS = [
    ('https://feeds.reuters.com/reuters/businessNews','Reuters Business'),
    ('https://feeds.reuters.com/reuters/technologyNews','Reuters Tech'),
    ('https://finance.yahoo.com/news/rssindex','Yahoo Finance'),
    ('https://www.cnbc.com/id/100003114/device/rss/rss.html','CNBC'),
    ('https://feeds.content.dowjones.io/public/rss/mw_marketpulse','MarketWatch'),
    ('https://feeds.bloomberg.com/economics/news.rss','Bloomberg'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml','NYT Business'),
    ('https://www.ft.com/?format=rss','FT'),
    ('https://seekingalpha.com/market_currents.xml','Seeking Alpha'),
    ('https://www.wsj.com/xml/rss/3_7085.xml','WSJ Markets'),
    ('https://feeds.a.dj.com/rss/RSSMarketsMain.xml','Dow Jones'),
    ('https://www.investing.com/rss/news_25.rss','Investing.com'),
    ('https://techcrunch.com/feed/','TechCrunch'),
    ('https://feeds.arstechnica.com/arstechnica/index','Ars Technica'),
    ('https://news.ycombinator.com/rss','HackerNews'),
    ('https://venturebeat.com/feed/','VentureBeat'),
    ('https://thestreet.com/.rss/full/','TheStreet'),
    ('https://www.fool.com/feeds/index.aspx','Motley Fool'),
    ('https://www.zerohedge.com/fullrss2.xml','ZeroHedge'),
]
def fetch_news(symbol):
    rs = _par([(  _feed,url,n,5) for url,n in NEWS], 20)
    all_ = [i for b in rs if b for i in b]
    q = symbol.lower()
    return {'specific': [n for n in all_ if q in n['title'].lower() or q in n['summary'].lower()][:20],
            'general':  sorted([n for n in all_], key=lambda x:x['published'], reverse=True)[:30]}

# ── MACRO ────────────────────────────────────────────────────────────────────
MACRO_FEEDS = [
    ('https://www.federalreserve.gov/feeds/press_all.xml','Federal Reserve'),
    ('https://www.ecb.europa.eu/rss/press.html','ECB'),
    ('https://www.bis.org/doclist/all_speeches.rss','BIS'),
    ('https://www.imf.org/en/News/rss?language=eng','IMF'),
    ('https://blogs.worldbank.org/rss.xml','World Bank'),
    ('https://www.bls.gov/bls/news.rss','BLS (Jobs/CPI)'),
    ('https://apps.bea.gov/rss/rss.xml','BEA (GDP)'),
    ('https://www.wto.org/english/news_e/news_e.rss','WTO'),
    ('https://www.treasury.gov/resource-center/data-chart-center/interest-rates/rss/rss.xml','US Treasury'),
]
def fetch_macro():
    rs = _par([(_feed,u,n,4) for u,n in MACRO_FEEDS])
    return sorted([i for b in rs if b for i in b], key=lambda x:x['published'],reverse=True)

# ── WEATHER (12 regions) ─────────────────────────────────────────────────────
WMO = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',51:'Drizzle',
       61:'Rain',63:'Heavy rain',65:'Very heavy rain',71:'Snow',75:'Heavy snow',
       80:'Showers',95:'Thunderstorm',96:'T-storm+hail'}
REGIONS = [
    ('US Midwest (corn/soy)',41.5,-93.6,'corn, soy, ethanol'),
    ('Great Plains (wheat)',38.5,-98.0,'winter wheat'),
    ('Ukraine (wheat/sunflower)',48.4,31.2,'wheat, sunflower'),
    ('Brazil (soy/coffee)',  -14.2,-51.9,'soybeans, coffee, sugar'),
    ('India (wheat/rice)',   20.6, 79.1,'wheat, rice, cotton'),
    ('Australia (wheat)',   -27.5,133.8,'wheat, coal, LNG'),
    ('Indonesia (palm oil)', -0.8,113.9,'palm oil, coal'),
    ('Texas/Gulf (oil/gas)', 29.7,-95.4,'crude oil, natural gas'),
    ('North Sea (Brent)',    56.0,  3.0,'Brent crude, gas'),
    ('China (manufacturing)',35.0,105.0,'manufacturing, pork'),
    ('Argentina (soy/corn)',-34.6,-58.4,'soybeans, corn, beef'),
    ('West Africa (cocoa)',   5.3, -4.0,'cocoa, palm oil'),
]
def _weather_one(name,lat,lon,imp):
    d = _get('https://api.open-meteo.com/v1/forecast',
             {'latitude':lat,'longitude':lon,
              'daily':'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode',
              'forecast_days':4,'timezone':'auto'},timeout=12)
    if not d or 'daily' not in d: return None
    dy=d['daily']
    days=[{'date':dy['time'][i],'max_t':dy['temperature_2m_max'][i],'min_t':dy['temperature_2m_min'][i],
           'rain':dy['precipitation_sum'][i],'wind':dy['windspeed_10m_max'][i],
           'code':dy['weathercode'][i],'cond':WMO.get(dy['weathercode'][i],f"code {dy['weathercode'][i]}")}
          for i in range(len(dy['time']))]
    tm=days[1] if len(days)>1 else days[0]
    alerts=[]
    if tm['rain'] and tm['rain']>30: alerts.append(f'FLOOD RISK: {tm["rain"]}mm forecast')
    if all((d.get('rain') or 0)==0 for d in days[:3]): alerts.append('DROUGHT: 3-day zero rainfall')
    if tm['max_t'] and tm['max_t']>40: alerts.append(f'EXTREME HEAT: {tm["max_t"]}°C')
    if tm['min_t'] and tm['min_t']<-3: alerts.append(f'FROST RISK: {tm["min_t"]}°C')
    if tm['wind'] and tm['wind']>70: alerts.append(f'STORM: {tm["wind"]}km/h winds')
    if tm['code'] in(95,96,99): alerts.append('THUNDERSTORM forecast')
    if tm['code'] in(71,73,75): alerts.append('SNOW/BLIZZARD forecast')
    return {'name':name,'importance':imp,'days':days,'tomorrow':tm,'alerts':alerts,'significant':bool(alerts)}
def fetch_weather():
    return [r for r in _par([(_weather_one,*reg) for reg in REGIONS]) if r]

# ── COMMODITIES (30 instruments) ─────────────────────────────────────────────
COMMS = [('GC=F','Gold'),('SI=F','Silver'),('PL=F','Platinum'),('CL=F','WTI Crude'),
         ('BZ=F','Brent Crude'),('NG=F','Natural Gas'),('ZW=F','Wheat'),('ZC=F','Corn'),
         ('ZS=F','Soybeans'),('KC=F','Coffee'),('CT=F','Cotton'),('CC=F','Cocoa'),
         ('SB=F','Sugar'),('LE=F','Live Cattle'),('HE=F','Lean Hogs'),('HG=F','Copper'),
         ('ALI=F','Aluminum'),('DX-Y.NYB','USD Index'),('BTC-USD','Bitcoin'),
         ('ETH-USD','Ethereum'),('^VIX','VIX'),('^TNX','US 10Y Yield'),
         ('EURUSD=X','EUR/USD'),('JPY=X','USD/JPY'),('GBP=X','GBP/USD'),
         ('CNY=X','USD/CNY'),('BDI','Baltic Dry'),('HO=F','Heating Oil'),
         ('RB=F','Gasoline'),('PA=F','Palladium')]
def _comm_one(sym,name):
    d=_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',{'interval':'1d','range':'2d'},6)
    meta=((d or {}).get('chart',{}).get('result') or [{}])[0].get('meta',{})
    p=meta.get('regularMarketPrice')
    if not p: return None
    pc=meta.get('previousClose',p); pct=round((p-pc)/pc*100,2) if pc else 0
    return {'symbol':sym,'name':name,'price':p,'change_pct':pct,
            'direction':'up' if pct>0.5 else 'down' if pct<-0.5 else 'flat'}
def fetch_commodities():
    return [r for r in _par([(_comm_one,s,n) for s,n in COMMS],25) if r]

# ── SECTOR FEEDS ─────────────────────────────────────────────────────────────
def _feeds(lst,n=4):
    rs=_par([(_feed,u,s,n) for u,s in lst])
    return sorted([i for b in rs if b for i in b],key=lambda x:x['published'],reverse=True)

AGRI=  [('https://www.usda.gov/rss/home.xml','USDA'),('https://www.fao.org/news/rss-feed/en/','FAO'),
        ('https://www.agweb.com/rss/news','AgWeb'),('https://www.world-grain.com/rss/all','World Grain')]
ENERGY=[('https://www.eia.gov/rss/news.xml','EIA'),('https://oilprice.com/rss/main','OilPrice'),
        ('https://electrek.co/feed/','Electrek'),('https://pv-tech.org/feed/','PV-Tech')]
SHIP=  [('https://splash247.com/feed/','Splash247'),('https://www.freightwaves.com/news/feed','FreightWaves'),
        ('https://www.hellenicshippingnews.com/feed/','Hellenic Shipping')]
GEO=   [('https://reliefweb.int/headlines/rss.xml','ReliefWeb'),
        ('https://news.un.org/feed/subscribe/en/news/all/rss.xml','UN News'),
        ('https://rss.cfr.org/cfr_all','CFR'),('https://foreignpolicy.com/feed/','Foreign Policy'),
        ('https://www.aljazeera.com/xml/rss/all.xml','Al Jazeera'),
        ('https://www.bbc.co.uk/news/world/rss.xml','BBC World')]
REG=   [('https://feeds.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=10&search_text=&output=atom','SEC 8-K'),
        ('https://www.cftc.gov/rss/pressroom.xml','CFTC'),
        ('https://www.ftc.gov/feeds/news-feed','FTC'),
        ('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml','FDA')]
HEALTH=[('https://www.statnews.com/feed/','STAT News'),('https://www.fiercepharma.com/rss/xml','Fierce Pharma')]
ESG=   [('https://www.esgtoday.com/feed/','ESG Today'),('https://www.carbonbrief.org/feed/','Carbon Brief')]
LABOR= [('https://www.bls.gov/bls/news.rss','BLS'),('https://layoffs.fyi/feed/','Layoffs.fyi')]
CRYPTO=[('https://cointelegraph.com/rss','CoinTelegraph'),('https://decrypt.co/feed','Decrypt')]
CONS=  [('https://nrf.com/rss.xml','NRF Retail'),('https://www.consumeraffairs.com/news_index.rss','ConsumerAffairs')]

def fetch_agri():    return _feeds(AGRI)
def fetch_energy():  return _feeds(ENERGY)
def fetch_geo():     return _feeds(GEO)
def fetch_reg():     return _feeds(REG)
def fetch_health():  return _feeds(HEALTH)
def fetch_esg():     return _feeds(ESG)
def fetch_labor():   return _feeds(LABOR)
def fetch_crypto():  return _feeds(CRYPTO)
def fetch_consumer():return _feeds(CONS)
def fetch_shipping():return _feeds(SHIP)

# ── SOCIAL MEDIA ─────────────────────────────────────────────────────────────
REDDIT_SUBS = ['stocks','investing','wallstreetbets','SecurityAnalysis','StockMarket',
               'options','dividends','ValueInvesting','ETFs','Superstonk']
def _manip(title,body='',score=0,age=9999):
    txt=f'{title} {body}'.lower(); s=0
    if re.search(r'\$\d{2,6}',txt) and not re.search(r'(because|analysis|earnings|data)',txt): s+=20
    if re.search(r'(rocket|moon|lambo|diamond.hand|tendies|squeeze|yolo)',txt): s+=20
    if len(re.findall(r'[A-Z]{4,}',title))>3: s+=10
    if re.search(r'not.financial.advice',txt) and re.search(r'(buy|calls|puts|long|short)',txt): s+=15
    if score>5000 and age<90: s+=25
    return min(100,s)

def _reddit(symbol):
    posts=[]
    for sub in REDDIT_SUBS:
        try:
            r=S.get(f'https://www.reddit.com/r/{sub}/search.json',
                    params={'q':symbol,'sort':'new','limit':8,'t':'day','restrict_sr':1},timeout=10)
            for item in r.json().get('data',{}).get('children',[]):
                p=item['data']
                age=(time.time()-p.get('created_utc',time.time()))/60
                post={'platform':'reddit','sub':f'r/{sub}','title':p.get('title',''),
                      'body':(p.get('selftext',''))[:300],'score':p.get('score',0),
                      'comments':p.get('num_comments',0)}
                post['manip_score']=_manip(post['title'],post['body'],post['score'],age)
                posts.append(post)
        except: pass
    return posts

def _stocktwits(symbol):
    d=_get(f'https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json')
    posts=[]
    for m in (d or {}).get('messages',[])[:30]:
        p={'platform':'stocktwits','sub':'StockTwits','title':(m.get('body',''))[:200],'body':'',
           'score':(m.get('likes') or {}).get('total',0),
           'native_sentiment':(m.get('entities') or {}).get('sentiment',{}).get('basic')}
        p['manip_score']=_manip(p['title'])
        posts.append(p)
    return posts

def _nitter(symbol):
    for inst in ['https://nitter.poast.org','https://nitter.privacydev.net','https://nitter.1d4.us']:
        items=_feed(f'{inst}/search/rss?q=%24{symbol}&f=tweets','Twitter/X',15)
        if items:
            for i in items: i.update({'platform':'x','manip_score':_manip(i['title'])})
            return items
    return []

def fetch_social(symbol):
    reddit,st,nitter=_par([(_reddit,symbol),(_stocktwits,symbol),(_nitter,symbol)])
    reddit,st,nitter=reddit or [],st or [],nitter or []
    all_=reddit+st+nitter
    clean=[p for p in all_ if p.get('manip_score',0)<40]
    susp =[p for p in all_ if p.get('manip_score',0)>=40]
    st_s=[p for p in st if p.get('native_sentiment')]
    bull=sum(1 for p in st_s if p['native_sentiment']=='Bullish')
    bear=sum(1 for p in st_s if p['native_sentiment']=='Bearish')
    top='\n'.join(f"[{p['platform']}/{p['sub']}] {p['title'][:120]} (score:{p['score']},manip:{p['manip_score']}%)"
                  for p in clean[:20])
    susp_txt='\n'.join(f"[FLAGGED:{p['manip_score']}%][{p['platform']}] {p['title'][:100]}"
                       for p in susp[:6])
    summary=(f"SOCIAL SIGNALS FOR {symbol}:\n"
             f"Total: {len(all_)} posts ({len(clean)} credible, {len(susp)} flagged)\n"
             f"Reddit={len(reddit)} StockTwits={len(st)} X={len(nitter)}\n")
    if st_s: summary+=f"StockTwits: {bull}B/{bear}Be of {len(st_s)}\n"
    summary+=f"\nCREDIBLE POSTS:\n{top or 'None'}\n\nFLAGGED:\n{susp_txt or 'None'}"
    return {'all':all_,'clean':clean,'suspicious':susp,
            'stats':{'total':len(all_),'clean':len(clean),'suspicious':len(susp),
                     'by_platform':{'reddit':len(reddit),'stocktwits':len(st),'x':len(nitter)},
                     'stocktwits_sentiment':{'bullish':bull,'bearish':bear,'total':len(st_s)} if st_s else None},
            'summary_text':summary}

# ── MASTER BUILDER ───────────────────────────────────────────────────────────
def build_world_state(symbol, av_key=None, extra_texts=None):
    log.info(f'Building world state for {symbol}...')
    t0=time.time()
    tasks=[
        (fetch_price,symbol,av_key),(fetch_history,symbol,60,av_key),
        (fetch_options,symbol),(fetch_analyst,symbol),(fetch_earnings,symbol),
        (fetch_insider,symbol),(fetch_short,symbol),(fetch_news,symbol),
        (fetch_macro,),(fetch_weather,),(fetch_commodities,),
        (fetch_agri,),(fetch_energy,),(fetch_shipping,),(fetch_geo,),(fetch_reg,),
        (fetch_health,),(fetch_consumer,),(fetch_esg,),(fetch_social,symbol),
        (fetch_crypto,),(fetch_labor,),
    ]
    (price,history,options,analyst,earnings,insider,short_int,
     news,macro,weather,commodities,agri,energy,shipping,geo,reg,
     health,consumer,esg,social,crypto,labor)=_par(tasks,22)
    log.info(f'World state ready in {round(time.time()-t0,1)}s')
    return dict(
        fetched_at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),symbol=symbol,
        price=price,history=history or [],options=options,analyst=analyst,
        earnings=earnings,insider=insider,short_int=short_int,
        news=news or {},macro=macro or [],weather=weather or [],
        commodities=commodities or [],agri=agri or [],energy=energy or [],
        shipping=shipping or [],geo=geo or [],reg=reg or [],
        health=health or [],consumer=consumer or [],esg=esg or [],
        social=social or {},crypto=crypto or [],labor=labor or [],
        extra_texts=extra_texts or [],
    )

# ── SERIALIZE TO PROMPT TEXT ─────────────────────────────────────────────────
def serialize(ws, role='', compact=False):
    if not ws: return 'World state unavailable.'
    L=[f"=== WORLD STATE: {ws.get('symbol')} ({ws.get('fetched_at','')[:16]} UTC) ===\n"]
    p=ws.get('price')
    if p:
        L.append(f"PRICE: ${p['price']:.4f} ({'+' if p['change_pct']>=0 else ''}{p['change_pct']:.2f}% today, vol {p.get('volume') or '?'})")
        if p.get('market_cap'): L.append(f"Market cap: ${p['market_cap']/1e9:.1f}B")
    if ws.get('options'): L.append(f"OPTIONS P/C: {ws['options']['put_call_ratio']} | {ws['options']['signal']}")
    if ws.get('short_int') and ws['short_int'].get('short_pct'): L.append(f"SHORT: {ws['short_int']['short_pct']*100:.1f}% float")
    if ws.get('analyst') and ws['analyst'].get('rec'): L.append(f"ANALYST: {ws['analyst']['rec'].upper()} | target ${ws['analyst']['target']} | n={ws['analyst']['n']}")
    if ws.get('earnings') and ws['earnings'].get('next_date'): L.append(f"EARNINGS: next={ws['earnings']['next_date']} eps_est=${ws['earnings']['eps_est']}")
    if ws.get('insider'): L.append(f"INSIDER: {ws['insider']['buys']} buys vs {ws['insider']['sells']} sells ({ws['insider']['net']})")
    if ws.get('history'):
        L.append('\nPRICE HISTORY (last 20 sessions):')
        for h in ws['history'][:20]:
            L.append(f"  {h['date']} O={h['open']} H={h['high']} L={h['low']} C={h['close']} V={h['volume']}")
    spec=ws.get('news',{}).get('specific',[])
    if spec:
        L.append(f'\nASSET NEWS ({len(spec)}):')
        for n in spec[:15]: L.append(f"  [{n['source']}] {n['title']}")
    if ws.get('weather'):
        sig=[w for w in ws['weather'] if w.get('significant')]
        L.append(f'\nWEATHER ({len(ws["weather"])} regions, {len(sig)} alerts):')
        for w in ws['weather']:
            tm=w.get('tomorrow',{})
            flag=' *** ALERT ***' if w.get('significant') else ''
            L.append(f"  {w['name']} [{w['importance']}]{flag}")
            L.append(f"    Tomorrow: {tm.get('cond','?')}, {tm.get('max_t')}°C, {tm.get('rain')}mm rain, {tm.get('wind')}km/h wind")
            for a in w.get('alerts',[]): L.append(f"    >>> {a}")
    if ws.get('commodities'):
        L.append(f'\nCOMMODITIES ({len(ws["commodities"])}):')
        for c in ws['commodities']:
            arr='UP' if c['direction']=='up' else 'DN' if c['direction']=='down' else '--'
            L.append(f"  [{arr}] {c['name']}: ${c['price']} ({'+' if c['change_pct']>=0 else ''}{c['change_pct']}%)")
    for label,key in [('MACRO/CENTRAL BANKS','macro'),('GEOPOLITICAL','geo'),('AGRICULTURE','agri'),
                      ('ENERGY','energy'),('REGULATORY','reg'),('LABOR','labor'),('CONSUMER','consumer'),('ESG','esg')]:
        items=ws.get(key,[])
        if items:
            L.append(f'\n{label}:')
            for n in items[:6]: L.append(f"  [{n['source']}] {n['title']}")
    soc=ws.get('social',{})
    is_social=role in('sentiment','social_sentiment')
    if soc:
        if is_social and not compact: L.append(f"\n{soc.get('summary_text','')}")
        else:
            st=soc.get('stats',{})
            L.append(f"\nSOCIAL: {st.get('total',0)} posts ({st.get('clean',0)} credible, {st.get('suspicious',0)} flagged)")
    gen=ws.get('news',{}).get('general',[])
    if gen:
        L.append(f'\nMARKET NEWS ({len(gen)}):')
        for n in gen[:15]: L.append(f"  [{n['source']}] {n['title']}")
    extra=ws.get('extra_texts',[])
    if extra:
        L.append(f'\nSUPPLEMENTARY RESEARCH FILES ({len(extra)} uploaded):')
        for i,txt in enumerate(extra):
            L.append(f"  --- File {i+1} ---")
            L.append(txt[:2000])
    return '\n'.join(L) if not compact else '\n'.join(L)[:3500]
