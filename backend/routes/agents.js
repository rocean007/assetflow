const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getAgents, upsertAgent, deleteAgent, getAgent } = require('../services/storage');
const { callLLM } = require('../services/llm');

const router = express.Router();

const sanitize = (agent) => { const { apiKey, ...safe } = agent; return { ...safe, hasApiKey: !!(apiKey && apiKey.length > 0) }; };

router.get('/', async (req, res) => {
  try { res.json((await getAgents()).map(sanitize)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, provider, apiKey, model, baseUrl, role, description } = req.body;
    if (!name || !provider) return res.status(400).json({ error: 'name and provider required' });
    const agent = { id: uuidv4(), name, provider, apiKey: apiKey || '', model: model || '', baseUrl: baseUrl || '', role: role || 'specialist', description: description || '', enabled: true, createdAt: new Date().toISOString() };
    await upsertAgent(agent);
    res.json(sanitize(agent));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getAgent(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    await upsertAgent(updated);
    res.json(sanitize(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await deleteAgent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/test', async (req, res) => {
  try {
    const agent = await getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Not found' });
    const response = await callLLM(agent, 'You are a test assistant.', 'Respond with exactly: "AssetFlow connection OK"');
    res.json({ success: true, response: response?.slice(0, 200) });
  } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

module.exports = router;
