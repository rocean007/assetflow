const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getAgents, upsertAgent, deleteAgent, getAgent } = require('../services/storage');
const { callLLM } = require('../services/llm');

const router = express.Router();

// GET /api/agents
router.get('/', async (req, res) => {
  try {
    const agents = await getAgents();
    // Never return api keys to frontend
    res.json(agents.map(sanitize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents
router.post('/', async (req, res) => {
  try {
    const { name, provider, apiKey, model, baseUrl, role, description } = req.body;
    if (!name || !provider) return res.status(400).json({ error: 'name and provider required' });

    const agent = {
      id: uuidv4(),
      name,
      provider,
      apiKey: apiKey || '',
      model: model || '',
      baseUrl: baseUrl || '',
      role: role || 'specialist',
      description: description || '',
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    await upsertAgent(agent);
    res.json(sanitize(agent));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agents/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await getAgent(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    await upsertAgent(updated);
    res.json(sanitize(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteAgent(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/:id/test - Test agent connectivity
router.post('/:id/test', async (req, res) => {
  try {
    const agent = await getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const response = await callLLM(
      agent,
      'You are a helpful assistant.',
      'Say "AssetFlow connection successful" and nothing else.'
    );

    res.json({ success: true, response: response?.slice(0, 200) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

function sanitize(agent) {
  const { apiKey, ...safe } = agent;
  return { ...safe, hasApiKey: !!(apiKey && apiKey.length > 0) };
}

module.exports = router;
