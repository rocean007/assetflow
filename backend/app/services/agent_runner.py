"""Agent runner — 7 specialist roles + synthesizer + super-synthesizer."""
import time
from .llm_client import call_llm, extract_json, safe_output, is_small_model
from .graph_builder import SharedGraph, GNode, GEdge, Signal
from ..utils.logger import get_logger
log = get_logger('assetflow.runner')

ROLES = {
    'macro': {
        'name': 'Macro Economist',
        'full': "You are a senior macro economist predicting next-day asset price direction.\nAnalyze: rates, inflation, GDP, central banks, yield curve, currencies, sovereign debt.\nTrace butterfly effects — 2nd and 3rd order ripples matter most.\nRespond ONLY as valid JSON, no other text.",
        'compact': "Macro analyst. Output ONLY the JSON. Fill in your analysis.",
        'tpl': '{"signal":"bullish","confidence":65,"reasoning":"brief macro reason citing specific data","keyFactors":["rate signal","inflation data"],"butterflies":["rates up -> USD up -> EM sell -> risk-off -> asset falls"],"edgeClaims":[{"from":"interest_rates","to":"asset","direction":"bearish","weight":0.7,"label":"rate pressure"}]}',
    },
    'sentiment': {
        'name': 'Sentiment Analyst',
        'full': "You are a market sentiment specialist. Use: news narratives, social data (with manip scores), options P/C ratios, insider trades, short interest.\nA flagged manipulation attempt IS a signal itself.\nHigh P/C(>1.2)=bearish. Net insider buying=bullish.\nRespond ONLY as valid JSON.",
        'compact': "Sentiment analyst. Output ONLY the JSON. Fill in your analysis.",
        'tpl': '{"signal":"bullish","confidence":60,"reasoning":"social buzz, options flow analysis","keyFactors":["social signal","options flow"],"butterflies":["narrative -> retail FOMO -> momentum"],"manipulationNote":"assessment","edgeClaims":[]}',
    },
    'supply_chain': {
        'name': 'Supply Chain Analyst',
        'full': "You are a global supply chain specialist. Use ALL weather alerts, ALL commodity moves, shipping BDI, agri reports.\nFind the most indirect causal chain from REAL data.\nDrought in Brazil -> delayed soy harvest -> feed shortage -> protein prices -> food inflation -> consumer spending -> retail -> asset.\nRespond ONLY as valid JSON.",
        'compact': "Supply chain analyst. Output ONLY the JSON citing real weather/commodity data.",
        'tpl': '{"signal":"neutral","confidence":55,"reasoning":"supply chain reason citing specific commodity/weather data","keyFactors":["drought alert","commodity move"],"butterflies":["drought -> crop yield -> supply -> food inflation -> consumer -> asset"],"edgeClaims":[{"from":"drought","to":"wheat_supply","direction":"bearish","weight":0.8,"label":"crop stress"}]}',
    },
    'technical': {
        'name': 'Technical Analyst',
        'full': "You are a quantitative technical analyst.\nCompute from OHLCV: trend, estimated RSI, volume confirmation, support/resistance, momentum, volatility.\nAlso use options P/C and short interest as positioning signals.\nRespond ONLY as valid JSON.",
        'compact': "Technical analyst. Output ONLY the JSON from price data analysis.",
        'tpl': '{"signal":"bullish","confidence":60,"reasoning":"price trending up with volume, RSI not overbought","keyFactors":["uptrend","volume confirm","above 20MA"],"butterflies":["breakout -> stops triggered -> momentum acceleration"],"edgeClaims":[]}',
    },
    'geopolitical': {
        'name': 'Geopolitical Risk Analyst',
        'full': "You are a geopolitical risk analyst. Use: conflict alerts, trade policy, sanctions, regulatory actions (SEC/FDA/FTC), diplomatic shifts.\nTrace: conflict -> commodity disruption -> substitute demand -> sector -> asset.\nRespond ONLY as valid JSON.",
        'compact': "Geopolitical analyst. Output ONLY the JSON.",
        'tpl': '{"signal":"neutral","confidence":50,"reasoning":"geopolitical assessment citing specific events","keyFactors":["active conflict","trade policy"],"butterflies":["sanctions -> supply gap -> commodity spike -> inflation -> rate hike -> asset down"],"edgeClaims":[]}',
    },
    'sector': {
        'name': 'Sector Specialist',
        'full': "You are a sector specialist. Use: earnings proximity, EPS/revenue estimates, last surprise, analyst target, insider activity, short interest, M&A news.\nRespond ONLY as valid JSON.",
        'compact': "Sector analyst. Output ONLY the JSON.",
        'tpl': '{"signal":"bullish","confidence":65,"reasoning":"earnings approaching, analyst upgrades, insider buying","keyFactors":["earnings date","analyst target","insider buy"],"butterflies":["beat estimates -> analyst upgrades -> index inclusion -> fund buying"],"edgeClaims":[]}',
    },
    'social_sentiment': {
        'name': 'Social Intelligence Agent',
        'full': "You are a social media intelligence specialist.\nAnalyze Reddit (with manip scores), StockTwits (native sentiment), X/Twitter.\nManip scoring: 0-30=genuine; 30-60=biased; 60+=coordination attempt.\nIf >40% posts flagged AND all same direction -> pump -> FADE the signal.\nCross-platform consensus is strongest signal.\nRespond ONLY as valid JSON.",
        'compact': "Social media analyst. Output ONLY the JSON.",
        'tpl': '{"signal":"neutral","confidence":45,"reasoning":"mixed signals, some manipulation flagged","keyFactors":["reddit trend","stocktwits ratio"],"butterflies":["retail conviction -> momentum -> squeeze setup"],"manipulationNote":"low risk - mostly organic","edgeClaims":[]}',
    },
}

