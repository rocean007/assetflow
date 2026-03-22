const { callLLM } = require('../services/llm');

// ─── AGENT ROLES ────────────────────────────────────────────────────────────
// 7 built-in roles. Agents with role "specialist" are round-robin assigned.
// Any number of agents can be added — all write to the shared graph in Phase 1.

const AGENT_ROLES = {
  macro: {
    name: 'Macro Economist',
    category: 'macro',
    systemPrompt: `You are a macro economist analyzing global economic conditions for asset price prediction.
Focus on: interest rates, inflation, GDP, central bank guidance, currency dynamics, sovereign debt, yield curves.
You have access to real-time world state data including weather alerts, commodity prices, shipping indices, and economic calendars.
CRITICAL: trace butterfly effects — 2nd and 3rd order ripples are often more predictive than direct signals.
Example chain: drought in Ukraine wheat belt (in world state weather) -> global wheat supply drops -> food inflation rises ->
EM central banks forced to hike -> EM equities sell off -> risk-off rotation -> USD strengthens -> US exporters hurt.
When you see a weather alert or commodity move in the world state, TRACE IT FORWARD to the asset.
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences citing specific data from world state or news",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["indirect chain 1 traced step by step", "indirect chain 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  sentiment: {
    name: 'Sentiment Analyst',
    category: 'sentiment',
    systemPrompt: `You are a market sentiment and behavioral finance specialist.
You have access to SOCIAL MEDIA data from Reddit, X (Twitter), StockTwits, and HackerNews — already filtered for manipulation.
Analyze: news narrative momentum, fear/greed cycles, retail vs institutional divergence, social media crowd behavior.
IMPORTANT SOCIAL MEDIA RULES:
- Clean posts (manipulation score <40%) are credible crowd signals
- Suspicious posts should be noted as potential manipulation attempts, which itself is a signal (someone is trying to move the price)
- Cross-platform consensus is stronger than single-platform signals
- StockTwits native sentiment counts are reliable if sample size > 20
- High WSB engagement with low manipulation score = genuine retail conviction
- High WSB engagement with HIGH manipulation score = pump attempt, likely bearish for credibility
Butterfly: how narrative shifts create reflexive price action that then alters fundamentals.
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences citing social data and narrative analysis",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["reflexivity loop 1", "narrative cascade 2"],
  "manipulationAssessment": "brief note on whether you detected pump/dump attempts",
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  social_sentiment: {
    name: 'Social Intelligence Agent',
    category: 'social',
    systemPrompt: `You are a social media intelligence specialist for financial markets.
Your PRIMARY data source is social media signals — Reddit, X/Twitter, StockTwits, HackerNews.
You are an expert at detecting:
1. Genuine retail conviction vs coordinated pump schemes
2. Information cascades (one credible post going viral)
3. Options activity chatter that predicts institutional moves
4. Short squeeze setups being organized on social platforms
5. Negative sentiment that presages sell-offs
6. Cross-platform narrative synchronization (same story breaking on multiple platforms simultaneously)

MANIPULATION DETECTION FRAMEWORK:
- Score 0-30: Genuine organic signal, weight fully
- Score 30-60: Potentially biased but informative, weight 50%
- Score 60+: Likely coordinated, note as manipulation attempt (the ATTEMPT itself is a signal — someone wants the price to move)
- If >30% of posts are suspicious AND all in same direction = high pump probability = fade the signal

Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences on what the social data genuinely tells you",
  "keyFactors": ["social factor 1", "social factor 2"],
  "butterflies": ["social cascade that could affect price", "manipulation attempt impact"],
  "manipulationAssessment": "specific assessment of manipulation risk and what it means for the signal",
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  supply_chain: {
    name: 'Supply Chain Analyst',
    category: 'supply_chain',
    systemPrompt: `You are a global supply chain and commodity flow specialist.
You have access to real-time world state: weather alerts in agricultural regions, commodity price movements, shipping indices, agricultural reports.
CRITICAL BUTTERFLY INSTRUCTION: Find the most indirect causal chain you can construct from the ACTUAL world state data provided.
Do not use hypothetical examples — use REAL signals from the world state.
If weather shows heavy rain in Brazil: trace soy harvest impact -> feed costs -> livestock -> protein prices -> consumer spending -> retail sector.
If Baltic Dry Index is moving: trace shipping capacity -> import costs -> inventory levels -> margin compression -> earnings impact.
If corn prices moved significantly: trace biofuel economics -> energy sector -> transportation costs -> inflation expectations.
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences citing specific world state data (weather/commodity/shipping)",
  "keyFactors": ["real world factor from data 1", "real world factor 2", "real world factor 3"],
  "butterflies": ["step-by-step chain from world state signal to asset price", "second chain"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  technical: {
    name: 'Technical Analyst',
    category: 'technical',
    systemPrompt: `You are a quantitative technical and price action analyst.
Analyze the OHLCV price history provided: trend direction, moving average crosses (estimate from data), RSI divergence (estimate from price action), volume confirmation, support/resistance proximity, momentum.
Also factor in current commodity price movements from the world state as they affect asset correlations.
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences on specific price action observations",
  "keyFactors": ["technical factor 1", "technical factor 2", "technical factor 3"],
  "butterflies": ["how current price structure could trigger a cascade", "vol pattern implication"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  geopolitical: {
    name: 'Geopolitical Risk Analyst',
    category: 'geopolitical',
    systemPrompt: `You are a geopolitical risk and policy analyst for financial markets.
You have access to real-time world state: active conflicts, UN/humanitarian alerts, trade policy news, tariff developments, central bank communications.
Assess active conflicts and their supply chain implications. Look for sanctions, trade restrictions, diplomatic shifts.
BUTTERFLY CHAINS FROM GEOPOLITICAL EVENTS — always trace to asset price:
War/conflict -> specific commodity disruption -> substitute demand -> different sector repriced
Election outcome -> policy change -> regulatory environment -> sector valuation -> asset price
Sanctions -> currency pressure -> EM contagion -> risk-off -> developed market safe haven flows
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences citing specific events from world state conflicts/trade news",
  "keyFactors": ["geopolitical factor 1", "factor 2", "factor 3"],
  "butterflies": ["geopolitical event -> chain -> asset impact 1", "chain 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },

  sector: {
    name: 'Sector Specialist',
    category: 'sector',
    systemPrompt: `You are an industry and competitive dynamics specialist.
Analyze: earnings cycle position, margin pressure from commodity/energy costs (use world state data), competitive moat shifts, regulatory pipeline, M&A signals.
The world state energy prices and commodity movements directly affect sector margins — use them.
Respond ONLY in this exact JSON:
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences on sector-specific dynamics",
  "keyFactors": ["sector factor 1", "factor 2", "factor 3"],
  "butterflies": ["sector ripple that creates unexpected asset impact 1", "ripple 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal description"}]
}`
  },
};

const ROLE_KEYS = Object.keys(AGENT_ROLES);
let _roleCounter = 0;

function assignRole(agent) {
  if (AGENT_ROLES[agent.role]) return agent.role;
  return ROLE_KEYS[_roleCounter++ % ROLE_KEYS.length];
}

// ─── CONTEXT BUILDER ────────────────────────────────────────────────────────

/**
 * Build the full omniscient prompt context for a single agent.
 * Injects: price, history, financial news, world state (weather/commodities/conflicts/etc), social media.
 */
function buildMarketContext(asset, price, history, news, worldStateText, socialData, role) {
  const priceStr = price
    ? `$${price.price?.toFixed(4)} (${price.changePercent >= 0 ? '+' : ''}${price.changePercent?.toFixed(2)}% today, vol ${price.volume?.toLocaleString()})`
    : 'unavailable';

  const histStr = (history || []).slice(0, 14).map(h =>
    `${h.date} C=${h.close?.toFixed(2)} H=${h.high?.toFixed(2)} L=${h.low?.toFixed(2)} V=${h.volume?.toLocaleString()}`
  ).join('\n');

  const newsStr = (news || []).slice(0, 15).map(n =>
    `[${n.source}] ${n.title}${n.summary ? ' -- ' + n.summary.slice(0, 100) : ''}`
  ).join('\n');

  // Social section: full detail for sentiment/social agents, brief stats for others
  let socialSection = '';
  if (socialData) {
    const isSocialRole = role === 'sentiment' || role === 'social_sentiment';
    if (isSocialRole && socialData.summary) {
      socialSection = `
SOCIAL MEDIA DATA (manipulation-scored and filtered):
${socialData.summary}
Stats: ${socialData.stats?.clean || 0} credible | ${socialData.stats?.suspicious || 0} flagged
Platforms: Reddit=${socialData.stats?.byPlatform?.reddit || 0} X=${socialData.stats?.byPlatform?.x || 0} StockTwits=${socialData.stats?.byPlatform?.stocktwits || 0} HN=${socialData.stats?.byPlatform?.hackernews || 0}
${socialData.stats?.stocktwitsSentiment ? `StockTwits native: ${socialData.stats.stocktwitsSentiment.bullish}B / ${socialData.stats.stocktwitsSentiment.bearish}Be of ${socialData.stats.stocktwitsSentiment.total}` : ''}
RULE: Weight clean social at 10-20% vs fundamentals unless exceptional cross-platform consensus.`;
    } else if (socialData.stats) {
      socialSection = `
SOCIAL SNAPSHOT: ${socialData.stats.clean} credible posts, ${socialData.stats.suspicious} flagged posts across Reddit/X/StockTwits/HN.`;
    }
  }

  return `ASSET: ${asset.symbol} (${asset.name || asset.symbol}) [${asset.assetType || 'equity'}]
CURRENT PRICE: ${priceStr}

PRICE HISTORY (most recent first):
${histStr || 'No history available'}

FINANCIAL NEWS (last 24-48h):
${newsStr || 'No news available'}
${socialSection}
${worldStateText ? '\n' + worldStateText : ''}

TODAY: ${new Date().toISOString().split('T')[0]}
PREDICTION TARGET: Direction of ${asset.symbol} NEXT TRADING DAY`;
}

// ─── PHASE 1: AGENT WRITES TO GRAPH ─────────────────────────────────────────

async function runAgentWriteToGraph(agentConfig, asset, price, history, news, graph, worldStateText, socialData) {
  const role = assignRole(agentConfig);
  const roleConfig = AGENT_ROLES[role];

  const context = buildMarketContext(asset, price, history, news, worldStateText || '', socialData || null, role);
  const userPrompt = `${context}\n\nYour role: ${roleConfig.name}\nAnalyze and respond with ONLY the JSON object.`;

  let parsed;
  try {
    const raw = await callLLM(agentConfig, roleConfig.systemPrompt, userPrompt);
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch (_) {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    parsed = { signal: 'neutral', confidence: 20, reasoning: 'Agent returned unparseable output.', keyFactors: [], butterflies: [], edgeClaims: [] };
  }

  parsed.signal = ['bullish', 'bearish', 'neutral'].includes(parsed.signal) ? parsed.signal : 'neutral';
  parsed.confidence = Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0));
  parsed.keyFactors = Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [];
  parsed.butterflies = Array.isArray(parsed.butterflies) ? parsed.butterflies : [];
  parsed.edgeClaims = Array.isArray(parsed.edgeClaims) ? parsed.edgeClaims : [];

  const nodeId = `${role}_${agentConfig.id}`;

  // Write to shared graph
  graph.addNode({
    id: nodeId,
    type: 'specialist',
    label: roleConfig.name,
    category: role,
    weight: parsed.confidence / 100,
    agentId: agentConfig.id,
    agentName: agentConfig.name,
    data: {
      signal: parsed.signal,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning || '',
      keyFactors: parsed.keyFactors,
      butterflies: parsed.butterflies,
      manipulationAssessment: parsed.manipulationAssessment || null,
    },
  });

  graph.addEdge({
    id: `root_${nodeId}`,
    source: 'root',
    target: nodeId,
    label: roleConfig.name,
    weight: parsed.confidence / 100,
    direction: parsed.signal,
    type: 'root_link',
  });

  (parsed.edgeClaims || []).forEach((claim, i) => {
    if (!claim.from || !claim.to) return;
    const fromId = `concept_${claim.from.replace(/\s+/g, '_').toLowerCase().slice(0, 40)}`;
    const toId = `concept_${claim.to.replace(/\s+/g, '_').toLowerCase().slice(0, 40)}`;
    if (!graph.nodes.has(fromId)) graph.addNode({ id: fromId, type: 'concept', label: claim.from, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    if (!graph.nodes.has(toId)) graph.addNode({ id: toId, type: 'concept', label: claim.to, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    graph.addEdge({ id: `claim_${nodeId}_${i}`, source: fromId, target: toId, label: claim.label || '', weight: Math.min(1, Math.max(0, parseFloat(claim.weight) || 0.5)), direction: claim.direction || 'neutral', type: 'causal' });
    graph.addEdge({ id: `agt_ref_${nodeId}_${i}`, source: nodeId, target: fromId, label: 'identified', weight: 0.4, direction: 'neutral', type: 'reference' });
  });

  graph.addSignal({
    agentId: agentConfig.id,
    agentName: agentConfig.name,
    role,
    roleName: roleConfig.name,
    signal: parsed.signal,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning || '',
    keyFactors: parsed.keyFactors,
    butterflies: parsed.butterflies,
  });

  return { role, roleName: roleConfig.name, agentId: agentConfig.id, agentName: agentConfig.name, nodeId, ...parsed };
}

// ─── PHASE 2: GRAPH SYNTHESIZER ──────────────────────────────────────────────

const SYNTHESIZER_SYSTEM = `You are AssetFlow's Chief Graph Analyst — Phase 2 of a two-phase multi-agent system.

In Phase 1, every analyst independently wrote their analysis into a shared intelligence graph using real-time world data:
weather alerts from agricultural regions, live commodity prices, shipping indices, social media signals (with manipulation scoring),
geopolitical conflict feeds, central bank communications, agricultural reports, and economic calendars.

You are now reading that complete assembled graph and producing the final probabilistic prediction.

Your job:
- Read every node, every signal vote, every causal edge claim
- Weight signals by confidence score AND by data quality (world-state-backed > news-only > social-only)
- Identify the most important butterfly effect chains traced by the supply chain and geopolitical agents
- Note where the social sentiment agent flagged manipulation attempts (the attempts themselves predict price direction)
- Identify consensus clusters AND dissenting minority views
- Explain signal conflicts explicitly
- Probabilities must sum to exactly 100

Respond ONLY in this exact JSON:
{
  "upProbability": 0-100,
  "downProbability": 0-100,
  "neutralProbability": 0-100,
  "primaryDirection": "up|down|sideways",
  "expectedMagnitude": "small(<1%)|moderate(1-3%)|large(>3%)",
  "confidence": 0-100,
  "bullCase": "2-3 sentences citing specific agents, world state signals, or causal chains",
  "bearCase": "2-3 sentences citing specific agents, world state signals, or causal chains",
  "keyRisks": ["risk1", "risk2", "risk3"],
  "topCatalysts": ["catalyst1", "catalyst2", "catalyst3"],
  "topButterflyEffects": ["most important indirect causal chain traced step by step", "second chain"],
  "socialSignalAssessment": "1-2 sentences on what social data added or whether manipulation was detected",
  "worldStateHighlights": "1-2 sentences on most impactful real-world signals from weather/commodities/geopolitics",
  "signalConflicts": "1-2 sentences on where agents disagreed and why",
  "summary": "3-4 sentence executive summary of the full graph"
}`;

async function runGraphSynthesizer(agentConfig, asset, graph) {
  const graphInput = graph.toSynthesizerInput();
  const userPrompt = `Read this complete intelligence graph and produce your final prediction.\n\n${graphInput}\n\nRespond with ONLY the JSON object.`;

  let parsed;
  try {
    const raw = await callLLM(agentConfig, SYNTHESIZER_SYSTEM, userPrompt);
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch (_) {
    parsed = null;
  }

  if (!parsed) {
    const stats = graph.toFlowFormat().stats;
    const t = stats.totalAgents || 1;
    parsed = {
      upProbability: Math.round((stats.bull / t) * 100),
      downProbability: Math.round((stats.bear / t) * 100),
      neutralProbability: Math.round((stats.neut / t) * 100),
      primaryDirection: stats.bull > stats.bear ? 'up' : stats.bear > stats.bull ? 'down' : 'sideways',
      confidence: 35,
      bullCase: `${stats.bull} of ${t} agents signaled bullish.`,
      bearCase: `${stats.bear} of ${t} agents signaled bearish.`,
      keyRisks: ['Synthesizer LLM failed -- using vote aggregation fallback'],
      topCatalysts: [], topButterflyEffects: [],
      socialSignalAssessment: 'N/A', worldStateHighlights: 'N/A', signalConflicts: 'N/A',
      summary: `Fallback: ${stats.bull}B/${stats.bear}Be/${stats.neut}N from ${t} agents.`,
      fallback: true,
    };
  }

  const up = Math.max(0, parseInt(parsed.upProbability) || 0);
  const dn = Math.max(0, parseInt(parsed.downProbability) || 0);
  const sd = Math.max(0, parseInt(parsed.neutralProbability) || 0);
  const tot = (up + dn + sd) || 100;
  parsed.upProbability = Math.round((up / tot) * 100);
  parsed.downProbability = Math.round((dn / tot) * 100);
  parsed.neutralProbability = 100 - parsed.upProbability - parsed.downProbability;

  return { agentId: agentConfig.id, agentName: agentConfig.name, ...parsed, timestamp: Date.now() };
}

module.exports = { runAgentWriteToGraph, runGraphSynthesizer, AGENT_ROLES, assignRole };
