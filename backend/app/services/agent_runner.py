"""
Agent Runner — Phase 1 specialist agents write to SharedGraph.

Each role has two prompt variants:
  system_full    — for capable models (GPT-4o, Claude Sonnet, Groq 70B, Gemini Pro)
  system_compact — for small/free models (Pollinations Mistral-7B, HuggingFace Zephyr)

The compact variant uses a fill-in-the-blank JSON template approach that works
reliably with small models instead of asking them to generate JSON from scratch.
"""
import time
from typing import Optional
from ..services.llm_client import call_llm, extract_json, safe_output, is_small_model
from ..services.graph_builder import SharedGraph, GraphNode, GraphEdge, SignalVote
from ..utils.logger import get_logger

logger = get_logger('assetflow.services.runner')

# ─── ROLE DEFINITIONS ────────────────────────────────────────────────────────

ROLES = {
    'macro': {
        'name': 'Macro Economist',
        'system_full': (
            "You are a senior macro economist predicting next-day asset price direction.\n"
            "Analyze: interest rates, inflation, GDP, central bank guidance, yield curves, currency flows, sovereign debt.\n"
            "Use ALL data provided. Trace butterfly effects — 2nd and 3rd order ripples dominate.\n"
            "Example: BLS weak jobs → consumer spending cut → retail earnings lower → sector pressure → asset down.\n"
            "Respond ONLY with valid JSON. No prose before or after the JSON object."
        ),
        'system_compact': "You are a macro analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis.",
        'json_template': '{"signal":"bullish","confidence":65,"reasoning":"your 1-2 sentence macro reason","keyFactors":["rate move","inflation data"],"butterflies":["rates rise -> USD up -> EM selloff -> risk-off -> asset down"],"edgeClaims":[{"from":"interest_rates","to":"asset_price","direction":"bearish","weight":0.7,"label":"rate hike pressure"}]}',
    },
    'sentiment': {
        'name': 'Sentiment & Social Analyst',
        'system_full': (
            "You are a market sentiment and behavioral finance specialist.\n"
            "Use: news narratives, social media data (with manipulation scores), options put/call ratios, insider transactions, short interest.\n"
            "Key rule: a flagged manipulation attempt (high manip score) is ITSELF a signal — someone wants price to move.\n"
            "High put/call ratio (>1.2) = bearish. Net insider buying = bullish. Cross-platform social consensus = stronger.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a sentiment analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis.",
        'json_template': '{"signal":"bullish","confidence":60,"reasoning":"your 1-2 sentence sentiment reason","keyFactors":["social buzz","options flow"],"butterflies":["narrative shift -> retail FOMO -> momentum buy -> price spike"],"manipulationNote":"low manipulation risk detected","edgeClaims":[]}',
    },
    'supply_chain': {
        'name': 'Supply Chain & Commodities Analyst',
        'system_full': (
            "You are a global supply chain and commodities specialist.\n"
            "Use: weather alerts for ALL 12 regions, ALL 25+ commodity price moves, shipping news, Baltic Dry Index, agricultural reports.\n"
            "MANDATE: Find the most indirect causal chain from actual data. Nothing is too small.\n"
            "Rain in Brazil → delayed soy harvest → feed grain shortage → livestock costs rise → protein prices up → food inflation → consumer spending cuts → retail pressure → asset.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a supply chain analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis based on the weather/commodity data.",
        'json_template': '{"signal":"neutral","confidence":55,"reasoning":"your 1-2 sentence supply chain reason citing real data","keyFactors":["commodity move","weather alert"],"butterflies":["drought in wheat belt -> supply drop -> food prices rise -> inflation -> rate pressure -> asset down"],"edgeClaims":[{"from":"drought","to":"wheat_supply","direction":"bearish","weight":0.8,"label":"crop stress"}]}',
    },
    'technical': {
        'name': 'Technical & Quantitative Analyst',
        'system_full': (
            "You are a quantitative technical analyst.\n"
            "Compute from OHLCV data: trend direction, estimated RSI, volume confirmation, support/resistance proximity, momentum, recent volatility.\n"
            "Also use: options put/call ratio as positioning signal, short interest as squeeze potential.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a technical analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis from the price data.",
        'json_template': '{"signal":"bullish","confidence":60,"reasoning":"price is trending up with volume confirmation, RSI not overbought","keyFactors":["uptrend","volume rising","above 20-day avg"],"butterflies":["breakout above resistance -> momentum traders pile in -> stops triggered -> acceleration"],"edgeClaims":[]}',
    },
    'geopolitical': {
        'name': 'Geopolitical Risk Analyst',
        'system_full': (
            "You are a geopolitical risk and policy analyst.\n"
            "Use: conflict alerts, UN/ReliefWeb news, trade policy, sanctions, regulatory actions (SEC/FDA/FTC), diplomatic shifts.\n"
            "Trace butterfly chains: conflict → commodity disruption → substitute demand → sector rotation → asset price.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a geopolitical analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis.",
        'json_template': '{"signal":"neutral","confidence":50,"reasoning":"your 1-2 sentence geopolitical assessment","keyFactors":["active conflict","trade policy"],"butterflies":["sanctions -> supply disruption -> commodity price spike -> inflation -> rate hike -> asset down"],"edgeClaims":[]}',
    },
    'sector': {
        'name': 'Sector & Industry Specialist',
        'system_full': (
            "You are a sector and competitive dynamics specialist.\n"
            "Use: earnings date proximity, EPS/revenue estimates, last surprise, analyst consensus and target price, insider buy/sell, short interest, M&A news, regulatory pipeline for the sector.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a sector analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis.",
        'json_template': '{"signal":"bullish","confidence":65,"reasoning":"earnings approaching with positive estimates and analyst upgrades","keyFactors":["earnings date","analyst target","insider buying"],"butterflies":["earnings beat -> analyst upgrades -> index inclusion -> fund buying -> price acceleration"],"edgeClaims":[]}',
    },
    'social_sentiment': {
        'name': 'Social Intelligence Specialist',
        'system_full': (
            "You are a social media intelligence specialist for financial markets.\n"
            "Analyze Reddit posts (with manipulation scores), StockTwits (with native bullish/bearish counts), X/Twitter.\n"
            "Manipulation scoring: 0-30 = genuine signal; 30-60 = biased but informative; 60+ = coordination attempt.\n"
            "If >40% posts are flagged AND all directional → pump attempt → FADE the signal direction.\n"
            "Cross-platform consensus is stronger than single-platform.\n"
            "Respond ONLY with valid JSON. No prose before or after."
        ),
        'system_compact': "You are a social media analyst. Respond ONLY with the JSON object shown. Fill in YOUR analysis.",
        'json_template': '{"signal":"neutral","confidence":45,"reasoning":"mixed social signals, moderate stocktwits bullish lean, some manipulation flagged","keyFactors":["reddit sentiment","stocktwits ratio"],"butterflies":["retail conviction builds -> momentum -> short squeeze setup -> rapid price spike"],"manipulationNote":"low risk - organic posts dominate","edgeClaims":[]}',
    },
}

ROLE_KEYS = list(ROLES.keys())
_role_counter = 0


def assign_role(agent) -> str:
    global _role_counter
    if agent.role in ROLES:
        return agent.role
    role = ROLE_KEYS[_role_counter % len(ROLE_KEYS)]
    _role_counter += 1
    return role


# ─── PHASE 1 AGENT ───────────────────────────────────────────────────────────

def run_agent_write_to_graph(agent, context_text: str, graph: SharedGraph) -> dict:
    """
    Single Phase 1 agent: receives world-state context, analyzes, writes to graph.
    Returns the agent's output dict.
    """
    role = assign_role(agent)
    role_cfg = ROLES[role]
    small = is_small_model(agent.provider, agent.model)

    if small:
        system = role_cfg['system_compact']
        user = (
            f"Asset: {graph.asset.get('symbol')} ({graph.asset.get('name','')})\n"
            f"Date: {time.strftime('%Y-%m-%d', time.gmtime())}\n\n"
            f"MARKET DATA:\n{context_text[:2000]}\n\n"
            f"Your role: {role_cfg['name']}\n\n"
            f"Output ONLY this JSON with your real analysis (replace placeholder values):\n"
            f"{role_cfg['json_template']}"
        )
    else:
        system = role_cfg['system_full']
        user = (
            f"{context_text}\n\n"
            f"Your role: {role_cfg['name']}\n\n"
            f"Analyze all data above. Output ONLY valid JSON:\n"
            f"{role_cfg['json_template']}"
        )

    raw = None
    parsed = None

    # Attempt 1: normal call
    try:
        raw = call_llm(agent, system, user)
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning(f'Agent {agent.name} attempt 1 failed: {e}')

    # Attempt 2: ultra-minimal fallback prompt
    if not parsed:
        try:
            fallback_sys  = 'Output ONLY a JSON object. No other text whatsoever.'
            fallback_user = (
                f"Analyze {graph.asset.get('symbol')} for tomorrow.\n"
                f"Output ONLY this exact JSON structure with your values:\n"
                f'{{"signal":"bullish","confidence":60,"reasoning":"your reason in one sentence",'
                f'"keyFactors":["factor1","factor2"],"butterflies":["indirect effect chain"],"edgeClaims":[]}}'
            )
            raw = call_llm(agent, fallback_sys, fallback_user)
            parsed = extract_json(raw)
        except Exception as e:
            logger.warning(f'Agent {agent.name} attempt 2 failed: {e}')

    output = safe_output(parsed, raw or '')
    node_id = f"{role}_{agent.id}"

    # ── Write to shared graph ─────────────────────────────────────────────
    graph.add_node(GraphNode(
        id=node_id, type='specialist', label=role_cfg['name'], category=role,
        weight=output['confidence'] / 100, agent_id=agent.id, agent_name=agent.name,
        data={
            'signal':      output['signal'],
            'confidence':  output['confidence'],
            'reasoning':   output['reasoning'],
            'key_factors': output['keyFactors'],
            'butterflies': output['butterflies'],
        }
    ))

    graph.add_edge(GraphEdge(
        id=f"root_{node_id}", source='root', target=node_id,
        label=role_cfg['name'], weight=output['confidence'] / 100,
        direction=output['signal'], type='root_link'
    ))

    for i, claim in enumerate(output.get('edgeClaims', [])):
        if not claim.get('from') or not claim.get('to'):
            continue
        from_id = f"c_{claim['from'].replace(' ','_').lower()[:35]}"
        to_id   = f"c_{claim['to'].replace(' ','_').lower()[:35]}"
        if from_id not in graph.nodes:
            graph.add_node(GraphNode(id=from_id, type='concept', label=claim['from'], category='concept',
                                     weight=float(claim.get('weight', 0.5))))
        if to_id not in graph.nodes:
            graph.add_node(GraphNode(id=to_id,   type='concept', label=claim['to'],   category='concept',
                                     weight=float(claim.get('weight', 0.5))))
        graph.add_edge(GraphEdge(
            id=f"claim_{node_id}_{i}", source=from_id, target=to_id,
            label=claim.get('label', ''), weight=float(claim.get('weight', 0.5)),
            direction=claim.get('direction', 'neutral'), type='causal'
        ))

    graph.add_signal(SignalVote(
        agent_id=agent.id, agent_name=agent.name, role=role, role_name=role_cfg['name'],
        signal=output['signal'], confidence=output['confidence'],
        reasoning=output['reasoning'], key_factors=output['keyFactors'],
        butterflies=output['butterflies'],
    ))

    logger.info(f"Agent {agent.name} ({role}): {output['signal']} @ {output['confidence']}%")
    return {'role': role, 'role_name': role_cfg['name'], 'agent_id': agent.id,
            'agent_name': agent.name, 'node_id': node_id, **output}


# ─── PHASE 2 SYNTHESIZER ─────────────────────────────────────────────────────

SYNTH_SYSTEM_FULL = """You are AssetFlow's Master Graph Synthesizer — Phase 2.

Phase 1 is complete. Every specialist agent has independently analyzed ALL real-time world data
(price/OHLCV, options, insider trades, analyst ratings, earnings, 20 news feeds, central banks,
weather for 12 regions, 30 commodities, shipping BDI, agriculture, energy, social media from Reddit/StockTwits/X,
geopolitical alerts, regulatory news, labor, ESG) and written their findings into a shared intelligence graph.

You are reading the COMPLETE assembled graph now. Your mandate:
- Weight by confidence AND data quality (world-state-backed > news-only > social-only)  
- Follow ALL butterfly chains to their conclusion
- Note manipulation attempt signals (the attempt itself predicts short-term price moves)
- Explain signal conflicts — do not average them away
- Your summary must be a LONG COMPREHENSIVE ANALYSIS covering every major signal
- Probabilities must sum to exactly 100

Output ONLY valid JSON:
{"upProbability":0-100,"downProbability":0-100,"neutralProbability":0-100,"primaryDirection":"up|down|sideways","expectedMagnitude":"small(<1%)|moderate(1-3%)|large(>3%)","confidence":0-100,"bullCase":"3-4 sentence bull thesis citing specific graph nodes","bearCase":"3-4 sentence bear thesis citing specific graph nodes","keyRisks":["risk1","risk2","risk3","risk4"],"topCatalysts":["catalyst1","catalyst2","catalyst3"],"topButterflyEffects":["complete chain: cause -> mechanism -> price impact","second chain","third chain"],"socialAssessment":"2-3 sentences on social signals and manipulation","worldStateHighlights":"2-3 sentences on most impactful real-world signals","signalConflicts":"2-3 sentences on disagreements and resolution","technicalPicture":"2-3 sentences on price action","fundamentalPicture":"2-3 sentences on earnings/analysts/insiders","summary":"6-8 sentence comprehensive executive summary covering ALL major themes"}"""

SYNTH_SYSTEM_COMPACT = """You are a financial analyst synthesizing multiple agent signals. Output ONLY valid JSON."""

SYNTH_TEMPLATE = ('{"upProbability":60,"downProbability":30,"neutralProbability":10,'
                  '"primaryDirection":"up","expectedMagnitude":"moderate(1-3%)",'
                  '"confidence":65,"bullCase":"your 2-3 sentence bull thesis",'
                  '"bearCase":"your 2-3 sentence bear thesis",'
                  '"keyRisks":["risk1","risk2","risk3"],'
                  '"topCatalysts":["catalyst1","catalyst2"],'
                  '"topButterflyEffects":["chain1: cause -> effect -> price","chain2"],'
                  '"socialAssessment":"social signal summary",'
                  '"worldStateHighlights":"key real-world signals",'
                  '"signalConflicts":"where agents disagreed",'
                  '"technicalPicture":"price action summary",'
                  '"fundamentalPicture":"fundamentals summary",'
                  '"summary":"your comprehensive 4-6 sentence summary"}')


def run_graph_synthesizer(agent, graph: SharedGraph) -> dict:
    """Phase 2: agent reads complete graph → produces probability verdict."""
    graph_text = graph.to_synthesizer_input()
    small = is_small_model(agent.provider, agent.model)

    if small:
        system = SYNTH_SYSTEM_COMPACT
        user = (
            f"Asset: {graph.asset.get('symbol')}\n"
            f"Agent votes: {graph.stats['bull']} bullish, {graph.stats['bear']} bearish, {graph.stats['neut']} neutral "
            f"out of {graph.stats['total_agents']} agents\n\n"
            f"Graph summary:\n{graph_text[:3000]}\n\n"
            f"Output ONLY this JSON with your synthesis (replace all placeholder values):\n{SYNTH_TEMPLATE}"
        )
    else:
        system = SYNTH_SYSTEM_FULL
        user = f"Read this complete intelligence graph and produce your final prediction.\n\n{graph_text}\n\nRespond with ONLY the JSON object."

    raw = None
    parsed = None

    try:
        raw = call_llm(agent, system, user)
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning(f'Synthesizer {agent.name} attempt 1 failed: {e}')

    if not parsed:
        try:
            raw = call_llm(agent,
                'Output ONLY a JSON object with your financial analysis.',
                f"Synthesize these agent signals for {graph.asset.get('symbol')}:\n"
                f"{graph.stats['bull']} bullish, {graph.stats['bear']} bearish, {graph.stats['neut']} neutral\n\n"
                f"Output ONLY this JSON:\n{SYNTH_TEMPLATE}")
            parsed = extract_json(raw)
        except Exception as e:
            logger.warning(f'Synthesizer {agent.name} attempt 2 failed: {e}')

    if not parsed:
        # Math fallback from vote counts
        s = graph.stats
        t = s['total_agents'] or 1
        parsed = {
            'upProbability':   round(s['bull'] / t * 100),
            'downProbability': round(s['bear'] / t * 100),
            'neutralProbability': round(s['neut'] / t * 100),
            'primaryDirection': 'up' if s['bull'] > s['bear'] else 'down' if s['bear'] > s['bull'] else 'sideways',
            'expectedMagnitude': 'small(<1%)',
            'confidence': 35,
            'bullCase': f"{s['bull']} of {t} agents signaled bullish.",
            'bearCase': f"{s['bear']} of {t} agents signaled bearish.",
            'keyRisks': ['Synthesizer LLM failed — vote aggregation fallback'],
            'topCatalysts': [], 'topButterflyEffects': [],
            'socialAssessment': 'N/A', 'worldStateHighlights': 'N/A',
            'signalConflicts': 'N/A', 'technicalPicture': 'N/A', 'fundamentalPicture': 'N/A',
            'summary': f"Fallback vote: {s['bull']}B/{s['bear']}Be/{s['neut']}N from {t} agents.",
            '_fallback': True,
        }

    # Normalize probabilities
    up = max(0, int(parsed.get('upProbability', 0)))
    dn = max(0, int(parsed.get('downProbability', 0)))
    sd = max(0, int(parsed.get('neutralProbability', 0)))
    total = (up + dn + sd) or 100
    parsed['upProbability']      = round(up / total * 100)
    parsed['downProbability']    = round(dn / total * 100)
    parsed['neutralProbability'] = 100 - parsed['upProbability'] - parsed['downProbability']

    logger.info(f"Synthesizer {agent.name}: {parsed.get('primaryDirection')} "
                f"(up={parsed['upProbability']}% dn={parsed['downProbability']}% conf={parsed.get('confidence')}%)")
    return {'agent_id': agent.id, 'agent_name': agent.name, **parsed, 'timestamp': time.time()}


# ─── PHASE 3 SUPER-SYNTHESIZER ───────────────────────────────────────────────

SUPER_SYNTH_SYSTEM = """You are AssetFlow's Super Synthesizer — Phase 3.
You receive verdicts from multiple independent Phase 2 synthesizers.
Reconcile them into one definitive prediction. Where they agree: high confidence.
Where they disagree: adjudicate based on cited evidence.
Output ONLY valid JSON with the same schema as synthesizer output."""


def run_super_synthesizer(agent, synth_outputs: list) -> dict:
    """Phase 3: reconcile multiple synthesizer verdicts."""
    input_text = '\n\n---\n\n'.join(
        f"SYNTHESIZER {i+1} ({s.get('agent_name','?')}):\n"
        f"  Direction: {s.get('primaryDirection')} | Up: {s.get('upProbability')}% | Down: {s.get('downProbability')}% | Conf: {s.get('confidence')}%\n"
        f"  Bull: {s.get('bullCase','')}\n"
        f"  Bear: {s.get('bearCase','')}\n"
        f"  Butterflies: {' | '.join(s.get('topButterflyEffects',[]))}"
        for i, s in enumerate(synth_outputs)
    )
    user = f"Reconcile {len(synth_outputs)} synthesizer verdicts:\n\n{input_text}\n\nOutput ONLY the JSON verdict:\n{SYNTH_TEMPLATE}"

    raw = None
    parsed = None
    try:
        raw = call_llm(agent, SUPER_SYNTH_SYSTEM, user)
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning(f'Super synthesizer failed: {e}')

    if not parsed:
        return synth_outputs[0]  # Fallback to first synthesizer

    up = max(0, int(parsed.get('upProbability', 0)))
    dn = max(0, int(parsed.get('downProbability', 0)))
    sd = max(0, int(parsed.get('neutralProbability', 0)))
    total = (up + dn + sd) or 100
    parsed['upProbability']      = round(up / total * 100)
    parsed['downProbability']    = round(dn / total * 100)
    parsed['neutralProbability'] = 100 - parsed['upProbability'] - parsed['downProbability']

    return {'agent_id': agent.id, 'agent_name': f"SuperSynth({agent.name})",
            'is_super_synth': True, **parsed, 'timestamp': time.time()}