ROLE_KEYS = list(ROLES.keys())
_ctr = 0
def assign_role(agent):
    global _ctr
    if agent.role in ROLES: return agent.role
    r = ROLE_KEYS[_ctr % len(ROLE_KEYS)]; _ctr += 1; return r

SYNTH_FULL = """You are the Master Graph Synthesizer — Phase 2.
Phase 1 is complete. Every specialist agent independently analyzed ALL real-time world data:
price/OHLCV, options, insider trades, analyst ratings, earnings, 20 news feeds, central banks,
weather for 12 regions, 30 commodities, shipping BDI, social from Reddit/StockTwits/X,
geopolitical alerts, regulatory, ESG, labor, consumer — plus any uploaded research files.

You now read the COMPLETE assembled graph. Your mandate:
- Weight by confidence AND data quality
- Follow ALL butterfly chains to conclusion
- Note manipulation attempts (they themselves predict short-term moves)
- Explain conflicts — do NOT average them away
- Your summary must be comprehensive

Output ONLY valid JSON:
{"upProbability":0-100,"downProbability":0-100,"neutralProbability":0-100,"primaryDirection":"up|down|sideways","expectedMagnitude":"small(<1%)|moderate(1-3%)|large(>3%)","confidence":0-100,"bullCase":"3-4 sentences citing specific data","bearCase":"3-4 sentences citing specific data","keyRisks":["r1","r2","r3","r4"],"topCatalysts":["c1","c2","c3"],"topButterflyEffects":["chain1 step-by-step","chain2","chain3"],"socialAssessment":"2-3 sentences","worldStateHighlights":"2-3 sentences on weather/commodity/geo","signalConflicts":"where agents disagreed and why","technicalPicture":"price action summary","fundamentalPicture":"earnings/analyst/insider summary","summary":"6-8 sentence comprehensive executive summary"}"""

