const express = require('express');
const { fetchPrice, fetchHistory, fetchNews } = require('../services/market');

const router = express.Router();

// GET /api/market/price/:symbol
router.get('/price/:symbol', async (req, res) => {
  try {
    const price = await fetchPrice(req.params.symbol, req.query.apiKey);
    if (!price) return res.status(404).json({ error: 'Price not found' });
    res.json(price);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/history/:symbol
router.get('/history/:symbol', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await fetchHistory(req.params.symbol, days, req.query.apiKey);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/news
router.get('/news', async (req, res) => {
  try {
    const news = await fetchNews(req.query.q || '', parseInt(req.query.limit) || 20);
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
