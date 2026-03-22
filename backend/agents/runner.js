const { callLLM } = require('../services/llm');
const { fetchPrice, fetchHistory, fetchMacroContext, fetchFinnhubNews, fetchNews } = require('../services/market');

/**
 * Agent role definitions — each agent has a specific analytical lens
 */
const AGENT_ROLES = {
  macro: {
    name: 'Macro Economist',
    systemPrompt: `You are a macro economist analyzing global economic conditions.
Focus on: interest rates, inflation, GDP, central bank policy, currency moves, sovereign debt.
Assess butterfly effects: how macro shifts ripple into asset prices through unexpected second and third-order effects.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["unexpected ripple effects"] }`,
  },
  sentiment: {
    name: 'Sentiment Analyst',
    systemPrompt: `You are a market sentiment and behavioral finance expert.
Analyze news headlines, narratives, fear/greed cycles, retail vs institutional positioning.
Detect narrative shifts, media spin, and crowd psychology effects.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["narrative ripple effects"] }`,
  },
  supply_chain: {
    name: 'Supply Chain Analyst',
    systemPrompt: `You are a global supply chain and commodity specialist.
Track: raw material shortages, shipping disruptions, weather events, geopolitical supply shocks.
Find non-obvious linkages: e.g. low fish catch → more chicken demand → feed grain prices → fertilizer → energy costs.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["supply chain ripple effects"] }`,
  },
  technical: {
    name: 'Technical Analyst',
    systemPrompt: `You are a quantitative technical analyst.
Analyze price patterns, moving averages, RSI, volume anomalies, support/resistance, momentum.
Compute trend signals from historical OHLCV data.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["technical ripple effects"] }`,
  },
  geopolitical: {
    name: 'Geopolitical Risk Analyst',
    systemPrompt: `You are a geopolitical risk analyst for financial markets.
Assess: wars, sanctions, elections, trade policy, tariffs, diplomatic relations.
Map second-order effects of political events on asset prices.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["geopolitical ripple effects"] }`,
  },
  sector: {
    name: 'Sector Specialist',
    systemPrompt: `You are a sector and industry specialist.
Analyze competitive dynamics, earnings trends, regulatory changes, innovation disruption within the asset's sector.
Respond in JSON: { "signal": "bullish|bearish|neutral", "confidence": 0-100, "reasoning": "...", "keyFactors": ["..."], "butterflies": ["sector ripple effects"] }`,
  },
  synthesizer: {
    name: 'Chief Synthesizer',
    systemPrompt: `You are a master analyst synthesizing inputs from multiple specialized agents.
Weigh all signals probabilistically. Account for signal conflict, confidence levels, and recency.
Output a final probabilistic prediction with clear reasoning.
Respond in JSON: {
  "upProbability": 0-100,
  "downProbability": 0-100,
  "neutralProbability": 0-100,
  "expectedMagnitude": "small(<1%) | moderate(1-3%) | large(>3%)",
  "primaryDirection": "up|down|sideways",
  "bullCase": "concise 2-3 sentence bull thesis",
  "bearCase": "concise 2-3 sentence bear thesis",
  "keyRisks": ["..."],
  "topCatalysts": ["..."],
  "confidence": 0-100,
  "summary": "3-4 sentence executive summary"
}`,
  },
};

/**
 * Build context string for an agent
 */
function buildContext(asset, price, history, news, role) {
  const recentHistory = history.slice(0, 10).map(h =>
    `${h.date}: O=${h.open?.toFixed(2)} H=${h.high?.toFixed(2)} L=${h.low?.toFixed(2)} C=${h.close?.toFixed(2)} V=${h.volume?.toLocaleString()}`
  ).join('\n');

  const headlines = news.slice(0, 12).map(n => `[${n.source}] ${n.title}`).join('\n');

  return `
ASSET: ${asset.symbol} (${asset.name || asset.symbol})
CURRENT PRICE: ${price ? `$${price.price?.toFixed(4)} (${price.changePercent?.toFixed(2)}% today)` : 'unavailable'}
ASSET TYPE: ${asset.assetType || 'equity'}

RECENT PRICE HISTORY (last 10 days):
${recentHistory || 'No history available'}

RECENT NEWS (last 24-48h):
${headlines || 'No news available'}

Your role: ${AGENT_ROLES[role]?.name}
Analyze this asset for NEXT DAY price direction probability.
`;
}

