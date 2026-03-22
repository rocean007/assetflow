const express = require('express');
const { fetchPrice, fetchHistory } = require('../services/data');
const router = express.Router();

router.get('/price/:symbol', async (req, res) => {
  try {
    const p = await fetchPrice(req.params.symbol, req.query.apiKey);
    if (!p) return res.status(404).json({ error: 'Price not available' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history/:symbol', async (req, res) => {
  try {
    const h = await fetchHistory(req.params.symbol, parseInt(req.query.days) || 30, req.query.apiKey);
    res.json(h);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
