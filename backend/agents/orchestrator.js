const { v4: uuidv4 } = require('uuid');
const { buildWorldState, serializeForAgent } = require('../services/data');
const { runAgentWriteToGraph, runGraphSynthesizer, runSuperSynthesizer } = require('../agents/runner');
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

async function runFullAnalysis(asset, agents, onProgress = () => {}) {
  const id = uuidv4();
  const t0 = Date.now();

  const enabled = agents.filter(a => a.enabled !== false);
  if (!enabled.length) throw new Error('No enabled agents. Add at least one in the Agents tab.');

  // Separate by role
  const superSynths  = enabled.filter(a => a.role === 'super_synthesizer');
  const synths       = enabled.filter(a => a.role === 'synthesizer');
  const specialists  = enabled.filter(a => a.role !== 'synthesizer' && a.role !== 'super_synthesizer');

  // Fallbacks: if no specialist, use all; if no synth, reuse first specialist
  const phase1Agents = specialists.length > 0 ? specialists : enabled;
  const synthAgents  = synths.length > 0 ? synths : (specialists.length > 0 ? [specialists[0]] : [enabled[0]]);
  const superAgent   = superSynths[0] || null;

  const totalSteps = 4 + phase1Agents.length + synthAgents.length + (superAgent ? 1 : 0) + 1;
  let step = 1;

  // ── STEP 1: Fetch ALL world data in parallel ──────────────────────
  onProgress(step++, totalSteps, 'Fetching all world data (price, news, weather, commodities, social, regulatory...)');
  const worldState = await buildWorldState(asset.symbol, asset.alphaVantageKey).catch(() => null);

  // ── STEP 2: Build per-role context strings (once) ─────────────────
  onProgress(step++, totalSteps, `World data ready. Building agent contexts...`);
  const roleContextCache = {};
  const getContext = (role) => {
    if (!roleContextCache[role]) roleContextCache[role] = serializeForAgent(worldState, role);
    return roleContextCache[role];
  };

  // ── PHASE 1: All specialists write to shared graph ────────────────
  const graph = new SharedGraph(asset);
  const agentOutputs = [];
  onProgress(step, totalSteps, `[Phase 1] Starting ${phase1Agents.length} specialist agents...`);

  const tasks = phase1Agents.map((agent, idx) => async () => {
    const role = agent.role === 'synthesizer' || agent.role === 'super_synthesizer' ? 'macro' : (agent.role || 'specialist');
    const contextText = getContext(role);
    onProgress(step + idx, totalSteps, `[Phase 1] ${agent.name} (${role}) writing to graph... (${idx + 1}/${phase1Agents.length})`);
    return runAgentWriteToGraph(agent, contextText, graph);
  });

  const results = await runConcurrent(tasks, CONCURRENCY);
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      agentOutputs.push(r.value);
    } else {
      const agent = phase1Agents[idx];
      const stub = { signal: 'neutral', confidence: 0, reasoning: `Failed: ${r.reason?.message || 'unknown'}`, keyFactors: [], butterflies: [], error: true };
      graph.addSignal({ agentId: agent.id, agentName: agent.name, role: 'specialist', roleName: agent.name, ...stub });
      agentOutputs.push({ agentId: agent.id, agentName: agent.name, roleName: agent.name, ...stub });
    }
  });

  step += phase1Agents.length;

  // Graph assembled
  const flowGraph = graph.toFlowFormat();
  onProgress(step++, totalSteps, `[Graph] ${flowGraph.stats.totalNodes} nodes | ${flowGraph.stats.totalEdges} edges | ${flowGraph.stats.bull}B/${flowGraph.stats.bear}Be/${flowGraph.stats.neut}N`);

  // ── PHASE 2: Synthesizers read the graph ─────────────────────────
  const synthResults = [];
  for (const synthAgent of synthAgents) {
    onProgress(step++, totalSteps, `[Phase 2] Synthesizer "${synthAgent.name}" reading complete graph...`);
    try {
      const result = await runGraphSynthesizer(synthAgent, graph);
      synthResults.push(result);
    } catch (err) {
      const s = flowGraph.stats;
      const t = s.totalAgents || 1;
      synthResults.push({
        agentId: synthAgent.id, agentName: synthAgent.name,
        upProbability: Math.round(s.bull / t * 100), downProbability: Math.round(s.bear / t * 100),
        neutralProbability: Math.round(s.neut / t * 100),
        primaryDirection: s.bull > s.bear ? 'up' : s.bear > s.bull ? 'down' : 'sideways',
        confidence: 30, bullCase: 'Synthesizer failed.', bearCase: 'Synthesizer failed.',
        keyRisks: [], topCatalysts: [], topButterflyEffects: [],
        socialAssessment: 'N/A', worldStateHighlights: 'N/A', signalConflicts: 'N/A',
        technicalPicture: 'N/A', fundamentalPicture: 'N/A',
        summary: `Fallback from vote count.`, fallback: true, error: err.message
      });
    }
  }

  // ── PHASE 3 (optional): Super Synthesizer reconciles all synths ───
  let finalSynthesis;
  if (superAgent && synthResults.length > 0) {
    onProgress(step++, totalSteps, `[Phase 3] Super Synthesizer "${superAgent.name}" reconciling ${synthResults.length} synthesis verdicts...`);
    try {
      finalSynthesis = await runSuperSynthesizer(superAgent, synthResults);
    } catch (_) {
      finalSynthesis = synthResults[0];
    }
  } else if (synthResults.length > 1) {
    // Multiple synthesizers but no super-synth: average their probabilities
    const up = Math.round(synthResults.reduce((s, r) => s + r.upProbability, 0) / synthResults.length);
    const dn = Math.round(synthResults.reduce((s, r) => s + r.downProbability, 0) / synthResults.length);
    finalSynthesis = { ...synthResults[0], upProbability: up, downProbability: dn, neutralProbability: 100 - up - dn, mergedFrom: synthResults.length };
  } else {
    finalSynthesis = synthResults[0];
  }

  const analysis = {
    id, asset,
    price: worldState?.price || null,
    agentOutputs,
    synthesizerOutputs: synthResults,
    synthesis: finalSynthesis,
    graph: flowGraph,
    dataSnapshot: {
      fetchedAt: worldState?.fetchedAt,
      weatherAlerts: (worldState?.weather || []).filter(w => w.significant).map(w => ({ region: w.region, importance: w.importance, alerts: w.alerts })),
      commodities: (worldState?.commodities || []).slice(0, 10),
      shippingBDI: worldState?.shippingData?.bdi || null,
      optionsSummary: worldState?.optionsSummary || null,
      socialStats: worldState?.social?.stats || null,
      analystRatings: worldState?.analystRatings || null,
      earningsData: worldState?.earningsData || null,
    },
    stats: {
      phase1Agents: phase1Agents.length, synthAgents: synthAgents.length,
      superSynthUsed: !!superAgent,
      totalNodes: flowGraph.stats.totalNodes, totalEdges: flowGraph.stats.totalEdges,
      bull: flowGraph.stats.bull, bear: flowGraph.stats.bear, neut: flowGraph.stats.neut,
      dataSources: worldState ? '25+ categories' : 'partial',
      socialPostsTotal: worldState?.social?.stats?.total || 0,
      socialPostsSuspicious: worldState?.social?.stats?.suspicious || 0,
      weatherAlertsCount: (worldState?.weather || []).filter(w => w.significant).length,
    },
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - t0
  };

  await saveAnalysis(analysis);
  return analysis;
}

module.exports = { runFullAnalysis };
