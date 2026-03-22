const { v4: uuidv4 } = require('uuid');
const { fetchPrice, fetchHistory, fetchMacroContext } = require('../services/market');
const { runAgentWriteToGraph, runGraphSynthesizer } = require('../agents/runner');
const { SharedGraph } = require('../agents/graph');
const { saveAnalysis } = require('../services/storage');

// Max parallel LLM calls at once — prevents rate limit hammering
const CONCURRENCY = 5;

/**
 * Run tasks with a concurrency limit
 */
async function runConcurrent(tasks, limit) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (err) {
        results[idx] = { status: 'rejected', reason: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * THE TWO-PHASE ANALYSIS PIPELINE
 *
 * PHASE 1: Every enabled agent independently reads market data and writes
 *          its analysis into the SharedGraph. No agent sees another's output.
 *          Supports unlimited agents — they all run concurrently (batched).
 *
 * PHASE 2: One synthesizer agent receives the complete assembled graph as
 *          its ONLY input and produces the final probabilistic verdict.
 *
 * @param {Object} asset         - { symbol, name, assetType, alphaVantageKey }
 * @param {Array}  agents        - all configured agents from storage
 * @param {Function} onProgress  - callback(step, total, message)
 */
async function runFullAnalysis(asset, agents, onProgress = () => {}) {
  const analysisId = uuidv4();
  const startTime = Date.now();

  const enabledAgents = agents.filter(a => a.enabled !== false);
  if (enabledAgents.length === 0) throw new Error('No enabled agents. Add at least one agent in the Agents tab.');

  // Separate synthesizers from specialists
  // If an agent has role "synthesizer" it is reserved for Phase 2
  const synthAgents  = enabledAgents.filter(a => a.role === 'synthesizer');
  const writingAgents = enabledAgents.filter(a => a.role !== 'synthesizer');

  // If no dedicated synthesizer, use the highest-confidence specialist (last resort: first agent)
  const synthAgent = synthAgents[0] || enabledAgents[0];

  // If all agents are synthesizers, they also write (edge case)
  const phase1Agents = writingAgents.length > 0 ? writingAgents : enabledAgents;

  const totalSteps = 3 + phase1Agents.length + 2; // fetch(3) + agents + build_graph + synthesize

  // ── STEP 1–3: Fetch market data ──────────────────────────────────
  onProgress(1, totalSteps, 'Fetching current price...');
  const price = await fetchPrice(asset.symbol, asset.alphaVantageKey).catch(() => null);

  onProgress(2, totalSteps, 'Fetching price history...');
  const history = await fetchHistory(asset.symbol, 30, asset.alphaVantageKey).catch(() => []);

  onProgress(3, totalSteps, 'Fetching news and macro context...');
  const { assetNews, globalNews } = await fetchMacroContext(asset.symbol).catch(() => ({ assetNews: [], globalNews: [] }));
  const allNews = [...(assetNews || []), ...(globalNews || [])];

  // ── PHASE 1: All agents write to the shared graph ────────────────
  const graph = new SharedGraph(asset);
  let step = 4;
  const agentOutputs = [];

  const tasks = phase1Agents.map((agent, idx) => async () => {
    onProgress(step + idx, totalSteps, `[Phase 1] Agent "${agent.name}" writing to graph... (${idx + 1}/${phase1Agents.length})`);
    return runAgentWriteToGraph(agent, asset, price, history, allNews, graph);
  });

  const results = await runConcurrent(tasks, CONCURRENCY);

  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      agentOutputs.push(r.value);
    } else {
      // Even failed agents get a stub node in the graph
      const agent = phase1Agents[idx];
      const stubSignal = { signal: 'neutral', confidence: 0, reasoning: `Agent failed: ${r.reason?.message || 'unknown error'}`, keyFactors: [], butterflies: [], error: true };
      graph.addSignal({ agentId: agent.id, agentName: agent.name, role: agent.role || 'specialist', roleName: agent.name, ...stubSignal });
      agentOutputs.push({ agentId: agent.id, agentName: agent.name, ...stubSignal });
    }
  });

  step += phase1Agents.length;

  // ── Graph assembled ──────────────────────────────────────────────
  onProgress(step++, totalSteps, `Graph assembled: ${graph.nodes.size} nodes, ${graph.edges.size} edges from ${agentOutputs.length} agents`);

  // ── PHASE 2: Synthesizer reads the graph ─────────────────────────
  onProgress(step++, totalSteps, `[Phase 2] Synthesizer "${synthAgent.name}" reading complete graph...`);

  let synthesis;
  try {
    synthesis = await runGraphSynthesizer(synthAgent, asset, graph);
  } catch (err) {
    // Hard fallback from graph stats
    const stats = graph.toFlowFormat().stats;
    const t = stats.totalAgents || 1;
    synthesis = {
      upProbability: Math.round((stats.bull / t) * 100),
      downProbability: Math.round((stats.bear / t) * 100),
      neutralProbability: Math.round((stats.neut / t) * 100),
      primaryDirection: stats.bull > stats.bear ? 'up' : stats.bear > stats.bull ? 'down' : 'sideways',
      confidence: 30,
      bullCase: `${stats.bull}/${t} agents bullish.`,
      bearCase: `${stats.bear}/${t} agents bearish.`,
      keyRisks: ['Synthesizer failed — vote aggregation used'],
      topCatalysts: [],
      topButterflyEffects: [],
      signalConflicts: 'N/A',
      summary: `Synthesizer failed. Raw vote: ${stats.bull}B/${stats.bear}Be/${stats.neut}N from ${t} agents.`,
      fallback: true,
      error: err.message,
    };
  }

  // ── Assemble final result ─────────────────────────────────────────
  const flowGraph = graph.toFlowFormat();

  const analysis = {
    id: analysisId,
    asset,
    price,
    // Phase 1 outputs — what each agent contributed
    agentOutputs,
    // The assembled graph (for visualization)
    graph: flowGraph,
    // Phase 2 output — the synthesizer's verdict
    synthesis,
    // Meta
    stats: {
      totalAgents: phase1Agents.length,
      totalNodes: flowGraph.stats.totalNodes,
      totalEdges: flowGraph.stats.totalEdges,
      bull: flowGraph.stats.bull,
      bear: flowGraph.stats.bear,
      neut: flowGraph.stats.neut,
      synthAgent: synthAgent.name,
    },
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  await saveAnalysis(analysis);
  return analysis;
}

module.exports = { runFullAnalysis };
