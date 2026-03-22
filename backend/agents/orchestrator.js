const { v4: uuidv4 } = require('uuid');
const { fetchPrice, fetchHistory, fetchMacroContext } = require('../services/market');
const { buildWorldState, worldStateToText } = require('../services/worldstate');
const { fetchAllSocial } = require('../services/social');
const { runAgentWriteToGraph, runGraphSynthesizer } = require('../agents/runner');
const { SharedGraph } = require('../agents/graph');
const { saveAnalysis } = require('../services/storage');

const CONCURRENCY = 5;

async function runConcurrent(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      try { results[idx] = { status: 'fulfilled', value: await tasks[idx]() }; }
      catch (err) { results[idx] = { status: 'rejected', reason: err }; }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * THE FULL TWO-PHASE PIPELINE
 *
 * PRE-FETCH (parallel, once):
 *   - Market data: price, OHLCV history, financial news
 *   - World state: weather (8 regions), commodity prices (10), shipping BDI,
 *                  conflicts, agriculture, energy, central banks, trade, economic
 *   - Social data: Reddit (5 subs), X/Nitter, StockTwits, HackerNews
 *                  — each post manipulation-scored before agents see it
 *
 * PHASE 1: All specialist agents run concurrently (up to CONCURRENCY at a time).
 *          Each receives identical market + world + social context.
 *          Each writes independently to the SharedGraph.
 *          No agent sees another agent's output.
 *
 * PHASE 2: One synthesizer receives the complete assembled graph as its only input.
 *          Produces final probability verdict + analysis.
 */
async function runFullAnalysis(asset, agents, onProgress = () => {}) {
  const analysisId = uuidv4();
  const startTime = Date.now();

  const enabledAgents = agents.filter(a => a.enabled !== false);
  if (enabledAgents.length === 0) throw new Error('No enabled agents. Add at least one in the Agents tab.');

  const synthAgents  = enabledAgents.filter(a => a.role === 'synthesizer');
  const writingAgents = enabledAgents.filter(a => a.role !== 'synthesizer');
  const synthAgent   = synthAgents[0] || enabledAgents[0];
  const phase1Agents = writingAgents.length > 0 ? writingAgents : enabledAgents;

  const totalSteps = 7 + phase1Agents.length + 2;

  // ── PRE-FETCH: market data ────────────────────────────────────────
  onProgress(1, totalSteps, 'Fetching current price...');
  const price = await fetchPrice(asset.symbol, asset.alphaVantageKey).catch(() => null);

  onProgress(2, totalSteps, 'Fetching price history...');
  const history = await fetchHistory(asset.symbol, 30, asset.alphaVantageKey).catch(() => []);

  onProgress(3, totalSteps, 'Fetching financial news...');
  const { assetNews, globalNews } = await fetchMacroContext(asset.symbol).catch(() => ({ assetNews: [], globalNews: [] }));
  const allNews = [...(assetNews || []), ...(globalNews || [])];

  // ── PRE-FETCH: world state ────────────────────────────────────────
  onProgress(4, totalSteps, 'Building world state (weather, commodities, conflicts, shipping)...');
  const worldState = await buildWorldState(asset.symbol).catch(() => null);
  const worldStateText = worldState ? worldStateToText(worldState) : '';

  // ── PRE-FETCH: social media ───────────────────────────────────────
  onProgress(5, totalSteps, 'Fetching social media signals (Reddit, X, StockTwits, HackerNews)...');
  const socialData = await fetchAllSocial(asset.symbol).catch(() => null);

  onProgress(6, totalSteps, `Data ready. World: ${worldState ? 'ok' : 'partial'} | Social: ${socialData?.stats?.total || 0} posts (${socialData?.stats?.suspicious || 0} flagged)`);

  // ── PHASE 1: All agents write to shared graph ─────────────────────
  const graph = new SharedGraph(asset);
  const agentOutputs = [];
  let step = 7;

  const tasks = phase1Agents.map((agent, idx) => async () => {
    onProgress(step + idx, totalSteps, `[Phase 1] "${agent.name}" analyzing → graph... (${idx + 1}/${phase1Agents.length})`);
    return runAgentWriteToGraph(agent, asset, price, history, allNews, graph, worldStateText, socialData);
  });

  const results = await runConcurrent(tasks, CONCURRENCY);

  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      agentOutputs.push(r.value);
    } else {
      const agent = phase1Agents[idx];
      const stub = { signal: 'neutral', confidence: 0, reasoning: `Failed: ${r.reason?.message || 'unknown'}`, keyFactors: [], butterflies: [], error: true };
      graph.addSignal({ agentId: agent.id, agentName: agent.name, role: agent.role || 'specialist', roleName: agent.name, ...stub });
      agentOutputs.push({ agentId: agent.id, agentName: agent.name, roleName: agent.name, nodeId: null, ...stub });
    }
  });

  step += phase1Agents.length;

  // ── Graph assembled ───────────────────────────────────────────────
  const flowGraph = graph.toFlowFormat();
  onProgress(step++, totalSteps,
    `[Graph complete] ${flowGraph.stats.totalNodes} nodes | ${flowGraph.stats.totalEdges} edges | ` +
    `${flowGraph.stats.bull}B / ${flowGraph.stats.bear}Be / ${flowGraph.stats.neut}N`);

  // ── PHASE 2: Synthesizer reads the full graph ─────────────────────
  onProgress(step++, totalSteps, `[Phase 2] Synthesizer "${synthAgent.name}" reading complete graph...`);

  let synthesis;
  try {
    synthesis = await runGraphSynthesizer(synthAgent, asset, graph);
  } catch (err) {
    const t = flowGraph.stats.totalAgents || 1;
    synthesis = {
      upProbability: Math.round((flowGraph.stats.bull / t) * 100),
      downProbability: Math.round((flowGraph.stats.bear / t) * 100),
      neutralProbability: Math.round((flowGraph.stats.neut / t) * 100),
      primaryDirection: flowGraph.stats.bull > flowGraph.stats.bear ? 'up' : flowGraph.stats.bear > flowGraph.stats.bull ? 'down' : 'sideways',
      confidence: 30,
      bullCase: `${flowGraph.stats.bull}/${t} agents bullish.`,
      bearCase: `${flowGraph.stats.bear}/${t} agents bearish.`,
      keyRisks: ['Synthesizer failed -- vote aggregation used'],
      topCatalysts: [], topButterflyEffects: [],
      socialSignalAssessment: 'N/A', worldStateHighlights: 'N/A', signalConflicts: 'N/A',
      summary: `Fallback: ${flowGraph.stats.bull}B/${flowGraph.stats.bear}Be/${flowGraph.stats.neut}N from ${t} agents.`,
      fallback: true, error: err.message,
    };
  }

  const analysis = {
    id: analysisId,
    asset,
    price,
    agentOutputs,
    graph: flowGraph,
    synthesis,
    worldState: {
      fetchedAt: worldState?.fetchedAt,
      weatherAlerts: (worldState?.weather || []).filter(w => w.significant).map(w => ({ region: w.region, alerts: w.alerts })),
      commodities: worldState?.commodities || [],
      shippingBDI: worldState?.shipping?.bdi || null,
    },
    social: socialData ? {
      stats: socialData.stats,
      topCleanPosts: (socialData.clean || []).slice(0, 5).map(p => ({ platform: p.platform, title: p.title, score: p.score })),
    } : null,
    stats: {
      totalAgents: phase1Agents.length,
      totalNodes: flowGraph.stats.totalNodes,
      totalEdges: flowGraph.stats.totalEdges,
      bull: flowGraph.stats.bull,
      bear: flowGraph.stats.bear,
      neut: flowGraph.stats.neut,
      synthAgent: synthAgent.name,
      socialPostsTotal: socialData?.stats?.total || 0,
      socialPostsSuspicious: socialData?.stats?.suspicious || 0,
      weatherAlertsCount: (worldState?.weather || []).filter(w => w.significant).length,
    },
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  await saveAnalysis(analysis);
  return analysis;
}

module.exports = { runFullAnalysis };
