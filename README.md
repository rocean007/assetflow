# AssetFlow

**Probabilistic multi-agent asset intelligence.**

Upload research files, enter a ticker, and a swarm of AI agents independently analyzes 25+ real-time data sources — price history, options flow, insider trades, analyst ratings, earnings, central bank feeds, weather across 12 agricultural regions, 30 commodities, shipping indices, social media from Reddit/StockTwits/X, geopolitical alerts, regulatory news, labor data, ESG signals, and more. Each agent writes its findings into a shared intelligence graph. A synthesizer reads the complete graph and produces a probability verdict. You can then interview any individual agent to interrogate their reasoning.

**Comes with 8 built-in free agents. No API key needed to run.**

---

## Requirements

- Python 3.10 or later — [python.org](https://python.org)
- Node.js 18 or later — [nodejs.org](https://nodejs.org)
- Yarn — `npm install -g yarn`

---

## Quick Start

```bash
# 1. One-time setup
python3 scripts/setup.py

# 2. Start the backend (Terminal 1)
cd backend
pip install -r requirements.txt
python run.py
# Runs on http://localhost:5001

# 3. Start the frontend (Terminal 2)
cd frontend
yarn install
yarn dev
# Opens http://localhost:5173
```

Open **http://localhost:5173** in your browser. The 8 built-in free agents are pre-configured and ready to use immediately.

---

## How It Works

### The Three-Phase Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 0 — Data Fetch (parallel, ~10–20 seconds)        │
│                                                          │
│  Price + OHLCV · Options chain · Analyst ratings        │
│  Earnings calendar · Insider transactions · Short int   │
│  20 news RSS feeds · 12 central bank feeds              │
│  Weather: 12 agricultural/energy regions (Open-Meteo)   │
│  30 commodities · Shipping (Baltic Dry + 3 feeds)       │
│  Social: Reddit × 10 subs, StockTwits, X/Nitter         │
│  Geopolitical · Regulatory · ESG · Labor · Healthcare   │
│  + Any files you uploaded to the project                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  PHASE 1 — Specialist Agents (all run concurrently)      │
│                                                          │
│  Each agent receives the full world-state context        │
│  Each agent independently writes to a SharedGraph        │
│  No agent sees another's output                          │
│                                                          │
│  Roles: Macro · Sentiment · Supply Chain · Technical    │
│         Geopolitical · Sector · Social Intelligence     │
└────────────────────┬────────────────────────────────────┘
                     │  (complete graph: nodes + edges + signals)
┌────────────────────▼────────────────────────────────────┐
│  PHASE 2 — Synthesizer reads the complete graph          │
│                                                          │
│  Sees ALL agent findings assembled into one graph        │
│  Produces: upProbability / downProbability / neutral     │
│  Bull case · Bear case · Butterfly chains · Risks        │
└────────────────────┬────────────────────────────────────┘
                     │  (optional)
┌────────────────────▼────────────────────────────────────┐
│  PHASE 3 — Super Synthesizer reconciles verdicts         │
│  (only if you configure a super_synthesizer agent)       │
└─────────────────────────────────────────────────────────┘
```

### Butterfly Effect Model

Every agent is explicitly instructed to trace indirect causal chains across data categories. Simple example:

```
Weather alert: DROUGHT in US Midwest corn belt
  → corn supply expected to drop next harvest
  → feed grain shortage → livestock feed costs rise
  → protein prices rise → food inflation increases
  → consumer discretionary spending compresses
  → retail sector margin pressure
  → bearish signal for consumer/retail-exposed assets
```

These chains are written as structured edge claims into the shared graph. The synthesizer reads the complete causal network, not just raw signal votes.

### Relevance Engine

Different assets weight different data differently. The relevance engine automatically tells agents which data categories matter most:

| Asset Type | High-Priority Data |
|------------|-------------------|
| Energy stocks | Oil/gas prices, weather near oil infrastructure, shipping BDI |
| Tech equities | Regulatory (FTC/SEC), labor market, social sentiment |
| Agricultural commodities | Weather across 12 regions, USDA/FAO feeds, shipping |
| Crypto | Social sentiment, macro (rate decisions), regulatory |
| Forex | Central banks, macro, geopolitical |
| Healthcare | FDA actions, STAT News, clinical trial news |

### Data Relevance Scoring

Data categories are not treated equally. The system understands, for example, that:
- A record oil production day → likely reduces oil prices → matters for energy stocks, transportation, inflation; does **not** materially affect gold
- Heavy rainfall in Brazil → affects coffee and soy supply → matters for food companies and commodity ETFs; doesn't affect a US bank stock
- A Fed rate signal → affects everything through cost of capital

Agents receive a relevance guidance block tailored to the specific asset before seeing any data.

---

## The Application

### Pages

**Dashboard** — Overview of latest analysis results, intelligence graph visualization, and quick stats.

**Projects** — The main workspace. Create a project for each asset you want to analyze.
- Upload supplementary research files (PDF, DOCX, TXT, MD, CSV, JSON) — agents incorporate this data
- Trigger graph builds from here
- See build progress in real time

**Agents** — Configure your LLM agents. 8 free agents are pre-installed.

**Analyze** — Run analysis from a project or enter a quick symbol. See full results including:
- Probability gauge (up/down/sideways with confidence)
- Bull case and bear case
- Butterfly effect chains
- Phase 1 intelligence graph (interactive)
- Individual agent outputs with reasoning

**Simulate** — Post-analysis agent interrogation.
- Extract agent profiles from a completed analysis
- Interview any individual agent with a custom question
- Ask all agents the same question simultaneously
- Browse full interview history

**History** — Browse all past analyses with direction, probabilities, and confidence.

---

## Projects and File Uploads

A **Project** ties together a ticker symbol, asset type, optional Alpha Vantage key, a research question, uploaded files, and all analysis results.

### Creating a Project

Go to **Projects → New Project** and fill in:

| Field | Description |
|-------|-------------|
| Symbol | Ticker symbol (AAPL, BTC-USD, CL=F, etc.) |
| Name | Display name for the project |
| Asset Type | equity, crypto, forex, commodity, index, etf, bond, reit |
| Research Question | Optional extra context: "How might rising oil prices affect this stock?" |
| Alpha Vantage Key | Optional — provides better OHLCV price history |

### Uploading Research Files

Click **+ Upload** on any project card. Supported formats:

| Format | Use Case |
|--------|----------|
| PDF | Annual reports, earnings transcripts, research papers |
| DOCX | Analyst notes, internal research |
| TXT / MD | Custom context, news summaries, notes |
| CSV | Historical data, custom datasets |
| JSON | Structured data exports |

The file text is extracted and injected into every agent's context with a note that the analyst uploaded this material for weighting. Agents are instructed to treat uploaded research as a high-priority signal.

### Pipeline

Once a project has files and agents are configured, click **Build Graph** to run the full analysis pipeline.

---

## Agents

### Built-In Free Agents (zero configuration)

These are pre-installed and work immediately — no API key, no signup:

| Agent | Provider | Role |
|-------|----------|------|
| Macro Agent | Pollinations.ai (Mistral-7B) | `macro` |
| Sentiment Agent | Pollinations.ai (Mistral-7B) | `sentiment` |
| Supply Chain Agent | Pollinations.ai (Mistral-7B) | `supply_chain` |
| Technical Agent | Pollinations.ai (Mistral-7B) | `technical` |
| Geopolitical Agent | Pollinations.ai (Mistral-7B) | `geopolitical` |
| Sector Agent | Pollinations.ai (Mistral-7B) | `sector` |
| Social Agent | Pollinations.ai (Mistral-7B) | `social_sentiment` |
| Synthesizer | HuggingFace (Zephyr-7B-beta) | `synthesizer` |

These use 7B parameter models. They reliably produce signal outputs but their reasoning depth is limited. For significantly better analysis quality, add a Groq or Gemini agent (both free).

### Agent Roles

**Phase 1 — Specialists** (write to graph independently):

| Role | Analyzes |
|------|---------|
| `specialist` | Auto-assigned round-robin to all 7 roles below |
| `macro` | Interest rates, inflation, GDP, central bank guidance, yield curves, currency flows |
| `sentiment` | News narratives, fear/greed, options P/C ratio, insider trades, short interest |
| `social_sentiment` | Reddit (10 subs), StockTwits (native sentiment), X — manipulation detection |
| `supply_chain` | Weather (12 regions), 30 commodities, Baltic Dry Index, shipping news, agriculture |
| `technical` | OHLCV price action, estimated RSI, momentum, volume, support/resistance levels |
| `geopolitical` | Conflicts, sanctions, trade policy, SEC/FDA/FTC regulatory actions |
| `sector` | Earnings calendar, EPS estimates, analyst ratings/targets, insider activity, M&A |

**Phase 2 — Synthesizer**: Reads the complete assembled intelligence graph → produces final probability verdict with full analysis.

**Phase 3 — Super Synthesizer** (optional): If you configure multiple synthesizers, this role reconciles their verdicts into one definitive prediction.

### Adding Better Agents

Go to **Agents → Add Agent**.

| Provider | Cost | Quality | Notes |
|----------|------|---------|-------|
| **Pollinations.ai** | Free, no key | Moderate | Default built-in. Works instantly. |
| **HuggingFace Free** | Free, no key | Moderate | Zephyr-7B, Mistral-7B |
| **Together.ai Free** | Free, no key | Moderate | Qwen 2.5 |
| **Groq** | Free (signup) | **High** | Best free quality. [console.groq.com](https://console.groq.com) — 1 min setup |
| **Google Gemini** | Free tier | **High** | [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** | Free models | Varies | Many free models at [openrouter.ai](https://openrouter.ai) |
| **Ollama** | Free (local) | High | Full privacy. [ollama.com](https://ollama.com) |
| **OpenAI** | Paid | Excellent | GPT-4o recommended for synthesis |
| **Anthropic** | Paid | Excellent | Claude Sonnet for deep reasoning |
| **DeepSeek** | ~$0 (very cheap) | High | $0.00014/1K tokens |

### Recommended Setup (free, much better quality)

Add these two agents, disable the built-in Pollinations agents:

```
Provider: groq
Model:    llama-3.3-70b-versatile
Role:     specialist   (this auto-assigns all 7 roles)
Key:      [from console.groq.com]

Provider: groq
Model:    llama-3.3-70b-versatile
Role:     synthesizer
Key:      [same key]
```

### Best Setup (mixed free + paid)

```
7 specialist agents (one per role):
  macro, sentiment, social_sentiment, supply_chain,
  technical, geopolitical, sector
  → Groq or Gemini Flash (fast + free)

1 synthesizer:
  → GPT-4o or Claude Sonnet (smarter for final verdict)

Optional: 1 super_synthesizer
  → For reconciling if you have multiple synthesizers
```

### Testing Agents

Click the **test** button next to any agent to verify connectivity before running analysis.

---

## Data Sources

All free. No API key required unless noted.

### Market Data
- **Price & OHLCV**: Yahoo Finance (default), Alpha Vantage (optional, better quality)
- **Options chain**: Put/call ratio, open interest, implied volatility
- **Analyst ratings**: Target price, consensus, recent upgrades/downgrades
- **Earnings calendar**: Next date, EPS estimate, last earnings surprise percentage
- **Insider transactions**: Recent buys vs. sells, net signal
- **Short interest**: Short percentage of float, short ratio

### Financial News (20 RSS feeds)
Reuters Business, Reuters Tech, Yahoo Finance, CNBC, MarketWatch, Bloomberg Economics, NYT Business, Financial Times, Seeking Alpha, WSJ Markets, Dow Jones Markets, Investing.com, TechCrunch, Ars Technica, HackerNews, VentureBeat, TheStreet, Motley Fool, ZeroHedge

### Central Banks & Macro (12 feeds)
Federal Reserve, ECB, BIS, IMF, World Bank, WTO, BLS (jobs/CPI), BEA (GDP), US Treasury, and more.

### Weather — 12 Regions (Open-Meteo, free, no key)
4-day forecast with automatic alert detection:

| Region | Relevance |
|--------|-----------|
| US Midwest corn belt | Corn, soy, ethanol |
| Great Plains | Winter wheat |
| Ukraine | Wheat, sunflower |
| Brazil | Soybeans, coffee, sugar |
| India | Wheat, rice, cotton |
| Australia | Wheat, coal, LNG |
| Indonesia | Palm oil, coal |
| Texas / Gulf Coast | Crude oil, natural gas |
| North Sea | Brent crude, natural gas |
| China | Manufacturing, pork |
| Argentina | Soybeans, corn, beef |
| West Africa | Cocoa, crude oil |

Alert types detected automatically: flood risk, drought, extreme heat, frost, storm, thunderstorm, blizzard.

### Commodities (30 instruments via Yahoo Finance)
Gold, Silver, Platinum, WTI Crude, Brent Crude, Natural Gas, Wheat, Corn, Soybeans, Coffee, Cotton, Cocoa, Sugar, Live Cattle, Lean Hogs, Copper, Aluminum, USD Index, Bitcoin, Ethereum, VIX, US 10Y Yield, EUR/USD, USD/JPY, GBP/USD, USD/CNY, Baltic Dry Index, Heating Oil, Gasoline, Palladium.

### Sector Feeds
- **Agriculture**: USDA, FAO, AgWeb, World Grain
- **Energy**: EIA, OilPrice, Electrek, PV-Tech
- **Shipping**: FreightWaves, Splash247, Hellenic Shipping News
- **Geopolitical**: ReliefWeb, UN News, CFR, Foreign Policy, Al Jazeera, BBC World
- **Regulatory**: SEC 8-K filings, CFTC, FTC, FDA press releases
- **Healthcare**: STAT News, Fierce Pharma
- **ESG**: ESG Today, Carbon Brief
- **Labor**: BLS employment reports, Layoffs.fyi
- **Consumer**: NRF Retail, ConsumerAffairs
- **Crypto**: CoinTelegraph, Decrypt

### Social Media
- **Reddit**: 10 subreddits (stocks, investing, wallstreetbets, SecurityAnalysis, StockMarket, options, dividends, ValueInvesting, ETFs, Superstonk)
- **StockTwits**: Native bullish/bearish sentiment counts
- **X / Twitter**: Via Nitter (3 fallback instances)

Every social post receives a **manipulation score** (0–100):
- 0–30: Genuine organic signal
- 30–60: Biased but informative
- 60+: Likely coordinated pump/dump attempt

A flagged pump attempt is **itself** a signal — it predicts that someone wants the price to move in that direction.

---

## API Reference

The backend exposes a REST API on port 5001. All routes return `{ "success": true/false, "data": ... }`.

### Projects — `/api/projects/`

```
GET    /api/projects/           List all projects
POST   /api/projects/           Create project
GET    /api/projects/<id>        Get project detail
PUT    /api/projects/<id>        Update project
DELETE /api/projects/<id>        Delete project
POST   /api/projects/<id>/reset  Reset to re-run analysis
POST   /api/projects/<id>/upload Upload research file
DELETE /api/projects/<id>/files/<filename>  Remove uploaded file
```

### Graph Build — `/api/graph/`

```
POST /api/graph/build            Start pipeline (returns task_id)
GET  /api/graph/task/<task_id>   Poll build progress (via /api/tasks/)
GET  /api/graph/<project_id>     Get graph summary + stats
GET  /api/graph/<project_id>/nodes  List all nodes (filter: ?type=specialist)
GET  /api/graph/<project_id>/signals  List all agent signal votes
DELETE /api/graph/<project_id>   Clear graph for rebuild
```

### Simulation — `/api/simulation/`

```
POST /api/simulation/                     Create simulation from project
GET  /api/simulation/                     List all simulations
GET  /api/simulation/history              Enriched history for dashboard
GET  /api/simulation/<id>                 Get full simulation
DELETE /api/simulation/<id>               Delete simulation

POST /api/simulation/<id>/prepare         Extract agent profiles (async)
GET  /api/simulation/<id>/profiles        List agent profiles
GET  /api/simulation/<id>/profiles/<aid>  Get single agent profile
GET  /api/simulation/<id>/status          Real-time status

POST /api/simulation/<id>/interview       Interview one agent
POST /api/simulation/<id>/interview/batch Interview multiple agents
POST /api/simulation/<id>/interview/all   Ask all agents same question
GET  /api/simulation/<id>/interview/history  All interview results
```

### Agents — `/api/agents/`

```
GET    /api/agents/        List all agents
POST   /api/agents/        Create agent
GET    /api/agents/<id>    Get agent
PUT    /api/agents/<id>    Update agent
DELETE /api/agents/<id>    Delete agent
POST   /api/agents/<id>/test  Test connectivity
```

### Tasks — `/api/tasks/`

```
GET /api/tasks/      List all tasks
GET /api/tasks/<id>  Get task status + result
```

Tasks have status: `pending` → `running` → `completed` or `failed`.
Progress is broadcast via SocketIO (`task_update` events) for real-time UI updates.
The frontend also falls back to polling if WebSocket is unavailable.

### Market — `/api/market/`

```
GET /api/market/price/<symbol>     Current price
GET /api/market/history/<symbol>   OHLCV history (?days=30)
```

---

## Configuration

### Environment Variables (`backend/.env`)

Created automatically by `python3 scripts/setup.py`. All optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5001` | Backend port |
| `FLASK_ENV` | `development` | Set to `production` for deployment |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `DATA_DIR` | `./data` | Where JSON files and uploads are stored |
| `LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG/INFO/WARNING) |
| `MAX_WORKERS` | `5` | Max concurrent agents in Phase 1 |

### Data Storage

Everything stays local. No external database.

```
data/
  agents.json       Agent configurations (API keys stored here — keep private)
  projects.json     Project records
  analyses.json     All analysis results (last 500 kept)
  simulations.json  Simulation + interview records
  uploads/
    <project_id>/   Uploaded research files per project
```

---

## Docker

```bash
docker-compose up --build
```

Backend on port 5001, frontend on port 5173 (served by nginx).

---

## Architecture

```
backend/
  app/
    api/
      agents.py       Agent CRUD
      projects.py     Project lifecycle + file uploads
      graph.py        Graph build pipeline (async, task-based)
      simulation.py   Simulation + interview API
      market.py       Price/history proxy
      tasks.py        Task status polling
    models/
      base.py         Generic JSON file store
      agent.py        Agent dataclass + built-in definitions
      project.py      Project dataclass (status lifecycle)
      task.py         Task + TaskManager (SocketIO broadcast)
      simulation.py   Simulation + interview records
    services/
      llm_client.py   13 LLM providers, JSON extraction (5 strategies), retry
      data_collector.py  All 25+ data sources, fully parallel
      graph_builder.py   SharedGraph (nodes, edges, signals)
      agent_runner.py    7 roles, full+compact prompts, retry logic
      orchestrator.py    3-phase pipeline (background thread)
      relevance.py       Asset-type relevance guidance per agent
      file_parser.py     Text extraction from PDF/DOCX/TXT/CSV/JSON
      analysis_store.py  Append-only analysis persistence
    utils/
      logger.py       Named loggers
  run.py              Entry point

frontend/src/
  pages/
    Dashboard.jsx     Latest results + graph overview
    Projects.jsx      Project management + file uploads
    Agents.jsx        Agent CRUD + provider guide
    Analyze.jsx       Full analysis runner + results viewer
    Simulation.jsx    Profile extraction + agent interviews
    History.jsx       Past analyses
  components/
    Layout.jsx        Nav + status bar
    UI.jsx            Shared primitives (Card, Badge, ProgressBar, etc.)
    Gauge.jsx         SVG probability gauge
    AgentGraph.jsx    ReactFlow intelligence graph
    AgentCard.jsx     Per-agent signal + reasoning card
  hooks/
    useSocket.js      SocketIO connection + REST polling fallback
  store/index.js      Zustand global state
  utils/api.js        Axios API client
```

---

## Troubleshooting

**Built-in agents not appearing**
Delete `data/agents.json` and restart the backend — it re-seeds the 8 free agents on startup.

**"Unparseable output" from agents**
The system auto-retries with a simpler prompt. If it happens frequently with free agents, add a Groq agent (free, much more reliable JSON output). The JSON extractor uses 5 strategies before giving up: parse as-is → strip markdown → extract `{...}` block → find object with `signal` key → prose extraction.

**Price data unavailable**
Normal without an Alpha Vantage key. Agents still work using all other data sources. For OHLCV history, get a free key at [alphavantage.co](https://www.alphavantage.co) and add it to your project.

**Social data shows 0 posts**
Reddit and Nitter can rate-limit. StockTwits is more reliable. Analysis still completes — social is one of 25+ categories.

**Analysis takes a long time**
Data collection takes 10–20 seconds (all parallel). Agent calls depend on your LLM provider — free local providers (Ollama) are fastest, free remote providers vary. Groq is typically very fast. The progress bar shows real-time status.

**Port conflict**
Change `PORT` in `backend/.env` and update the proxy target in `frontend/vite.config.js`.

**Ollama not connecting**
Set the base URL to `http://localhost:11434` (or your custom host) in the agent configuration.

---

## Disclaimer

Not financial advice. Do not make trading decisions based solely on model output. This tool provides probabilistic analysis from AI agents processing public data — it does not predict the future with certainty. Always conduct your own research and consult qualified professionals before making investment decisions.

---

## License

MIT
