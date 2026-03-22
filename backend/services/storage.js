const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');

// Ensure data directory and files exist
async function init() {
  await fs.ensureDir(DATA_DIR);
  if (!await fs.pathExists(AGENTS_FILE)) await fs.writeJson(AGENTS_FILE, [], { spaces: 2 });
  if (!await fs.pathExists(ANALYSES_FILE)) await fs.writeJson(ANALYSES_FILE, [], { spaces: 2 });
}

init().catch(console.error);

// --- Agents ---
async function getAgents() {
  await fs.ensureDir(DATA_DIR);
  if (!await fs.pathExists(AGENTS_FILE)) return [];
  return fs.readJson(AGENTS_FILE);
}

async function saveAgents(agents) {
  await fs.ensureDir(DATA_DIR);
  await fs.writeJson(AGENTS_FILE, agents, { spaces: 2 });
}

async function getAgent(id) {
  const agents = await getAgents();
  return agents.find(a => a.id === id) || null;
}

async function upsertAgent(agent) {
  const agents = await getAgents();
  const idx = agents.findIndex(a => a.id === agent.id);
  if (idx >= 0) agents[idx] = agent;
  else agents.push(agent);
  await saveAgents(agents);
  return agent;
}

async function deleteAgent(id) {
  const agents = await getAgents();
  const filtered = agents.filter(a => a.id !== id);
  await saveAgents(filtered);
  return filtered.length < agents.length;
}

// --- Analyses ---
async function getAnalyses(limit = 50) {
  if (!await fs.pathExists(ANALYSES_FILE)) return [];
  const all = await fs.readJson(ANALYSES_FILE);
  return all.slice(-limit).reverse();
}

async function saveAnalysis(analysis) {
  const all = await fs.pathExists(ANALYSES_FILE) ? await fs.readJson(ANALYSES_FILE) : [];
  all.push(analysis);
  // Keep last 500
  const trimmed = all.slice(-500);
  await fs.writeJson(ANALYSES_FILE, trimmed, { spaces: 2 });
  return analysis;
}

module.exports = { getAgents, saveAgents, getAgent, upsertAgent, deleteAgent, getAnalyses, saveAnalysis };
