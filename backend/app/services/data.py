"""Real-time data collector — all parallel, all free."""
import re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests, feedparser
from ..utils.logger import get_logger
log = get_logger('af.data')
S = requests.Session()
S.headers['User-Agent'] = 'AssetFlow/3.0'

def _get(url, params=None, timeout=8):
    try:
        r = S.get(url, params=params, timeout=timeout); r.raise_for_status(); return r.json()
    except: return None

def _feed(url, name, n=5):
    try:
        f = feedparser.parse(url)
        return [{'src':name,'title':(e.get('title')or'').strip(),
                 'summary':(e.get('summary')or'')[:250].strip(),
                 'url':e.get('link',''),'ts':e.get('published','')}
                for e in f.entries[:n]]
    except: return []

def _par(tasks, w=20):
    res = [None]*len(tasks)
    with ThreadPoolExecutor(max_workers=w) as ex:
        futs = {ex.submit(fn, *args): i for i,(fn,*args) in enumerate(tasks)}
        for fut in as_completed(futs):
            try: res[futs[fut]] = fut.result()
            except: pass
    return res

# PRICE
def price(sym, av_key=None):
    if av_key:
        d = _get('https://www.alphavantage.co/query',{'function':'GLOBAL_QUOTE','symbol':sym,'apikey':av_key})
        q = (d or {}).get('Global Quote', {})
        if q.get('05. price'):
            p, pc = float(q['05. price']), float(q['08. previous close'])
            return dict(symbol=sym,price=p,chg=round(p-pc,4),pct=round((p-pc)/pc*100,2),vol=int(q['06. volume']),src='alphavantage')
    d = _get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',{'interval':'1d','range':'5d'})
    meta = ((d or {}).get('chart',{}).get('result') or [{}])[0].get('meta',{})
    p = meta.get('regularMarketPrice')
    if p:
        pc = meta.get('previousClose', p)
        return dict(symbol=sym,price=p,chg=round(p-pc,4),pct=round((p-pc)/pc*100,2),
                    vol=meta.get('regularMarketVolume'),mcap=meta.get('marketCap'),src='yahoo')
    return None

def history(sym, days=60, av_key=None):
    rng = '1mo' if days<=30 else '3mo' if days<=90 else '1y'
    d = _get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',{'interval':'1d','range':rng})
    res = ((d or {}).get('chart',{}).get('result') or [None])[0]
    if not res: return []
    ts, q = res.get('timestamp',[]), res.get('indicators',{}).get('quote',[{}])[0]
    return [{'date':time.strftime('%Y-%m-%d',time.gmtime(t)),'o':q.get('open',[None])[i],
             'h':q.get('high',[None])[i],'l':q.get('low',[None])[i],
             'c':q.get('close',[None])[i],'v':q.get('volume',[None])[i]}
            for i,t in enumerate(ts) if q.get('close',[None])[i]]

def options(sym):
    d = _get(f'https://query2.finance.yahoo.com/v7/finance/options/{sym}')
    chain = ((d or {}).get('optionChain',{}).get('result') or [None])[0]
    if not chain: return None
    opts = (chain.get('options') or [{}])[0]
    calls, puts = opts.get('calls',[]), opts.get('puts',[])
    co = sum(c.get('openInterest',0) for c in calls)
    po = sum(p.get('openInterest',0) for p in puts)
    pc = round(po/co,2) if co else None
    return {'pc_ratio':pc,'call_oi':co,'put_oi':po,
            'signal':'bearish' if pc and pc>1.2 else 'bullish' if pc and pc<0.7 else 'neutral'}

def analyst(sym):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}',
             {'modules':'financialData,upgradeDowngradeHistory'})
    s = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0]
    fd = s.get('financialData',{})
    if not fd: return None
    hist = s.get('upgradeDowngradeHistory',{}).get('history',[])
    return {'target':(fd.get('targetMeanPrice')or{}).get('raw'),
            'rec':fd.get('recommendationKey'),
            'n':(fd.get('numberOfAnalystOpinions')or{}).get('raw'),
            'recent':[{'firm':h.get('firm'),'action':h.get('action'),'to':h.get('toGrade')} for h in hist[:3]]}

def earnings(sym):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}',
             {'modules':'calendarEvents,earningsTrend,earningsHistory'})
    s = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0]
    dates = s.get('calendarEvents',{}).get('earnings',{}).get('earningsDate',[])
    nd = dates[0].get('raw') if dates else None
    trend = (s.get('earningsTrend',{}).get('trend') or [{}])[0]
    hist  = (s.get('earningsHistory',{}).get('history') or [{}])[0]
    return {'next': time.strftime('%Y-%m-%d',time.gmtime(nd)) if nd else None,
            'eps_est':(trend.get('earningsEstimate')or{}).get('avg',{}).get('raw'),
            'last_surprise':(hist.get('surprisePercent')or{}).get('raw')}