SYNTH_COMPACT = "You are a financial analyst synthesizing agent signals. Output ONLY valid JSON."
SYNTH_TPL = '{"upProbability":60,"downProbability":30,"neutralProbability":10,"primaryDirection":"up","expectedMagnitude":"moderate(1-3%)","confidence":65,"bullCase":"bull thesis","bearCase":"bear thesis","keyRisks":["r1","r2","r3"],"topCatalysts":["c1","c2"],"topButterflyEffects":["chain1","chain2"],"socialAssessment":"social summary","worldStateHighlights":"key world signals","signalConflicts":"disagreements","technicalPicture":"price action","fundamentalPicture":"fundamentals","summary":"comprehensive summary"}'

SUPER_SYSTEM = "You are the Super Synthesizer — Phase 3. Reconcile multiple synthesizer verdicts into one definitive prediction. Where they agree: high confidence. Where they disagree: adjudicate based on evidence. Output ONLY valid JSON with same schema as synthesizer."

def run_agent(agent, context: str, graph: SharedGraph) -> dict:
    role = assign_role(agent)
    rc   = ROLES[role]
    small = is_small_model(agent.provider, agent.model)
    sys  = rc['compact'] if small else rc['full']
    user = (f"Asset: {graph.asset.get('symbol')} ({graph.asset.get('asset_name','')})\n"
            f"Date: {time.strftime('%Y-%m-%d',time.gmtime())}\n\n"
            f"DATA:\n{context[:2500] if small else context}\n\n"
            f"Your role: {rc['name']}\n\n"
            f"Output ONLY this JSON with your real analysis:\n{rc['tpl']}")

    raw=None; parsed=None
    for attempt in range(2):
        try:
            raw = call_llm(agent, sys, user if attempt==0 else
                          f"Analyze {graph.asset.get('symbol')} for tomorrow. Output ONLY:\n{rc['tpl']}")
            parsed = extract_json(raw)
            if parsed: break
        except Exception as e:
            log.warning(f'{agent.name} attempt {attempt+1}: {e}')

    out = safe_output(parsed, raw or '')
    nid = f"{role}_{agent.agent_id}"

    graph.add_node(GNode(id=nid, type='specialist', label=rc['name'], category=role,
                         weight=out['confidence']/100, agent_id=agent.agent_id, agent_name=agent.name,
                         data={'signal':out['signal'],'confidence':out['confidence'],
                               'reasoning':out['reasoning'],'key_factors':out['keyFactors'],
                               'butterflies':out['butterflies']}))
    graph.add_edge(GEdge(id=f'root_{nid}',source='root',target=nid,label=rc['name'],
                         weight=out['confidence']/100,direction=out['signal'],type='root_link'))

    for i, claim in enumerate(out.get('edgeClaims',[])):
        if not claim.get('from') or not claim.get('to'): continue
        fid = f"c_{claim['from'].replace(' ','_').lower()[:35]}"
        tid = f"c_{claim['to'].replace(' ','_').lower()[:35]}"
        for cid,clabel in [(fid,claim['from']),(tid,claim['to'])]:
            if cid not in graph.nodes:
                graph.add_node(GNode(id=cid,type='concept',label=clabel,category='concept',
                                     weight=float(claim.get('weight',0.5))))
        graph.add_edge(GEdge(id=f'e_{nid}_{i}',source=fid,target=tid,
                             label=claim.get('label',''),weight=float(claim.get('weight',0.5)),
                             direction=claim.get('direction','neutral'),type='causal'))

    graph.add_signal(Signal(agent_id=agent.agent_id,agent_name=agent.name,role=role,
                            role_name=rc['name'],signal=out['signal'],confidence=out['confidence'],
                            reasoning=out['reasoning'],key_factors=out['keyFactors'],
                            butterflies=out['butterflies']))

    log.info(f"{agent.name}({role}): {out['signal']} @{out['confidence']}%")
    return {'role':role,'role_name':rc['name'],'agent_id':agent.agent_id,'agent_name':agent.name,'node_id':nid,**out}

