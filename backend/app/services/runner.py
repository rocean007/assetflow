import time
from .llm import call_llm, extract_json
from .graph import IntelGraph, Node, Edge, Vote
from ..utils.logger import get_logger
log = get_logger('af.runner')

ROLES = {
    'macro':      ('Macro Economist',     'rates,inflation,GDP,central banks,yield curve,currencies. Trace 2nd+3rd order effects.'),
    'sentiment':  ('Sentiment Analyst',   'news narratives,fear/greed,options P/C ratio,insider trades,short interest. Flag manip attempts as signals.'),
    'supply':     ('Supply Chain',        'weather ALERTS,commodity moves,shipping BDI,agriculture. Most INDIRECT causal chain wins.'),
    'technical':  ('Technical Analyst',   'OHLCV price action,estimated RSI,volume,support/resistance,momentum.'),
    'geo':        ('Geopolitical Risk',   'conflicts,sanctions,trade policy,regulatory actions. Trace: event -> commodity -> sector -> asset.'),
    'sector':     ('Sector Specialist',   'earnings date/estimates,analyst target,insider activity,M&A news,short interest.'),
    'social':     ('Social Intelligence', 'Reddit/StockTwits posts. If >40% flagged AND all same dir -> likely pump -> fade it. Cross-platform consensus = stronger.'),
}
ROLE_KEYS = list(ROLES.keys())
_ctr = 0

TMPL = '{"signal":"bullish","confidence":65,"reasoning":"1-2 sentence reason citing specific data","factors":["f1","f2"],"butterflies":["event -> mechanism -> price impact"],"edges":[{"from":"cause","to":"effect","dir":"bearish","label":"mechanism"}]}'
SYNTH_TMPL = '{"up":60,"down":25,"side":15,"direction":"up","magnitude":"moderate(1-3%)","confidence":65,"bull_case":"3-4 sentences","bear_case":"3-4 sentences","risks":["r1","r2","r3"],"catalysts":["c1","c2"],"butterflies":["chain1 step by step","chain2"],"social":"social signal summary","world":"key world data highlights","conflicts":"where agents disagreed","technical":"price action summary","fundamental":"earnings/analyst summary","summary":"6-8 sentence comprehensive executive summary"}'

def assign_role(agent):
    global _ctr
    if agent.role in ROLES: return agent.role
    r = ROLE_KEYS[_ctr % len(ROLE_KEYS)]; _ctr+=1; return r

