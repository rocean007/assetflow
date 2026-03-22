const express = require('express');
const { getAgents, getAnalyses } = require('../services/storage');
const { runFullAnalysis } = require('../agents/orchestrator');

const router = express.Router();
const jobs = new Map();

router.post('/run', async (req, res) => {
  try {
    const { symbol, name, assetType, alphaVantageKey } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const agents = await getAgents();
    const enabled = agents.filter(a => a.enabled !== false);
    if (!enabled.length) return res.status(400).json({ error: 'No agents configured. Go to Agents tab and add at least one.' });

    const jobId = `${symbol.toUpperCase()}_${Date.now()}`;
    jobs.set(jobId, { status: 'running', progress: 0, message: 'Starting...' });
    res.json({ jobId, status: 'running' });

    const asset = { symbol: symbol.toUpperCase(), name: name || symbol.toUpperCase(), assetType: assetType || 'equity', alphaVantageKey };

    runFullAnalysis(asset, enabled, (step, total, message) => {
      const progress = Math.round(step / total * 100);
      jobs.set(jobId, { status: 'running', progress, message });
      global.broadcast('analysis_progress', { jobId, progress, message });
    }).then(analysis => {
      jobs.set(jobId, { status: 'done', progress: 100, result: analysis });
      global.broadcast('analysis_complete', { jobId, analysis });
      setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
    }).catch(err => {
      jobs.set(jobId, { status: 'error', error: err.message });
      global.broadcast('analysis_error', { jobId, error: err.message });
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

router.get('/history', async (req, res) => {
  try {
    const all = await getAnalyses(parseInt(req.query.limit) || 50);
    res.json(all.map(a => ({ id: a.id, asset: a.asset, price: a.price, synthesis: a.synthesis, stats: a.stats, createdAt: a.createdAt, durationMs: a.durationMs })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const all = await getAnalyses(500);
    const found = all.find(a => a.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json(found);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