def run_synthesizer(agent, graph: SharedGraph) -> dict:
    small=is_small_model(agent.provider,agent.model)
    s=graph.stats; t=s['total_agents'] or 1
    user=(f"Graph for {graph.asset.get('symbol')}:\n{graph.to_synth_input()}\n\nOutput ONLY JSON:\n{SYNTH_TPL}"
          if small else
          f"Read this complete intelligence graph and produce your final prediction.\n\n{graph.to_synth_input()}\n\nOutput ONLY the JSON.")
    raw=None; parsed=None
    for attempt in range(2):
        try:
            raw=call_llm(agent,SYNTH_COMPACT if small else SYNTH_FULL,user if attempt==0 else
                         f"Synthesize: {s['bull']}B/{s['bear']}Be/{s['neut']}N from {t} agents for {graph.asset.get('symbol')}.\nOutput ONLY:\n{SYNTH_TPL}")
            parsed=extract_json(raw)
            if parsed: break
        except Exception as e:
            log.warning(f'Synthesizer {agent.name} attempt {attempt+1}: {e}')
    if not parsed:
        parsed={'upProbability':round(s['bull']/t*100),'downProbability':round(s['bear']/t*100),
                'neutralProbability':round(s['neut']/t*100),'primaryDirection':'up' if s['bull']>s['bear'] else 'down' if s['bear']>s['bull'] else 'sideways',
                'expectedMagnitude':'small(<1%)','confidence':30,'bullCase':f"{s['bull']}/{t} bullish.",
                'bearCase':f"{s['bear']}/{t} bearish.",'keyRisks':['Synthesizer LLM failed'],
                'topCatalysts':[],'topButterflyEffects':[],'socialAssessment':'N/A',
                'worldStateHighlights':'N/A','signalConflicts':'N/A','technicalPicture':'N/A',
                'fundamentalPicture':'N/A','summary':f'Fallback: {s["bull"]}B/{s["bear"]}Be/{s["neut"]}N from {t} agents.','_fallback':True}
    up=max(0,int(parsed.get('upProbability',0)))
    dn=max(0,int(parsed.get('downProbability',0)))
    sd=max(0,int(parsed.get('neutralProbability',0)))
    tot=(up+dn+sd) or 100
    parsed['upProbability']=round(up/tot*100)
    parsed['downProbability']=round(dn/tot*100)
    parsed['neutralProbability']=100-parsed['upProbability']-parsed['downProbability']
    return {'agent_id':agent.agent_id,'agent_name':agent.name,**parsed,'ts':time.time()}

def run_super_synthesizer(agent, synth_outputs: list) -> dict:
    text='\n\n---\n\n'.join(
        f"SYNTH {i+1} ({s.get('agent_name','?')}):\n"
        f"  {s.get('primaryDirection')} up={s.get('upProbability')}% dn={s.get('downProbability')}% conf={s.get('confidence')}%\n"
        f"  Bull: {s.get('bullCase','')}\n  Bear: {s.get('bearCase','')}"
        for i,s in enumerate(synth_outputs))
    raw=None; parsed=None
    try:
        raw=call_llm(agent,SUPER_SYSTEM,f"Reconcile {len(synth_outputs)} verdicts:\n\n{text}\n\nOutput ONLY:\n{SYNTH_TPL}")
        parsed=extract_json(raw)
    except Exception as e:
        log.warning(f'Super synth failed: {e}')
    if not parsed: return synth_outputs[0]
    up=max(0,int(parsed.get('upProbability',0)))
    dn=max(0,int(parsed.get('downProbability',0)))
    sd=max(0,int(parsed.get('neutralProbability',0)))
    tot=(up+dn+sd) or 100
    parsed['upProbability']=round(up/tot*100)
    parsed['downProbability']=round(dn/tot*100)
    parsed['neutralProbability']=100-parsed['upProbability']-parsed['downProbability']
    return {'agent_id':agent.agent_id,'agent_name':f'SuperSynth({agent.name})','is_super':True,**parsed,'ts':time.time()}