def run_agent(agent, ctx: str, graph: IntelGraph) -> dict:
    role = assign_role(agent)
    rname, rdesc = ROLES[role]
    system = f"You are a {rname}. Focus: {rdesc}\nRespond ONLY as valid JSON. No other text."
    user   = (f"Asset: {graph.sym} ({graph.asset_type})\nDate: {time.strftime('%Y-%m-%d')}\n\n"
              f"DATA:\n{ctx[:4000]}\n\nYour role: {rname}\n\n"
              f"Output ONLY this JSON with your real analysis:\n{TMPL}")
    raw=None; parsed=None
    for attempt in range(2):
        try:
            raw = call_llm(agent, system, user if attempt==0 else
                           f"Analyze {graph.sym} for tomorrow. Output ONLY:\n{TMPL}")
            parsed = extract_json(raw)
            if parsed: break
        except Exception as e:
            log.warning(f'{agent.name} attempt {attempt+1}: {e}')
    if not parsed:
        parsed={'signal':'neutral','confidence':20,'reasoning':f'LLM failed: {(raw or '')[:100]}',
                'factors':[],'butterflies':[],'edges':[]}
    sig = parsed.get('signal','neutral')
    if sig not in ('bullish','bearish','neutral'): sig='neutral'
    conf = max(0,min(100,int(parsed.get('confidence',0) or 0)))
    nid = f"{role}_{agent.agent_id}"
    graph.add_node(Node(id=nid,type='specialist',label=rname,weight=conf/100,
                        agent_id=agent.agent_id,
                        data={'signal':sig,'confidence':conf,'reasoning':parsed.get('reasoning',''),
                              'factors':parsed.get('factors',[]),'butterflies':parsed.get('butterflies',[])}))
    graph.add_edge(Edge(id=f'root_{nid}',source='root',target=nid,label=rname,
                        direction=sig,weight=conf/100,type='root_link'))
    for i,e in enumerate(parsed.get('edges',[])):
        if not e.get('from') or not e.get('to'): continue
        fid=f"c_{e['from'][:30].replace(' ','_').lower()}"
        tid=f"c_{e['to'][:30].replace(' ','_').lower()}"
        for cid,clabel in [(fid,e['from']),(tid,e['to'])]:
            if cid not in graph.nodes:
                graph.add_node(Node(id=cid,type='concept',label=clabel,weight=0.5))
        graph.add_edge(Edge(id=f'e_{nid}_{i}',source=fid,target=tid,
                            label=e.get('label',''),direction=e.get('dir','neutral'),type='causal'))
    graph.add_vote(Vote(agent_id=agent.agent_id,agent_name=agent.name,role=role,
                        signal=sig,confidence=conf,reasoning=parsed.get('reasoning',''),
                        factors=parsed.get('factors',[]),butterflies=parsed.get('butterflies',[])))
    log.info(f"{agent.name}({role}): {sig} @{conf}%")
    return {'role':role,'role_name':rname,'agent_id':agent.agent_id,'agent_name':agent.name,
            'signal':sig,'confidence':conf,'reasoning':parsed.get('reasoning',''),
            'factors':parsed.get('factors',[]),'butterflies':parsed.get('butterflies',[])}

SYNTH_SYS = """You are the Master Synthesizer.
You have received the complete intelligence graph from all specialist agents.
Agents analyzed: price/OHLCV, options, analysts, earnings, insiders, 15 news feeds,
central banks, weather x8 regions, 18 commodities, geopolitical, regulatory, social media,
plus any uploaded research files.
Reconcile ALL signals. Follow butterfly chains. Explain conflicts.
Output ONLY valid JSON."""

def run_synthesizer(agent, graph: IntelGraph) -> dict:
    st=graph.stats; t=st['agents'] or 1
    system=SYNTH_SYS
    user=(f"{graph.to_synth_prompt()}\n\nOutput ONLY this JSON with your verdict:\n{SYNTH_TMPL}")
    raw=None; parsed=None
    for attempt in range(2):
        try:
            raw=call_llm(agent,system,user if attempt==0 else
                         f"Synthesize {st['bull']}B/{st['bear']}Be/{st['neut']}N for {graph.sym}. Output ONLY:\n{SYNTH_TMPL}")
            parsed=extract_json(raw)
            if parsed: break
        except Exception as e:
            log.warning(f'Synth {agent.name} attempt {attempt+1}: {e}')
    if not parsed:
        up=round(st['bull']/t*100); dn=round(st['bear']/t*100)
        return {'up':up,'down':dn,'side':100-up-dn,
                'direction':'up' if st['bull']>st['bear'] else 'down' if st['bear']>st['bull'] else 'sideways',
                'magnitude':'small(<1%)','confidence':30,
                'bull_case':f"{st['bull']}/{t} bullish",'bear_case':f"{st['bear']}/{t} bearish",
                'risks':['Synth failed'],'catalysts':[],'butterflies':[],
                'social':'N/A','world':'N/A','conflicts':'N/A','technical':'N/A','fundamental':'N/A',
                'summary':f"Fallback vote: {st['bull']}B/{st['bear']}Be/{st['neut']}N",'_fallback':True}
    # Normalize probabilities
    up=max(0,int(parsed.get('up',0))); dn=max(0,int(parsed.get('down',0))); sd=max(0,int(parsed.get('side',0)))
    tot=(up+dn+sd) or 100
    parsed['up']=round(up/tot*100); parsed['down']=round(dn/tot*100); parsed['side']=100-parsed['up']-parsed['down']
    return {**parsed,'agent_id':agent.agent_id,'agent_name':agent.name}