/**
 * Run a single specialized agent
 */
async function runSpecialistAgent(agentConfig, asset, price, history, news, role) {
  const roleConfig = AGENT_ROLES[role];
  if (!roleConfig) throw new Error(`Unknown role: ${role}`);

  const context = buildContext(asset, price, history, news, role);

  const raw = await callLLM(agentConfig, roleConfig.systemPrompt, context);

  // Parse JSON from response
  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { signal: 'neutral', confidence: 30, reasoning: raw, keyFactors: [], butterflies: [] };
  } catch (_) {
    parsed = { signal: 'neutral', confidence: 30, reasoning: raw, keyFactors: [], butterflies: [] };
  }

  return {
    role,
    agentName: agentConfig.name,
    agentId: agentConfig.id,
    roleName: roleConfig.name,
    ...parsed,
    timestamp: Date.now(),
  };
}

/**
 * Run the synthesizer agent on all specialist outputs
 */
async function runSynthesizer(agentConfig, asset, agentOutputs) {
  const roleConfig = AGENT_ROLES.synthesizer;

  const inputSummary = agentOutputs.map(o =>
    `[${o.roleName}] Signal: ${o.signal} | Confidence: ${o.confidence}%
Reasoning: ${o.reasoning?.slice(0, 300)}
Key Factors: ${(o.keyFactors || []).join(', ')}
Butterfly Effects: ${(o.butterflies || []).join(', ')}`
  ).join('\n\n---\n\n');

  const userPrompt = `
ASSET: ${asset.symbol} (${asset.name || ''})
ANALYSIS DATE: ${new Date().toISOString().split('T')[0]}
PREDICTION TARGET: Next trading day direction

SPECIALIST AGENT OUTPUTS:
${inputSummary}

Synthesize all inputs into a final probabilistic prediction.`;

  const raw = await callLLM(agentConfig, roleConfig.systemPrompt, userPrompt);

  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  } catch (_) {
    parsed = {};
  }

  return {
    role: 'synthesizer',
    agentName: agentConfig.name,
    agentId: agentConfig.id,
    ...parsed,
    timestamp: Date.now(),
  };
}

/**
 * Build a graph representation of agent outputs
 */
function buildAgentGraph(agentOutputs, synthesis, asset) {
  const nodes = [];
  const edges = [];

  // Asset node
  nodes.push({ id: 'asset', type: 'asset', label: asset.symbol, data: { name: asset.name } });

  // Specialist nodes
  agentOutputs.forEach((output, i) => {
    const nodeId = `agent_${output.role}`;
    nodes.push({
      id: nodeId,
      type: 'specialist',
      label: output.roleName,
      data: output,
    });

    // Edge: asset → specialist
    edges.push({
      id: `e_asset_${nodeId}`,
      source: 'asset',
      target: nodeId,
      weight: output.confidence / 100,
    });

    // Cross-influence edges (high confidence agents influence others)
    if (output.confidence > 70) {
      agentOutputs.forEach((other, j) => {
        if (i !== j && other.confidence < output.confidence) {
          edges.push({
            id: `e_${nodeId}_${other.role}`,
            source: nodeId,
            target: `agent_${other.role}`,
            weight: 0.3,
            type: 'influence',
          });
        }
      });
    }
  });

  // Synthesizer node
  nodes.push({
    id: 'synthesizer',
    type: 'synthesizer',
    label: 'Synthesizer',
    data: synthesis,
  });

  // All specialists → synthesizer
  agentOutputs.forEach(output => {
    edges.push({
      id: `e_agent_synth_${output.role}`,
      source: `agent_${output.role}`,
      target: 'synthesizer',
      weight: output.confidence / 100,
      signal: output.signal,
    });
  });

  return { nodes, edges };
}

module.exports = { runSpecialistAgent, runSynthesizer, buildAgentGraph, AGENT_ROLES };
