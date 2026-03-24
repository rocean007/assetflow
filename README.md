# AssetFlow

**Probabilistic multi-agent asset intelligence with a single unified flow.**

Enter a ticker. Optionally upload research files (PDF, DOCX, TXT, CSV…). Hit Run.
Agents immediately begin analyzing 25+ real-time data categories in parallel — price history,
options flow, insider trades, analyst ratings, earnings calendar, 15 financial news feeds,
12 central bank feeds, weather across 8 agricultural and energy regions, 18 commodity prices,
shipping indices, geopolitical alerts, regulatory actions, and social media from Reddit and
StockTwits. A **fast prediction** is shown within minutes. Meanwhile, enriched deep research
runs in the background, agents re-analyze with the fuller context, and a **final refined
verdict** replaces the fast one. You can then interview any individual agent to interrogate
their reasoning.

No WebSocket issues. No separate "build graph" and "simulate" steps. One flow.

---

## Requirements

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)  
- **Yarn** — `npm install -g yarn`
- **An LLM API key** — Groq is free and takes 2 minutes: [console.groq.com](https://console.groq.com)

---

## Quick Start

```bash
# 1. Setup (one time)
python3 scripts/setup.py

# 2. Backend (Terminal 1)
cd backend
pip install -r requirements.txt
python run.py
# → http://localhost:5001

# 3. Frontend (Terminal 2)
cd frontend
yarn install
yarn dev
# → http://localhost:5173
```

Open **http://localhost:5173**

**First step**: Go to **Agents** → Add Agent → pick Groq, paste your free key.

---

## The Flow

```
POST /api/sessions/  (create + start immediately)
         │
         ▼
  ┌──────────────────────────────────────────────┐
  │  PHASE 0 — Data Fetch  (~10-20 seconds)      │
  │  All 25+ sources fetched in parallel         │
  │  price · options · news · weather · social   │
  │  commodities · macro · geo · regulatory      │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │  PHASE 1 — Specialist Agents (concurrent)    │
  │  Each writes to shared IntelGraph            │
  │  Agents trace butterfly effect chains        │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │  PHASE 1 SYNTHESIS                           │
  │  Synthesizer reads complete graph            │
  │  → FAST PREDICTION shown to user ←          │
  └──────────────────┬───────────────────────────┘
                     │  background continues
  ┌──────────────────▼───────────────────────────┐
  │  PHASE 2 — Deep Research                     │
  │  Research question + files + extra context   │
  │  Agents re-run with enriched data            │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │  PHASE 2 SYNTHESIS                           │
  │  → FINAL VERDICT replaces fast one ←        │
  └──────────────────────────────────────────────┘
```

Real-time progress is streamed via **Server-Sent Events** (no WebSocket, works everywhere):
```
GET /api/sessions/<id>/stream   → text/event-stream
```

---

## What Makes This Different

### Butterfly Effect Reasoning

Every specialist agent is instructed to trace **indirect causal chains** across data
categories. The more indirect, the better. Example:

```
Weather alert: DROUGHT in US Midwest corn belt
  → corn supply expected to drop
  → feed grain shortage → livestock costs rise
  → protein prices rise → food inflation ticks up
  → consumer discretionary spending compresses
  → retail sector margins under pressure
  → bearish signal for consumer-exposed equities
```

These chains are written as **structured edge claims** into the shared IntelGraph.
The synthesizer reads the complete causal network, not just raw vote tallies.

### Data Relevance by Asset Type

The system understands which data matters for which asset:

| Asset | High-Priority Data |
|-------|--------------------|
| Energy stocks | Oil/gas prices, weather near oil infrastructure, EIA reports |
| Tech equities | Regulatory (FTC/SEC), labor market, social sentiment |
| Agricultural commodities | Weather across 8 regions, USDA/FAO, shipping BDI |
| Crypto | Social sentiment, macro rate decisions, regulatory |
| Forex | Central banks, macro, geopolitical events |

### Social Manipulation Detection

Every social media post receives a **manipulation score (0–100)**:
- 0–30: Genuine organic signal
- 30–60: Biased but informative  
- 60+: Likely coordinated pump/dump attempt

If >40% of posts are flagged AND all point the same direction → likely pump → agents are
instructed to **fade** the signal direction. A detected pump attempt is itself a signal.

### Research Files

Upload supplementary files to any analysis session:
- **PDF**: Annual reports, earnings transcripts, research papers
- **DOCX**: Analyst notes, internal research
- **TXT/MD**: Custom context, news summaries
- **CSV**: Historical data, custom datasets
- **JSON**: Structured data exports

Text is extracted and injected into every agent's context as high-priority information.

---

## LLM Providers

All providers use the OpenAI-compatible chat API format. Confirmed working in 2025/2026:

| Provider | Cost | Quality | Get Key |
|----------|------|---------|---------|
| **Groq** | FREE signup | ⭐⭐⭐⭐ | [console.groq.com](https://console.groq.com) |
| **OpenRouter** | FREE (no CC) | ⭐⭐⭐ | [openrouter.ai](https://openrouter.ai) |
| **Google Gemini** | FREE tier | ⭐⭐⭐⭐ | [aistudio.google.com](https://aistudio.google.com) |
| **Mistral** | FREE tier | ⭐⭐⭐ | [console.mistral.ai](https://console.mistral.ai) |
| **Together AI** | $25 free credits | ⭐⭐⭐⭐ | [platform.together.ai](https://platform.together.ai) |
| **Cerebras** | FREE fast tier | ⭐⭐⭐ | [inference.cerebras.ai](https://inference.cerebras.ai) |
| **DeepSeek** | ~$0 ($0.00014/1K) | ⭐⭐⭐⭐ | [platform.deepseek.com](https://platform.deepseek.com) |
| **OpenAI** | Paid | ⭐⭐⭐⭐⭐ | [platform.openai.com](https://platform.openai.com) |
| **Anthropic** | Paid | ⭐⭐⭐⭐⭐ | [console.anthropic.com](https://console.anthropic.com) |
| **Ollama** | FREE (local) | ⭐⭐⭐⭐ | [ollama.com](https://ollama.com) |

### Recommended Setup (Free, High Quality)

Add two Groq agents — one specialist, one synthesizer:

```
Name:     Groq Specialist
Provider: groq
Model:    llama-3.3-70b-versatile
Role:     specialist
Key:      [from console.groq.com]

Name:     Groq Synthesizer
Provider: groq
Model:    llama-3.3-70b-versatile
Role:     synthesizer
Key:      [same key]
```

That's it. The specialist role auto-rotates across all 7 analytical domains.

### Best Setup (Mixed)

```
7 specialist agents (one per role) → Groq llama-3.3-70b-versatile (fast, free)
1 synthesizer                      → OpenAI gpt-4o-mini or Anthropic claude-3-5-haiku
```

---

## Agent Roles

### Phase 1 — Specialists

Each runs concurrently. Each writes independent findings to the IntelGraph.

| Role | Analyzes |
|------|---------|
| `specialist` | Auto round-robin across all 7 roles below |
| `macro` | Interest rates, inflation, GDP, central bank guidance, yield curves, currency flows |
| `sentiment` | News narratives, options P/C ratio, insider trades, short interest, fear/greed |
| `supply` | Weather (8 regions), 18 commodity moves, shipping BDI, agricultural reports |
| `technical` | OHLCV price action, estimated RSI, volume, momentum, support/resistance |
| `geo` | Conflicts, sanctions, trade policy, regulatory actions (SEC/FDA/FTC) |
| `sector` | Earnings calendar, EPS estimates, analyst ratings/targets, insider activity |
| `social` | Reddit (7 subs), StockTwits native sentiment, manipulation detection |

### Phase 2 — Synthesizer

Reads the **complete assembled IntelGraph** — all nodes, all causal edges, all signal votes —
and produces the final probability verdict. Does NOT see raw agent outputs, only the graph.

---

## Data Sources

### Market (Yahoo Finance + optional Alpha Vantage)
Price, OHLCV history (60 days), options chain (P/C ratio, open interest, IV), analyst ratings
and target prices, earnings calendar (next date, EPS estimate, last surprise), insider
transactions (buys vs. sells), short interest

### News (15 RSS feeds)
Reuters, Yahoo Finance, CNBC, MarketWatch, Bloomberg Economics, NYT Business, Seeking Alpha,
WSJ, FT, TechCrunch, HackerNews, VentureBeat, ZeroHedge, TheStreet, Motley Fool

### Central Banks & Macro (6 feeds)
Federal Reserve, ECB, IMF, BLS (Jobs/CPI), BEA (GDP), US Treasury

### Weather — 8 Regions (Open-Meteo, free, no key)
4-day forecast with automatic alert detection (flood risk, drought, extreme heat, frost,
storm, thunderstorm):

| Region | Covers |
|--------|--------|
| US Midwest | Corn, soy, ethanol |
| Great Plains | Winter wheat |
| Ukraine | Wheat, sunflower |
| Brazil | Soybeans, coffee, sugar |
| Texas / Gulf Coast | Crude oil, natural gas |
| North Sea | Brent crude, natural gas |
| Indonesia | Palm oil, coal |
| West Africa | Cocoa, crude oil |

### Commodities (18 via Yahoo Finance)
Gold, WTI Crude, Brent Crude, Natural Gas, Wheat, Corn, Soybeans, Copper, Silver, Bitcoin,
Ethereum, VIX, US 10Y Yield, USD Index, Baltic Dry Index, Coffee, Cocoa, Live Cattle

### Sector Feeds
Geopolitical: ReliefWeb, UN News, CFR, Al Jazeera  
Regulatory: SEC 8-K, CFTC, FDA  
Energy: EIA, OilPrice  
Agriculture: USDA, FAO  

### Social Media
Reddit (7 subreddits: stocks, investing, wallstreetbets, SecurityAnalysis, StockMarket,
options, dividends) — each post scored for manipulation  
StockTwits — native bullish/bearish counts

---

## API Reference

All endpoints return `{"success": true/false, "data": ...}`.

Real-time progress uses **Server-Sent Events** (`text/event-stream`), not WebSocket.
The browser's native `EventSource` API connects directly.

### Sessions — `/api/sessions/`

```
GET  /api/sessions/              List all sessions (summary)
POST /api/sessions/              Create session + start pipeline immediately
GET  /api/sessions/<id>          Get full session data
DELETE /api/sessions/<id>        Delete session

GET  /api/sessions/<id>/stream   SSE stream — real-time progress
POST /api/sessions/<id>/upload   Upload research file (multipart/form-data, field: file)
POST /api/sessions/<id>/interview      Interview one agent
POST /api/sessions/<id>/interview/all  Ask all agents same question
```

**Create session** (`POST /api/sessions/`):
```json
{
  "symbol":      "AAPL",
  "name":        "My Analysis",
  "asset_type":  "equity",
  "description": "How might rising rates affect this stock?",
  "av_key":      "optional-alphavantage-key"
}
```

**Interview agent** (`POST /api/sessions/<id>/interview`):
```json
{
  "question": "What is your single biggest concern for tomorrow?",
  "role":     "macro"
}
```

**Interview all** (`POST /api/sessions/<id>/interview/all`):
```json
{
  "question": "What would change your signal?"
}
```

### SSE Stream Events

Connect with `new EventSource('/api/sessions/<id>/stream')`. Each event is a JSON object:

```js
// Progress update
{ "session_id": "s_abc", "status": "running", "progress": 45, "message": "[Phase 1] Macro agent: bullish @72% (3/7)" }

// Enrichment phase (fast result already available)
{ "status": "enriching", "progress": 68, "message": "Deep research running in background..." }

// Completion — full data available
{ "done": true, "full": { ...complete session object... } }
```

### Agents — `/api/agents/`

```
GET    /api/agents/        List agents
POST   /api/agents/        Create agent
GET    /api/agents/<id>    Get agent
PUT    /api/agents/<id>    Update agent
DELETE /api/agents/<id>    Delete agent
POST   /api/agents/<id>/test  Test connectivity
```

**Create agent** (`POST /api/agents/`):
```json
{
  "name":        "My Groq Agent",
  "provider":    "groq",
  "api_key":     "gsk_...",
  "model":       "llama-3.3-70b-versatile",
  "role":        "specialist",
  "description": "Optional description"
}
```

Valid providers: `groq`, `openrouter`, `google`, `mistral`, `together`, `cerebras`,
`deepseek`, `openai`, `anthropic`, `ollama`

### Market — `/api/market/`

```
GET /api/market/price/<symbol>    Current price
GET /api/market/history/<symbol>  OHLCV history (?days=30)
```

### Health

```
GET /api/health    → {"ok": true, "ts": 1234567890}
```

---

## Pages

**Dashboard** — Latest analysis at a glance: gauge, bull/bear cases, graph preview, session list

**New Analysis** — Enter ticker, research question, upload files, hit Run. Shows the pipeline
flow diagram so you understand what's happening.

**Run / Session** — Live progress via SSE stream. Switches between **Fast** and **Final**
predictions as they complete. Full results: gauge, bull/bear cases, butterfly chains, risks,
catalysts, intelligence graph (interactive ReactFlow), per-agent cards with reasoning, and
the interview panel.

**Agents** — Full CRUD for LLM agents. Provider guide with notes on free tiers and sign-up
links. Phase 1 / Phase 2 count display.

**History** — All past sessions with direction, probabilities, confidence, file count, and
interview count.

---

## Data Storage

Everything local. No external database.

```
data/
  sessions.json    All sessions + results (last 500 kept)
  agents.json      Agent configs (API keys stored here — keep private)
  uploads/
    <session_id>/  Uploaded files per session
```

---

## Configuration

`backend/.env` (auto-created by setup):

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `5001` | Backend port |
| `FLASK_ENV` | `development` | Set to `production` for deployment |
| `LOG_LEVEL` | `INFO` | DEBUG/INFO/WARNING |

---

## Architecture

```
backend/
  app/
    api/
      sessions.py   Session CRUD + SSE stream + file upload + interview
      agents.py     Agent CRUD + connectivity test
      market.py     Price/history proxy
    models/
      session.py    Session dataclass + SessionStore (JSON persistence)
      agent.py      Agent dataclass + built-in definitions
    services/
      llm.py         10 providers (all OpenAI-compat format) + JSON extraction
      data.py        25+ sources, all parallel, all free
      graph.py       IntelGraph: nodes, edges, signal votes
      runner.py      7 specialist roles (dual prompt: full + compact) + synthesizer
      pipeline.py    3-phase unified pipeline (background thread)
      agent_store.py Agent JSON persistence
      file_parser.py PDF/DOCX/TXT/CSV/JSON text extraction
    utils/
      logger.py     Named loggers
    config.py       Config class
  run.py            Entry point (Flask threaded, no WebSocket deps)

frontend/src/
  pages/
    Home.jsx        Dashboard + recent sessions
    NewRun.jsx      Create analysis + file upload + provider guide
    Run.jsx         Live SSE stream + full results + interview panel
    Agents.jsx      Agent management
    History.jsx     Session history
  components/
    Layout.jsx      Nav bar
    UI.jsx          Card, Tag, Bar, Spin, color helpers
    Gauge.jsx       SVG probability gauge
    Graph.jsx       ReactFlow intelligence graph
  store/index.js    Zustand state
  utils/api.js      Axios API client
  main.jsx          Router + entry
```

---

## Docker

```bash
docker-compose up --build
```

Backend port 5001, frontend port 5173 (nginx proxy).

---

## Troubleshooting

**No agents configured**
Go to **Agents** tab. Add a Groq agent. Get a free key at [console.groq.com](https://console.groq.com) — takes 2 minutes.

**Price data unavailable**
Normal without an Alpha Vantage key. All other data sources still work. Get a free key at
[alphavantage.co](https://www.alphavantage.co) and add it when creating your session.

**"LLM failed" in agent output**
Usually means the API key is wrong or the model name is incorrect. Test the agent in the
Agents tab with the **test** button.

**Social data shows 0**
Reddit can rate-limit. StockTwits is more reliable. Analysis still completes — social is
one of 25+ data categories.

**Ollama not connecting**
Set the base URL field to `http://localhost:11434` in the agent config. Make sure Ollama
is running with `ollama serve` and the model is pulled: `ollama pull llama3.2`

**Slow analysis**
Data collection is parallel (10–20 seconds). LLM calls depend on your provider — Groq is
typically the fastest free option (300+ tokens/second). Reduce the number of agents if speed
is a priority.

**Port conflict**
Change `PORT` in `backend/.env`. Update the proxy in `frontend/vite.config.js`:
```js
proxy: { '/api': { target: 'http://localhost:YOUR_PORT', ... } }
```

---

## Disclaimer

Not financial advice. Do not make trading decisions based solely on AI model output.
This tool provides probabilistic analysis — it does not predict the future with certainty.
Always conduct your own research and consult qualified professionals.

---

## License

MIT
