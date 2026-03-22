const { callLLM } = require('../services/llm');

const ROLES = {
  macro: {
    name: 'Macro Economist',
    prompt: `You are a senior macro economist. You have access to the COMPLETE world state: price data, OHLCV history, central bank communications, GDP/inflation/jobs data, yield curves, currency movements, sovereign debt signals.
USE EVERY DATA POINT. If the 10Y yield moved, trace it. If the IMF issued a warning, assess it. If BLS released jobs data, factor it.
BUTTERFLY EFFECT MANDATE: Trace every signal to its 2nd and 3rd order effect on this specific asset.
Example: BLS shows weak jobs -> consumer spending forecast lowered -> retail revenue estimates cut -> if asset is retail-exposed -> bearish.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences citing SPECIFIC data points from world state","keyFactors":["specific factor with data","..."],"butterflies":["step-by-step chain: X -> Y -> Z -> asset impact","..."],"edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  sentiment: {
    name: 'Sentiment & Social Analyst',
    prompt: `You are a market sentiment and behavioral finance expert. You have FULL access to: social media signals from Reddit/X/StockTwits/HackerNews (with manipulation scores), news narrative analysis, analyst ratings, options put/call ratios, insider transactions, and short interest data.
SOCIAL MEDIA RULES:
- Clean posts (manipScore<40): credible crowd signal, weight fully
- Flagged posts (manipScore>=40): potential pump/dump - the ATTEMPT is itself a signal (someone wants price to move)
- Cross-platform agreement is stronger than single-platform
- StockTwits native sentiment (when available) is reliable
- High put/call ratio (>1.2) = institutional hedging = bearish
- Insider buying (net buys > sells) = strong bullish signal
USE EVERY SOCIAL AND SENTIMENT DATA POINT.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences citing specific social data, options data, insider data","keyFactors":["..."],"butterflies":["narrative cascade chain","..."],"manipulationNote":"assessment of any coordination attempts detected","edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  supply_chain: {
    name: 'Supply Chain & Commodities Analyst',
    prompt: `You are a global supply chain specialist. You have access to: weather forecasts for 12 agricultural/energy regions, 30 commodity prices, shipping data (Baltic Dry Index), agriculture reports (USDA/FAO), energy reports (EIA), port/shipping news, and trade flow data.
CRITICAL: Use EVERY weather alert, EVERY commodity price movement. Nothing is too small.
BUTTERFLY CHAINS — find the most indirect causal path you can construct from REAL data:
If rain is forecast in Brazil: trace soy harvest -> feed costs -> livestock -> protein prices -> food inflation -> consumer spending -> specific sector -> asset.
If Baltic Dry is rising: trace shipping demand -> import costs -> inventory -> margins -> sector.
If copper is up: trace construction demand -> economic activity -> industrial output -> employment -> spending -> asset.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences citing SPECIFIC weather/commodity/shipping data","keyFactors":["real data point","..."],"butterflies":["step-by-step chain from real data: event -> mechanism -> mechanism -> asset","..."],"edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  technical: {
    name: 'Technical & Quantitative Analyst',
    prompt: `You are a quantitative technical analyst. You have FULL OHLCV history. Compute from the data:
- Price trend direction (last 5, 10, 20 days)
- Estimated RSI (overbought >70, oversold <30)
- Volume trend (increasing = confirming, decreasing = diverging)
- Support/resistance proximity (recent highs/lows)
- Momentum (rate of change)
- Volatility (recent range vs historical range)
- Short interest (if available) as a squeeze potential signal
- Options put/call ratio as a positioning signal
USE ALL AVAILABLE QUANTITATIVE DATA.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences with specific computed metrics from price data","keyFactors":["specific metric: value","..."],"butterflies":["technical cascade: e.g. approaching resistance -> likely pullback -> triggers stop losses -> momentum reversal","..."],"edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  geopolitical: {
    name: 'Geopolitical Risk Analyst',
    prompt: `You are a geopolitical and policy risk analyst. You have access to: conflict alerts (UN/ReliefWeb/ICG), trade policy news (WTO/Reuters), sanctions news, election developments, central bank policy signals, regulatory actions (SEC/CFTC/FDA/FTC), ESG/climate policy, and diplomatic developments.
BUTTERFLY CHAINS from geopolitical events:
Conflict -> commodity disruption -> substitute demand -> sector rotation -> asset
Sanctions -> currency pressure -> EM contagion -> risk-off -> safe haven flows
Regulatory action (FDA approval/rejection) -> sector repricing -> peer valuations
Trade tariff -> supply chain cost -> margin compression -> earnings revision -> asset
USE EVERY GEOPOLITICAL AND REGULATORY DATA POINT.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences citing specific geopolitical events","keyFactors":["specific event","..."],"butterflies":["geopolitical event -> mechanism -> mechanism -> asset impact","..."],"edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  sector: {
    name: 'Sector & Industry Specialist',
    prompt: `You are a sector and competitive dynamics specialist. You have access to: earnings data (EPS/revenue estimates, next earnings date, surprise history), analyst ratings and price targets, insider transactions, corporate news, M&A activity, regulatory pipeline for the sector, tech/innovation news, healthcare/FDA news, labor market conditions, consumer data, and ESG trends.
Connect every available data point to sector dynamics:
Earnings date approaching -> increased volatility
Last quarter surprise positive -> estimates may be conservative -> bullish
Competitor getting FDA approval -> peer repricing
Tech news -> disruption risk or tailwind
USE EVERY CORPORATE AND SECTOR DATA POINT.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences citing earnings, analyst, insider, or sector data","keyFactors":["specific data point","..."],"butterflies":["sector dynamic chain -> asset impact","..."],"edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  },
  social_sentiment: {
    name: 'Social Intelligence Specialist',
    prompt: `You are a social media intelligence specialist for financial markets. Your PRIMARY source is FULL social data: every Reddit post across 10 subreddits, all StockTwits messages with native sentiment, X/Twitter posts, HackerNews discussions.
ANALYSIS FRAMEWORK:
1. Genuine retail conviction vs coordinated pumps
2. Options chatter predicting institutional moves
3. Cross-platform synchronization (same story on multiple platforms = stronger signal)
4. Short squeeze setup discussions being organized
5. Negative sentiment presaging sell-offs
6. Information cascades from credible early posters
MANIPULATION SCORING:
- 0-30: Genuine signal, full weight
- 30-60: Biased but informative, 50% weight
- 60+: Coordination attempt — the ATTEMPT itself signals someone expects price to move
If >40% of posts are flagged AND all directional: high pump probability = FADE the signal direction.
Respond ONLY as this JSON:
{"signal":"bullish|bearish|neutral","confidence":0-100,"reasoning":"3-4 sentences on what social data genuinely indicates","keyFactors":["specific social observation","..."],"butterflies":["social cascade: retail conviction -> momentum -> price action -> fundamental change","..."],"manipulationNote":"specific assessment","edgeClaims":[{"from":"concept","to":"concept","direction":"bullish|bearish|neutral","weight":0.0-1.0,"label":"causal mechanism"}]}`
  }
};

const ROLE_KEYS = Object.keys(ROLES);
let _counter = 0;

function assignRole(agent) {
  if (ROLES[agent.role]) return agent.role;
  return ROLE_KEYS[_counter++ % ROLE_KEYS.length];
}

function parseJSON(raw) {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

function safeOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') return { signal: 'neutral', confidence: 20, reasoning: 'Unparseable output.', keyFactors: [], butterflies: [], edgeClaims: [] };
  return {
    signal: ['bullish', 'bearish', 'neutral'].includes(parsed.signal) ? parsed.signal : 'neutral',
    confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
    reasoning: parsed.reasoning || '',
    keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
    butterflies: Array.isArray(parsed.butterflies) ? parsed.butterflies : [],
    edgeClaims: Array.isArray(parsed.edgeClaims) ? parsed.edgeClaims : [],
    manipulationNote: parsed.manipulationNote || null
  };
}

async function runAgentWriteToGraph(agentConfig, contextText, graph) {
  const role = assignRole(agentConfig);
  const roleConfig = ROLES[role];

  const userPrompt = `${contextText}\n\nYour analytical role: ${roleConfig.name}\n\nAnalyze everything above. Use EVERY data point relevant to your role. Respond with ONLY the JSON object.`;

  let raw;
  try { raw = await callLLM(agentConfig, roleConfig.prompt, userPrompt); } catch (_) { raw = null; }

  const output = safeOutput(parseJSON(raw));
  const nodeId = `${role}_${agentConfig.id}`;

  // Write agent node to graph
  graph.addNode({
    id: nodeId, type: 'specialist', label: roleConfig.name, category: role,
    weight: output.confidence / 100, agentId: agentConfig.id, agentName: agentConfig.name,
    data: { signal: output.signal, confidence: output.confidence, reasoning: output.reasoning, keyFactors: output.keyFactors, butterflies: output.butterflies }
  });

  // Root -> agent edge
  graph.addEdge({ id: `root_${nodeId}`, source: 'root', target: nodeId, label: roleConfig.name, weight: output.confidence / 100, direction: output.signal, type: 'root_link' });

  // Causal concept edges
  output.edgeClaims.forEach((claim, i) => {
    if (!claim.from || !claim.to) return;
    const fId = `c_${claim.from.replace(/\W+/g, '_').toLowerCase().slice(0, 35)}`;
    const tId = `c_${claim.to.replace(/\W+/g, '_').toLowerCase().slice(0, 35)}`;
    if (!graph.nodes.has(fId)) graph.addNode({ id: fId, type: 'concept', label: claim.from, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    if (!graph.nodes.has(tId)) graph.addNode({ id: tId, type: 'concept', label: claim.to, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    graph.addEdge({ id: `e_${nodeId}_${i}`, source: fId, target: tId, label: claim.label || '', weight: Math.min(1, Math.max(0, parseFloat(claim.weight) || 0.5)), direction: claim.direction || 'neutral', type: 'causal' });
    graph.addEdge({ id: `ref_${nodeId}_${i}`, source: nodeId, target: fId, label: 'identified', weight: 0.3, direction: 'neutral', type: 'reference' });
  });

  graph.addSignal({ agentId: agentConfig.id, agentName: agentConfig.name, role, roleName: roleConfig.name, signal: output.signal, confidence: output.confidence, reasoning: output.reasoning, keyFactors: output.keyFactors, butterflies: output.butterflies });

  return { role, roleName: roleConfig.name, agentId: agentConfig.id, agentName: agentConfig.name, nodeId, ...output };
}

// ─── SYNTHESIZER ─────────────────────────────────────────────────────────────

const SYNTH_PROMPT = `You are AssetFlow's Master Graph Synthesizer — Phase 2 of a multi-agent intelligence system.

Phase 1 is complete: every specialist agent has independently analyzed ALL available real-time data about the asset and written their findings into a shared intelligence graph. The agents had access to: price/OHLCV history, options data, insider transactions, short interest, analyst ratings, earnings forecasts, 20+ RSS financial news feeds, central bank communications, weather forecasts for 12 global regions, 30 commodity prices, Baltic Dry shipping index, agricultural/energy/regulatory/labor/consumer/ESG news, social media from Reddit/X/StockTwits/HackerNews (with manipulation scoring), geopolitical conflict alerts, and more.

You are reading the COMPLETE assembled graph now.

YOUR MANDATE:
- Read every node, every vote, every causal edge chain
- Weight by confidence AND data backing (world-state-backed > news-only > social-only)
- Follow all butterfly chains to their conclusion
- Identify consensus AND contrarian minority views (contrarians are often more predictive)
- Note detected manipulation attempts and what they imply
- Explain every signal conflict — do not average conflicts away, EXPLAIN them
- Your summary must be a LONG DETAILED ANALYSIS covering every important signal
- Probabilities must sum to exactly 100

Respond ONLY as this JSON (no markdown, no preamble):
{
  "upProbability": 0-100,
  "downProbability": 0-100,
  "neutralProbability": 0-100,
  "primaryDirection": "up|down|sideways",
  "expectedMagnitude": "small(<1%)|moderate(1-3%)|large(>3%)",
  "confidence": 0-100,
  "bullCase": "3-4 sentence comprehensive bull thesis citing specific data from the graph",
  "bearCase": "3-4 sentence comprehensive bear thesis citing specific data from the graph",
  "keyRisks": ["detailed risk 1","detailed risk 2","detailed risk 3","detailed risk 4"],
  "topCatalysts": ["specific catalyst 1","catalyst 2","catalyst 3","catalyst 4"],
  "topButterflyEffects": ["complete chain: cause -> mechanism -> mechanism -> price impact","second chain","third chain"],
  "socialAssessment": "2-3 sentences on social signals and any manipulation attempts",
  "worldStateHighlights": "2-3 sentences on most impactful real-world signals (weather/commodity/geopolitical/macro)",
  "signalConflicts": "2-3 sentences on where agents disagreed, why, and which view you weight more",
  "technicalPicture": "2-3 sentences on price action, momentum, key levels",
  "fundamentalPicture": "2-3 sentences on earnings, analysts, insiders, valuations",
  "summary": "6-8 sentence comprehensive executive summary covering ALL major themes from the graph analysis"
}`;

async function runGraphSynthesizer(agentConfig, graph) {
  const graphText = graph.toSynthesizerInput();
  const userPrompt = `${graphText}\n\nRead this complete graph and produce your comprehensive final prediction. Respond with ONLY the JSON object.`;

  let raw;
  try { raw = await callLLM(agentConfig, SYNTH_PROMPT, userPrompt); } catch (_) { raw = null; }

  const parsed = parseJSON(raw);
  if (!parsed) {
    const s = graph.toFlowFormat().stats;
    const t = s.totalAgents || 1;
    return {
      upProbability: Math.round(s.bull / t * 100),
      downProbability: Math.round(s.bear / t * 100),
      neutralProbability: Math.round(s.neut / t * 100),
      primaryDirection: s.bull > s.bear ? 'up' : s.bear > s.bull ? 'down' : 'sideways',
      confidence: 30,
      bullCase: `${s.bull}/${t} agents bullish.`, bearCase: `${s.bear}/${t} agents bearish.`,
      keyRisks: ['Synthesizer failed — vote aggregation fallback'], topCatalysts: [],
      topButterflyEffects: [], socialAssessment: 'N/A', worldStateHighlights: 'N/A',
      signalConflicts: 'N/A', technicalPicture: 'N/A', fundamentalPicture: 'N/A',
      summary: `Fallback: ${s.bull}B/${s.bear}Be/${s.neut}N from ${t} agents. Synthesizer LLM failed.`,
      fallback: true
    };
  }

  const up = Math.max(0, parseInt(parsed.upProbability) || 0);
  const dn = Math.max(0, parseInt(parsed.downProbability) || 0);
  const sd = Math.max(0, parseInt(parsed.neutralProbability) || 0);
  const tot = (up + dn + sd) || 100;
  parsed.upProbability = Math.round(up / tot * 100);
  parsed.downProbability = Math.round(dn / tot * 100);
  parsed.neutralProbability = 100 - parsed.upProbability - parsed.downProbability;

  return { agentId: agentConfig.id, agentName: agentConfig.name, ...parsed, timestamp: Date.now() };
}

// ─── MULTI-SYNTHESIZER SUPPORT ────────────────────────────────────────────────

const SUPER_SYNTH_PROMPT = `You are AssetFlow's Super Synthesizer — you receive outputs from multiple independent synthesizer agents, each of which has already read the complete intelligence graph.

Your job: reconcile multiple synthesis verdicts into one definitive final prediction.
- Where synthesizers agree: high confidence signal
- Where they disagree: explain the conflict, adjudicate based on the evidence they cited, and explain your reasoning
- The final probability verdict is your own independent assessment based on all synthesizer inputs
- Your summary should be the most comprehensive, actionable analysis possible

Respond ONLY as this JSON:
{
  "upProbability": 0-100,
  "downProbability": 0-100,
  "neutralProbability": 0-100,
  "primaryDirection": "up|down|sideways",
  "expectedMagnitude": "small(<1%)|moderate(1-3%)|large(>3%)",
  "confidence": 0-100,
  "bullCase": "comprehensive 4-5 sentence bull thesis",
  "bearCase": "comprehensive 4-5 sentence bear thesis",
  "keyRisks": ["risk1","risk2","risk3","risk4"],
  "topCatalysts": ["catalyst1","catalyst2","catalyst3","catalyst4"],
  "topButterflyEffects": ["complete chain 1","chain 2","chain 3"],
  "synthesizerAgreement": "2-3 sentences on where synthesizers agreed vs disagreed",
  "socialAssessment": "social signals summary",
  "worldStateHighlights": "key world state signals",
  "signalConflicts": "all conflicts and how you resolved them",
  "technicalPicture": "technical analysis summary",
  "fundamentalPicture": "fundamental analysis summary",
  "summary": "8-10 sentence definitive comprehensive executive summary"
}`;

async function runSuperSynthesizer(agentConfig, synthOutputs) {
  const inputText = synthOutputs.map((s, i) =>
    `SYNTHESIZER ${i + 1} (${s.agentName}):\n  Direction: ${s.primaryDirection} | Up: ${s.upProbability}% | Down: ${s.downProbability}% | Confidence: ${s.confidence}%\n  Bull: ${s.bullCase}\n  Bear: ${s.bearCase}\n  Butterfly: ${(s.topButterflyEffects || []).join(' | ')}\n  Conflicts: ${s.signalConflicts}`
  ).join('\n\n---\n\n');

  const userPrompt = `You have received ${synthOutputs.length} independent synthesis verdicts from agents that each read the complete intelligence graph.\n\n${inputText}\n\nReconcile these into the final definitive prediction. Respond with ONLY the JSON object.`;

  let raw;
  try { raw = await callLLM(agentConfig, SUPER_SYNTH_PROMPT, userPrompt); } catch (_) { raw = null; }

  const parsed = parseJSON(raw);
  if (!parsed) return synthOutputs[0]; // fallback to first synthesizer

  const up = Math.max(0, parseInt(parsed.upProbability) || 0);
  const dn = Math.max(0, parseInt(parsed.downProbability) || 0);
  const sd = Math.max(0, parseInt(parsed.neutralProbability) || 0);
  const tot = (up + dn + sd) || 100;
  parsed.upProbability = Math.round(up / tot * 100);
  parsed.downProbability = Math.round(dn / tot * 100);
  parsed.neutralProbability = 100 - parsed.upProbability - parsed.downProbability;

  return { agentId: agentConfig.id, agentName: `SuperSynth(${agentConfig.name})`, ...parsed, isSuperSynth: true, timestamp: Date.now() };
}

module.exports = { runAgentWriteToGraph, runGraphSynthesizer, runSuperSynthesizer, ROLES, assignRole };
