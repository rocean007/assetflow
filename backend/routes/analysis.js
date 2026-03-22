const express = require('express');
const { getAgents } = require('../services/storage');
const { getAnalyses } = require('../services/storage');
const { runFullAnalysis } = require('../agents/orchestrator');

const router = express.Router();

// Active analysis jobs
const activeJobs = new Map();

// POST /api/analysis/run
router.post('/run', async (req, res) => {
  try {
    const { symbol, name, assetType, alphaVantageKey } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const agents = await getAgents();
    const enabled = agents.filter(a => a.enabled !== false);
    if (enabled.length === 0) return res.status(400).json({ error: 'No agents configured. Add at least one agent first.' });

    const jobId = `${symbol}_${Date.now()}`;
    activeJobs.set(jobId, { status: 'running', progress: 0, message: 'Starting...' });

    // Respond immediately with jobId
    res.json({ jobId, status: 'running' });

    // Run analysis asynchronously
    const asset = { symbol: symbol.toUpperCase(), name, assetType, alphaVantageKey };

    runFullAnalysis(asset, enabled, (step, total, message) => {
      const progress = Math.round((step / total) * 100);
      activeJobs.set(jobId, { status: 'running', progress, message });
      global.broadcast('analysis_progress', { jobId, progress, message });
    })
      .then(analysis => {
        activeJobs.set(jobId, { status: 'done', progress: 100, result: analysis });
        global.broadcast('analysis_complete', { jobId, analysis });
        // Cleanup after 5 min
        setTimeout(() => activeJobs.delete(jobId), 5 * 60 * 1000);
      })
      .catch(err => {
        activeJobs.set(jobId, { status: 'error', error: err.message });
        global.broadcast('analysis_error', { jobId, error: err.message });
      });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/job/:jobId
router.get('/job/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// GET /api/analysis/history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const analyses = await getAnalyses(limit);
    // Return lightweight summaries
    const summaries = analyses.map(a => ({
      id: a.id,
      asset: a.asset,
      price: a.price,
      synthesis: a.synthesis,
      createdAt: a.createdAt,
      durationMs: a.durationMs,
    }));
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/:id - full analysis
router.get('/:id', async (req, res) => {
  try {
    const analyses = await getAnalyses(500);
    const analysis = analyses.find(a => a.id === req.params.id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
