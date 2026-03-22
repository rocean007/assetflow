const { v4: uuidv4 } = require('uuid');
const { fetchPrice, fetchHistory, fetchMacroContext } = require('../services/market');
const { runSpecialistAgent, runSynthesizer, buildAgentGraph, AGENT_ROLES } = require('../agents/runner');
const { saveAnalysis } = require('../services/storage');

const SPECIALIST_ROLES = ['macro', 'sentiment', 'supply_chain', 'technical', 'geopolitical', 'sector'];

/**
 * Run a full multi-agent analysis for an asset
 * @param {Object} asset - { symbol, name, assetType }
 * @param {Array} agents - configured agents from storage
 * @param {Function} onProgress - callback(step, total, message)
 */
async function runFullAnalysis(asset, agents, onProgress = () => {}) {
  const analysisId = uuidv4();
  const startTime = Date.now();

  // Separate specialist agents from synthesizers
  // Map configured agents to roles — if not enough agents, reuse available ones round-robin
  const specialistAgents = agents.filter(a => a.role !== 'synthesizer' && a.enabled !== false);
  const synthAgents = agents.filter(a => a.role === 'synthesizer' && a.enabled !== false);

  if (specialistAgents.length === 0) throw new Error('No enabled agents configured');

  const total = SPECIALIST_ROLES.length + 1 + 3; // specialists + synth + data fetching

  // Step 1: Fetch market data
  onProgress(1, total, 'Fetching market data...');
  const [price, history, { assetNews, globalNews }] = await Promise.allSettled([
    fetchPrice(asset.symbol, asset.alphaVantageKey),
    fetchHistory(asset.symbol, 30, asset.alphaVantageKey),
    fetchMacroContext(asset.symbol),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

  const allNews = [...(assetNews || []), ...(globalNews || [])];

  onProgress(2, total, 'Data fetched. Starting specialist agents...');

  // Step 2: Run specialist agents in parallel (batched)
  const agentOutputs = [];
  let step = 3;

  // Assign roles to available agents (round-robin if fewer agents than roles)
  const roleAssignments = SPECIALIST_ROLES.map((role, i) => ({
    role,
    agent: specialistAgents[i % specialistAgents.length],
  }));

  // Run in parallel batches of 3 to avoid rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < roleAssignments.length; i += BATCH_SIZE) {
    const batch = roleAssignments.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(({ role, agent }) => {
        onProgress(step++, total, `Running ${AGENT_ROLES[role]?.name || role}...`);
        return runSpecialistAgent(agent, asset, price, history || [], allNews, role);
      })
    );

    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        agentOutputs.push(r.value);
      } else {
        // Include failed agent with neutral signal
        agentOutputs.push({
          role: batch[idx].role,
          agentName: batch[idx].agent.name,
          agentId: batch[idx].agent.id,
          roleName: AGENT_ROLES[batch[idx].role]?.name || batch[idx].role,
          signal: 'neutral',
          confidence: 0,
          reasoning: `Agent failed: ${r.reason?.message || 'Unknown error'}`,
          keyFactors: [],
          butterflies: [],
          error: true,
          timestamp: Date.now(),
        });
      }
    });
  }

  // Step 3: Run synthesizer
  onProgress(total - 1, total, 'Synthesizing all signals...');
  const synthAgent = synthAgents[0] || specialistAgents[0]; // fallback to first available

  let synthesis;
  try {
    synthesis = await runSynthesizer(synthAgent, asset, agentOutputs);
  } catch (err) {
    // Compute fallback synthesis from agent signals
    const signals = agentOutputs.map(o => o.signal);
    const bullCount = signals.filter(s => s === 'bullish').length;
    const bearCount = signals.filter(s => s === 'bearish').length;
    const total_ = signals.length;
    synthesis = {
      upProbability: Math.round((bullCount / total_) * 100),
      downProbability: Math.round((bearCount / total_) * 100),
      neutralProbability: Math.round(((total_ - bullCount - bearCount) / total_) * 100),
      primaryDirection: bullCount > bearCount ? 'up' : bearCount > bullCount ? 'down' : 'sideways',
      confidence: 40,
      summary: 'Synthesis agent failed. Computed from raw agent votes.',
      error: true,
    };
  }

  // Step 4: Build graph
  onProgress(total, total, 'Building agent graph...');
  const graph = buildAgentGraph(agentOutputs, synthesis, asset);

  const analysis = {
    id: analysisId,
    asset,
    price,
    agentOutputs,
    synthesis,
    graph,
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  // Persist
  await saveAnalysis(analysis);

  return analysis;
}

module.exports = { runFullAnalysis };
