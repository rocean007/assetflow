const fs = require('fs-extra');
const path = require('path');

const DATA = path.join(__dirname, '../../data');
const AGENTS_FILE = path.join(DATA, 'agents.json');
const ANALYSES_FILE = path.join(DATA, 'analyses.json');

async function ensureFiles() {
  await fs.ensureDir(DATA);
  if (!await fs.pathExists(AGENTS_FILE)) await fs.writeJson(AGENTS_FILE, [], { spaces: 2 });
  if (!await fs.pathExists(ANALYSES_FILE)) await fs.writeJson(ANALYSES_FILE, [], { spaces: 2 });
}
ensureFiles().catch(() => {});

async function getAgents() {
  await fs.ensureDir(DATA);
  if (!await fs.pathExists(AGENTS_FILE)) return [];
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

module.exports = { getAgents, saveAgents, getAgent, upsertAgent, deleteAgent, getAnalyses, saveAnalysis };
