const { callLLM } = require('../services/llm');

/**
 * The 6 built-in analytical roles.
 * Any number of agents can be added — they all write to the shared graph.
 * If an agent has role "specialist", it gets round-robin assigned a built-in role.
 */
const AGENT_ROLES = {
  macro: {
    name: 'Macro Economist',
    category: 'macro',
    systemPrompt: `You are a macro economist analyzing global economic conditions for asset price prediction.
Focus on: interest rates, inflation, GDP growth, central bank forward guidance, currency dynamics, sovereign debt stress.
CRITICAL: trace butterfly effects — find the non-obvious 2nd and 3rd order ripples.
Example: Fed holds rates → USD strengthens → EM debt stress rises → capital flight → commodity demand drops → energy sector weakens.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["indirect ripple 1", "indirect ripple 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
  sentiment: {
    name: 'Sentiment Analyst',
    category: 'sentiment',
    systemPrompt: `You are a market sentiment and behavioral finance specialist.
Analyze: news narrative momentum, fear/greed cycles, retail vs institutional divergence, media framing, social contagion effects.
Butterfly: how a narrative shift creates reflexive price action that then changes the fundamentals.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["reflexivity loop 1", "narrative cascade 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
  supply_chain: {
    name: 'Supply Chain Analyst',
    category: 'supply_chain',
    systemPrompt: `You are a global supply chain and commodity flow specialist.
Track: raw material shortages, port congestion, weather disruptions, harvest failures, shipping rate spikes.
CRITICAL butterfly instruction: find the most indirect causal chain you can construct from current events.
Example: Indian fishermen catch less fish → higher fish prices → consumers substitute to chicken → poultry demand spikes →
more feed grain needed → corn/soy prices rise → biofuel economics shift → energy sector affected.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["supply chain cascade 1", "commodity ripple 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
  technical: {
    name: 'Technical Analyst',
    category: 'technical',
    systemPrompt: `You are a quantitative technical and price action analyst.
Analyze OHLCV history: trend direction, moving average crosses, RSI, volume confirmation, support/resistance proximity, momentum.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["technical cascade 1", "positioning ripple 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
  geopolitical: {
    name: 'Geopolitical Risk Analyst',
    category: 'geopolitical',
    systemPrompt: `You are a geopolitical risk and policy analyst for financial markets.
Assess: active conflicts, sanctions, elections, trade wars, tariff changes, diplomatic shifts.
Butterfly: how a distant political event creates unexpected market dislocations.
Example: South American election → new mining policy → lithium supply outlook changes → EV battery costs shift → auto sector margins affected.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["political ripple 1", "policy cascade 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
  sector: {
    name: 'Sector Specialist',
    category: 'sector',
    systemPrompt: `You are an industry and competitive dynamics specialist.
Analyze: earnings trends, margin pressure, competitive moat shifts, regulatory pipeline, product cycle position, M&A activity.
Find butterfly effects: how a competitor move, regulatory signal, or technology shift creates cascading repricing.
Respond ONLY in this exact JSON (no other text):
{
  "signal": "bullish|bearish|neutral",
  "confidence": 0-100,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "butterflies": ["sector ripple 1", "competitive cascade 2"],
  "edgeClaims": [{"from": "concept_a", "to": "concept_b", "direction": "bullish|bearish|neutral", "weight": 0.0-1.0, "label": "causal link description"}]
}`,
  },
};

const ROLE_KEYS = Object.keys(AGENT_ROLES);
let _roleCounter = 0;

function assignRole(agent) {
  if (AGENT_ROLES[agent.role]) return agent.role;
  return ROLE_KEYS[_roleCounter++ % ROLE_KEYS.length];
}

function buildMarketContext(asset, price, history, news) {
  const priceStr = price
    ? `$${price.price?.toFixed(4)} (${price.changePercent >= 0 ? '+' : ''}${price.changePercent?.toFixed(2)}% today)`
    : 'unavailable — use news context only';

  const histStr = (history || []).slice(0, 14).map(h =>
    `${h.date} C=${h.close?.toFixed(2)} H=${h.high?.toFixed(2)} L=${h.low?.toFixed(2)} V=${h.volume?.toLocaleString()}`
  ).join('\n');

  const newsStr = (news || []).slice(0, 15).map(n =>
    `[${n.source}] ${n.title}${n.summary ? ' — ' + n.summary.slice(0, 100) : ''}`
  ).join('\n');

  return `ASSET: ${asset.symbol} (${asset.name || asset.symbol}) [${asset.assetType || 'equity'}]
CURRENT PRICE: ${priceStr}

PRICE HISTORY (recent, most recent first):
${histStr || 'No history available'}

RECENT NEWS & EVENTS:
${newsStr || 'No news available'}

TODAY: ${new Date().toISOString().split('T')[0]}
PREDICTION TARGET: Direction of ${asset.symbol} NEXT TRADING DAY`;
}

/**
 * PHASE 1 — One agent writes its analysis into the shared graph.
 * Every enabled agent calls this. They all write independently.
 * No agent sees another agent's output during Phase 1.
 */
async function runAgentWriteToGraph(agentConfig, asset, price, history, news, graph) {
  const role = assignRole(agentConfig);
  const roleConfig = AGENT_ROLES[role];
  const marketContext = buildMarketContext(asset, price, history, news);

  const userPrompt = `${marketContext}\n\nYour role: ${roleConfig.name}\nAnalyze and respond with ONLY the JSON object.`;

  let parsed;
  try {
    const raw = await callLLM(agentConfig, roleConfig.systemPrompt, userPrompt);
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch (_) {
    parsed = null;
  }

  // Guarantee valid shape regardless of LLM output quality
  if (!parsed || typeof parsed !== 'object') {
    parsed = { signal: 'neutral', confidence: 20, reasoning: 'Agent returned unparseable output.', keyFactors: [], butterflies: [], edgeClaims: [] };
  }
  parsed.signal = ['bullish', 'bearish', 'neutral'].includes(parsed.signal) ? parsed.signal : 'neutral';
  parsed.confidence = Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0));
  parsed.keyFactors = Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [];
  parsed.butterflies = Array.isArray(parsed.butterflies) ? parsed.butterflies : [];
  parsed.edgeClaims = Array.isArray(parsed.edgeClaims) ? parsed.edgeClaims : [];

  const nodeId = `${role}_${agentConfig.id}`;

  // ── WRITE TO SHARED GRAPH ──────────────────────────────────────
  // 1. Agent's own analytical node
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
    },
  });

  // 2. Root → agent edge
  graph.addEdge({
    id: `root_${nodeId}`,
    source: 'root',
    target: nodeId,
    label: roleConfig.name,
    weight: parsed.confidence / 100,
    direction: parsed.signal,
    type: 'root_link',
  });

  // 3. Causal concept nodes and edges the agent identified
  (parsed.edgeClaims || []).forEach((claim, i) => {
    if (!claim.from || !claim.to) return;
    const fromId = `concept_${claim.from.replace(/\s+/g, '_').toLowerCase().slice(0, 40)}`;
    const toId = `concept_${claim.to.replace(/\s+/g, '_').toLowerCase().slice(0, 40)}`;

    if (!graph.nodes.has(fromId)) {
      graph.addNode({ id: fromId, type: 'concept', label: claim.from, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    }
    if (!graph.nodes.has(toId)) {
      graph.addNode({ id: toId, type: 'concept', label: claim.to, category: 'concept', weight: parseFloat(claim.weight) || 0.5 });
    }
    graph.addEdge({
      id: `claim_${nodeId}_${i}`,
      source: fromId,
      target: toId,
      label: claim.label || '',
      weight: Math.min(1, Math.max(0, parseFloat(claim.weight) || 0.5)),
      direction: claim.direction || 'neutral',
      type: 'causal',
    });
    graph.addEdge({
      id: `agt_ref_${nodeId}_${i}`,
      source: nodeId,
      target: fromId,
      label: 'identified',
      weight: 0.4,
      direction: 'neutral',
      type: 'reference',
    });
  });

  // 4. Signal vote
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
  // ─────────────────────────────────────────────────────────────

  return { role, roleName: roleConfig.name, agentId: agentConfig.id, agentName: agentConfig.name, nodeId, ...parsed };
}

/**
 * PHASE 2 — The graph synthesizer.
 * Receives the ENTIRE assembled graph as its only input.
 * Never saw individual agent prompts or other agents' raw outputs.
 */
const SYNTHESIZER_SYSTEM = `You are AssetFlow's Chief Graph Analyst — Phase 2 of a two-phase multi-agent system.

In Phase 1, every analyst agent independently wrote their analysis into a shared intelligence graph.
You are now reading that complete graph and producing the final probabilistic prediction.

Your job:
- Read every node, every signal vote, every causal edge claim
- Weight signals by confidence score
- Identify consensus clusters AND dissenting minority views (minority views can be more important)
- Follow the butterfly effect chains — indirect causes often dominate direct ones
- Explain signal conflicts explicitly — do not average them away
- Probabilities must sum to exactly 100

Respond ONLY in this exact JSON (no markdown, no preamble, no trailing text):
{
  "upProbability": 0-100,
  "downProbability": 0-100,
  "neutralProbability": 0-100,
  "primaryDirection": "up|down|sideways",
  "expectedMagnitude": "small(<1%)|moderate(1-3%)|large(>3%)",
  "confidence": 0-100,
  "bullCase": "2-3 sentence bull thesis citing specific agents or graph nodes",
  "bearCase": "2-3 sentence bear thesis citing specific agents or graph nodes",
  "keyRisks": ["risk1", "risk2", "risk3"],
  "topCatalysts": ["catalyst1", "catalyst2", "catalyst3"],
  "topButterflyEffects": ["most important indirect causal chain 1", "chain 2"],
  "signalConflicts": "1-2 sentences on where agents disagreed and why this matters",
  "summary": "3-4 sentence executive summary of the entire graph"
}`;

async function runGraphSynthesizer(agentConfig, asset, graph) {
  const graphInput = graph.toSynthesizerInput();
  const userPrompt = `Read this complete intelligence graph and produce your final prediction.\n\n${graphInput}\n\nRespond with ONLY the JSON object now.`;

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
      keyRisks: ['Synthesizer LLM failed — using vote aggregation fallback'],
      topCatalysts: [],
      topButterflyEffects: [],
      signalConflicts: 'Synthesizer unavailable.',
      summary: `Fallback vote tally: ${stats.bull}B / ${stats.bear}Be / ${stats.neut}N from ${t} agents.`,
      fallback: true,
    };
  }

  // Normalize to 100
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
