require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const path = require('path');

const agentRoutes = require('./routes/agents');
const analysisRoutes = require('./routes/analysis');
const marketRoutes = require('./routes/market');

const app = express();
const server = http.createServer(app);

// WebSocket for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

global.wss = wss;

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Broadcast helper
global.broadcast = (event, data) => {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
};

const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));
app.use(limiter);

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/market', marketRoutes);

// Health
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🌊 AssetFlow backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}/ws\n`);
});

module.exports = { app, server };