def insider(sym):
    d = _get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}',{'modules':'insiderTransactions'})
    txns = ((d or {}).get('quoteSummary',{}).get('result') or [{}])[0].get('insiderTransactions',{}).get('transactions',[])
    b = sum(1 for t in txns if 'buy'  in (t.get('transactionText')or'').lower())
    s = sum(1 for t in txns if 'sell' in (t.get('transactionText')or'').lower())
    return {'buys':b,'sells':s,'net':'buy' if b>s else 'sell' if s>b else 'neutral'}

# NEWS
NEWS_FEEDS = [
    ('https://feeds.reuters.com/reuters/businessNews','Reuters'),
    ('https://finance.yahoo.com/news/rssindex','Yahoo Finance'),
    ('https://www.cnbc.com/id/100003114/device/rss/rss.html','CNBC'),
    ('https://feeds.content.dowjones.io/public/rss/mw_marketpulse','MarketWatch'),
    ('https://feeds.bloomberg.com/economics/news.rss','Bloomberg'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml','NYT'),
    ('https://seekingalpha.com/market_currents.xml','SeekingAlpha'),
    ('https://www.wsj.com/xml/rss/3_7085.xml','WSJ'),
    ('https://techcrunch.com/feed/','TechCrunch'),
    ('https://news.ycombinator.com/rss','HackerNews'),
    ('https://www.ft.com/?format=rss','FT'),
    ('https://venturebeat.com/feed/','VentureBeat'),
    ('https://www.zerohedge.com/fullrss2.xml','ZeroHedge'),
    ('https://thestreet.com/.rss/full/','TheStreet'),
    ('https://www.fool.com/feeds/index.aspx','Motley Fool'),
]
def news(sym):
    rs = _par([(_feed,u,n,5) for u,n in NEWS_FEEDS], 15)
    all_ = [i for b in rs if b for i in b]
    q = sym.lower()
    return {
        'specific': [n for n in all_ if q in n['title'].lower() or q in n['summary'].lower()][:20],
        'general':  sorted(all_, key=lambda x:x['ts'], reverse=True)[:30]
    }

# MACRO
MACRO_FEEDS = [
    ('https://www.federalreserve.gov/feeds/press_all.xml','Federal Reserve'),
    ('https://www.ecb.europa.eu/rss/press.html','ECB'),
    ('https://www.imf.org/en/News/rss?language=eng','IMF'),
    ('https://www.bls.gov/bls/news.rss','BLS (Jobs/CPI)'),
    ('https://apps.bea.gov/rss/rss.xml','BEA (GDP)'),
    ('https://www.treasury.gov/resource-center/data-chart-center/interest-rates/rss/rss.xml','US Treasury'),
]
def macro():
    rs = _par([(_feed,u,n,4) for u,n in MACRO_FEEDS])
    return sorted([i for b in rs if b for i in b], key=lambda x:x['ts'], reverse=True)

# WEATHER
REGIONS = [
    ('US Midwest (corn/soy)',41.5,-93.6,'corn,soy,ethanol'),
    ('Great Plains (wheat)',38.5,-98.0,'wheat'),
    ('Ukraine (wheat)',48.4,31.2,'wheat,sunflower'),
    ('Brazil (soy/coffee)',-14.2,-51.9,'soy,coffee,sugar'),
    ('Texas/Gulf (oil/gas)',29.7,-95.4,'crude,natural gas'),
    ('North Sea (Brent)',56.0,3.0,'Brent,gas'),
    ('Indonesia (palm oil)',-0.8,113.9,'palm oil'),
    ('West Africa (cocoa)',5.3,-4.0,'cocoa'),
]
WMO = {0:'Clear',1:'Mainly clear',61:'Rain',63:'Heavy rain',71:'Snow',80:'Showers',95:'Thunderstorm'}
def _wx1(name,lat,lon,imp):
    d = _get('https://api.open-meteo.com/v1/forecast',
             {'latitude':lat,'longitude':lon,'daily':'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
              'forecast_days':3,'timezone':'auto'},timeout=10)
    if not d or 'daily' not in d: return None
    dy=d['daily']
    days=[{'date':dy['time'][i],'max':dy['temperature_2m_max'][i],'min':dy['temperature_2m_min'][i],
           'rain':dy['precipitation_sum'][i],'code':dy['weathercode'][i],
           'cond':WMO.get(dy['weathercode'][i],str(dy['weathercode'][i]))}
          for i in range(len(dy['time']))]
    tm=days[1] if len(days)>1 else days[0]
    alerts=[]
    if tm['rain'] and tm['rain']>30: alerts.append(f'FLOOD RISK {tm["rain"]}mm')
    if all((d.get('rain')or 0)==0 for d in days): alerts.append('DROUGHT 3-day zero rain')
    if tm['max'] and tm['max']>40: alerts.append(f'EXTREME HEAT {tm["max"]}C')
    if tm['min'] and tm['min']<-3: alerts.append(f'FROST {tm["min"]}C')
    if tm['code'] in(95,96,99): alerts.append('THUNDERSTORM')
    return {'name':name,'importance':imp,'tomorrow':tm,'alerts':alerts,'sig':bool(alerts)}
def weather():
    return [r for r in _par([(_wx1,*reg) for reg in REGIONS]) if r]

# COMMODITIES
COMMS = [('GC=F','Gold'),('CL=F','WTI'),('BZ=F','Brent'),('NG=F','NatGas'),('ZW=F','Wheat'),
         ('ZC=F','Corn'),('ZS=F','Soy'),('HG=F','Copper'),('SI=F','Silver'),('BTC-USD','Bitcoin'),
         ('ETH-USD','Ethereum'),('^VIX','VIX'),('^TNX','10Y Yield'),('DX-Y.NYB','USD Index'),
         ('BDI','Baltic Dry'),('KC=F','Coffee'),('CC=F','Cocoa'),('LE=F','Live Cattle')]
def _c1(sym,name):
    d=_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',{'interval':'1d','range':'2d'},6)
    meta=((d or {}).get('chart',{}).get('result') or [{}])[0].get('meta',{})
    p=meta.get('regularMarketPrice')
    if not p: return None
    pc=meta.get('previousClose',p); pct=round((p-pc)/pc*100,2) if pc else 0
    return {'sym':sym,'name':name,'price':p,'pct':pct,'dir':'up' if pct>0.5 else 'down' if pct<-0.5 else 'flat'}
def commodities():
    return [r for r in _par([(_c1,s,n) for s,n in COMMS],18) if r]

# SECTOR FEEDS
def _feeds(lst,n=4):
    rs=_par([(_feed,u,s,n) for u,s in lst])
    return sorted([i for b in rs if b for i in b],key=lambda x:x['ts'],reverse=True)
GEO=[('https://reliefweb.int/headlines/rss.xml','ReliefWeb'),
     ('https://news.un.org/feed/subscribe/en/news/all/rss.xml','UN News'),
     ('https://rss.cfr.org/cfr_all','CFR'),('https://www.aljazeera.com/xml/rss/all.xml','AlJazeera')]
REG=[('https://feeds.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=10&search_text=&output=atom','SEC 8-K'),
     ('https://www.cftc.gov/rss/pressroom.xml','CFTC'),
     ('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml','FDA')]
ENERGY=[('https://www.eia.gov/rss/news.xml','EIA'),('https://oilprice.com/rss/main','OilPrice')]
AGRI=[('https://www.usda.gov/rss/home.xml','USDA'),('https://www.fao.org/news/rss-feed/en/','FAO')]
def geo():    return _feeds(GEO)
def reg():    return _feeds(REG)
def energy(): return _feeds(ENERGY)
def agri():   return _feeds(AGRI)

# SOCIAL
SUBS=['stocks','investing','wallstreetbets','SecurityAnalysis','StockMarket','options','dividends']
def _ms(title):
    t=title.lower(); s=0
    if re.search(r'(rocket|moon|squeeze|yolo|tendies)',t): s+=30
    if re.search(r'(\$\d{2,6})',t) and not re.search(r'(analysis|earnings|because)',t): s+=20
    return min(100,s)
def social(sym):
    posts=[]
    for sub in SUBS:
        try:
            r=S.get(f'https://www.reddit.com/r/{sub}/search.json',
                    params={'q':sym,'sort':'new','limit':6,'t':'day','restrict_sr':1},timeout=8)
            for item in r.json().get('data',{}).get('children',[]):
                p=item['data']
                posts.append({'platform':'reddit','sub':sub,'title':p.get('title',''),
                              'score':p.get('score',0),'manip':_ms(p.get('title',''))})
        except: pass
    d=_get(f'https://api.stocktwits.com/api/2/streams/symbol/{sym}.json')
    bull=bear=0
    for m in (d or {}).get('messages',[])[:20]:
        sent=(m.get('entities')or{}).get('sentiment',{}).get('basic','')
        if sent=='Bullish': bull+=1
        elif sent=='Bearish': bear+=1
        posts.append({'platform':'stocktwits','sub':'stocktwits','title':(m.get('body')or'')[:150],'score':0,'manip':0})
    clean=[p for p in posts if p['manip']<40]
    flagged=[p for p in posts if p['manip']>=40]
    return {'clean':clean,'flagged':flagged,'total':len(posts),'stocktwits':{'bull':bull,'bear':bear},
            'summary':f'{len(clean)} credible / {len(flagged)} flagged | StockTwits {bull}B {bear}Be'}

# MASTER
def build(sym, av_key=None, extra_texts=None):
    log.info(f'Building world state for {sym}')
    t0=time.time()
    (p,h,opt,an,earn,ins,n,m,wx,cm,g,r,en,ag,soc) = _par([
        (price,sym,av_key),(history,sym,60,av_key),(options,sym),(analyst,sym),(earnings,sym),
        (insider,sym),(news,sym),(macro,),(weather,),(commodities,),(geo,),(reg,),(energy,),(agri,),(social,sym),
    ],15)
    log.info(f'World state {sym} in {round(time.time()-t0,1)}s')
    return dict(sym=sym,ts=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                price=p,history=h or [],options=opt,analyst=an,earnings=earn,insider=ins,
                news=n or {},macro=m or [],weather=wx or [],commodities=cm or [],
                geo=g or [],reg=r or [],energy=en or [],agri=ag or [],social=soc or {},
                extra_texts=extra_texts or [])

def serialize(ws, compact=False):
    if not ws: return 'No data.'
    L=[f"=== WORLD DATA: {ws.get('sym')} ({ws.get('ts','')[:16]}) ===\n"]
    p=ws.get('price')
    if p: L.append(f"PRICE: ${p['price']:.4f} {'+' if p['pct']>=0 else ''}{p['pct']:.2f}% vol={p.get('vol','?')} src={p.get('src')}")
    if ws.get('options'): L.append(f"OPTIONS P/C: {ws['options']['pc_ratio']} -> {ws['options']['signal']}")
    if ws.get('analyst') and ws['analyst'].get('rec'): L.append(f"ANALYST: {ws['analyst']['rec'].upper()} target=${ws['analyst']['target']} n={ws['analyst']['n']}")
    if ws.get('earnings') and ws['earnings'].get('next'): L.append(f"EARNINGS: next={ws['earnings']['next']} eps_est={ws['earnings']['eps_est']} last_surprise={ws['earnings']['last_surprise']}%")
    if ws.get('insider'): L.append(f"INSIDER: {ws['insider']['buys']} buys {ws['insider']['sells']} sells -> {ws['insider']['net']}")
    h=ws.get('history',[])
    if h:
        L.append('\nPRICE HISTORY (last 15d):')
        for x in h[:15]: L.append(f"  {x['date']} O={x['o']} H={x['h']} L={x['l']} C={x['c']} V={x['v']}")
    sn=ws.get('news',{}).get('specific',[])
    if sn:
        L.append(f'\nASSET NEWS ({len(sn)}):')
        for n in sn[:12]: L.append(f"  [{n['src']}] {n['title']}")
    wx=ws.get('weather',[])
    if wx:
        sig=[w for w in wx if w.get('sig')]
        L.append(f'\nWEATHER ({len(wx)} regions, {len(sig)} alerts):')
        for w in wx:
            tm=w.get('tomorrow',{})
            L.append(f"  {w['name']} [{w['importance']}]{' *** ALERT ***' if w.get('sig') else ''}")
            L.append(f"    Tomorrow: {tm.get('cond')} max={tm.get('max')}C rain={tm.get('rain')}mm")
            for a in w.get('alerts',[]): L.append(f"    >>> {a}")
    cm=ws.get('commodities',[])
    if cm:
        L.append(f'\nCOMMODITIES ({len(cm)}):')
        for c in cm: L.append(f"  {'UP' if c['dir']=='up' else 'DN' if c['dir']=='down' else '--'} {c['name']}: ${c['price']} {'+' if c['pct']>=0 else ''}{c['pct']}%")
    for label, key in [('MACRO/CENTRAL BANKS','macro'),('GEOPOLITICAL','geo'),
                       ('REGULATORY','reg'),('ENERGY','energy'),('AGRICULTURE','agri')]:
        items=ws.get(key,[])
        if items:
            L.append(f'\n{label}:')
            for n in items[:5]: L.append(f"  [{n['src']}] {n['title']}")
    soc=ws.get('social',{})
    if soc: L.append(f"\nSOCIAL: {soc.get('summary','')}")
    gn=ws.get('news',{}).get('general',[])
    if gn:
        L.append(f'\nMARKET NEWS ({len(gn)}):')
        for n in gn[:12]: L.append(f"  [{n['src']}] {n['title']}")
    extra=ws.get('extra_texts',[])
    if extra:
        L.append(f'\nSUPPLEMENTARY RESEARCH FILES ({len(extra)}):')
        for i,t in enumerate(extra): L.append(f"  --- File {i+1} ---\n{t[:2000]}")
    out = '\n'.join(L)
    return out[:4000] if compact else out
