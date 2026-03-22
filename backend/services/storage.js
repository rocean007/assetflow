const fs = require('fs-extra');
const path = require('path');

const DATA = path.join(__dirname, '../../data');
const AGENTS_FILE = path.join(DATA, 'agents.json');
const ANALYSES_FILE = path.join(DATA, 'analyses.json');

/**
 * Built-in free agents — seeded on first run, require NO API keys.
 * These use Pollinations.ai (truly free, no signup) as the backbone,
 * with HuggingFace free inference as secondary and Together.ai as tertiary.
 *
 * Users can disable or delete these and add their own paid agents for
 * better quality. The free agents work fine for demonstration and light use.
 */
const BUILTIN_FREE_AGENTS = [
  {
    id: 'builtin_pollinations_macro',
    name: 'Macro Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'macro',
    description: 'Macro economist — powered by Pollinations.ai (free, no key). Analyzes rates, inflation, GDP, central banks.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_sentiment',
    name: 'Sentiment Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'sentiment',
    description: 'Sentiment analyst — powered by Pollinations.ai (free, no key). Analyzes news narratives, social media, options flow.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_supply',
    name: 'Supply Chain Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'supply_chain',
    description: 'Supply chain specialist — powered by Pollinations.ai (free, no key). Weather, commodities, shipping, butterfly chains.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_technical',
    name: 'Technical Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'technical',
    description: 'Technical analyst — powered by Pollinations.ai (free, no key). Price action, momentum, volume, RSI.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_geo',
    name: 'Geopolitical Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'geopolitical',
    description: 'Geopolitical risk analyst — powered by Pollinations.ai (free, no key). Conflicts, trade, regulatory, sanctions.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_sector',
    name: 'Sector Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'sector',
    description: 'Sector specialist — powered by Pollinations.ai (free, no key). Earnings, analyst ratings, insider trades, M&A.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_pollinations_social',
    name: 'Social Agent (Pollinations · Free)',
    provider: 'pollinations',
    apiKey: '',
    model: 'mistral',
    baseUrl: '',
    role: 'social_sentiment',
    description: 'Social intelligence — powered by Pollinations.ai (free, no key). Reddit/X/StockTwits/HN with manipulation detection.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'builtin_hf_synthesizer',
    name: 'Synthesizer (HuggingFace · Free)',
    provider: 'huggingface_free',
    apiKey: '',
    model: 'HuggingFaceH4/zephyr-7b-beta',
    baseUrl: '',
    role: 'synthesizer',
    description: 'Graph synthesizer — powered by HuggingFace Zephyr-7B (free, no key). Reads the complete agent graph and produces the final probability verdict.',
    enabled: true,
    builtin: true,
    createdAt: new Date().toISOString(),
  },
];

async function ensureFiles() {
  await fs.ensureDir(DATA);

  // Seed agents.json with free built-ins if it doesn't exist yet
  if (!await fs.pathExists(AGENTS_FILE)) {
    await fs.writeJson(AGENTS_FILE, BUILTIN_FREE_AGENTS, { spaces: 2 });
    console.log(`  [storage] Seeded ${BUILTIN_FREE_AGENTS.length} built-in free agents`);
  }

  if (!await fs.pathExists(ANALYSES_FILE)) {
    await fs.writeJson(ANALYSES_FILE, [], { spaces: 2 });
  }
}

ensureFiles().catch(e => console.error('[storage] Init error:', e.message));

async function getAgents() {
  await fs.ensureDir(DATA);
  if (!await fs.pathExists(AGENTS_FILE)) return BUILTIN_FREE_AGENTS;
  return fs.readJson(AGENTS_FILE);
}

async function saveAgents(agents) {
  await fs.ensureDir(DATA);
  await fs.writeJson(AGENTS_FILE, agents, { spaces: 2 });
}

async function getAgent(id) {
  const agents = await getAgents();
  return agents.find(a => a.id === id) || null;
}

async function upsertAgent(agent) {
  const agents = await getAgents();
  const idx = agents.findIndex(a => a.id === agent.id);
  if (idx >= 0) agents[idx] = agent; else agents.push(agent);
  await saveAgents(agents);
  return agent;
}

async function deleteAgent(id) {
  const agents = await getAgents();
  const filtered = agents.filter(a => a.id !== id);
  await saveAgents(filtered);
  return filtered.length < agents.length;
}

async function getAnalyses(limit = 50) {
  if (!await fs.pathExists(ANALYSES_FILE)) return [];
  const all = await fs.readJson(ANALYSES_FILE);
  return all.slice(-limit).reverse();
}

async function saveAnalysis(analysis) {
  await fs.ensureDir(DATA);
  const all = await fs.pathExists(ANALYSES_FILE) ? await fs.readJson(ANALYSES_FILE) : [];
  all.push(analysis);
  await fs.writeJson(ANALYSES_FILE, all.slice(-500), { spaces: 2 });
  return analysis;
}

module.exports = {
  getAgents, saveAgents, getAgent, upsertAgent, deleteAgent,
  getAnalyses, saveAnalysis,
  BUILTIN_FREE_AGENTS
};
