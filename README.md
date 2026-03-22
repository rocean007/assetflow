# AssetFlow

**Probabilistic multi-agent asset intelligence — runs entirely on your machine.**

A two-phase swarm intelligence system. Unlimited AI agents independently analyze an asset from every angle — macro, sentiment, social media, supply chain, technical, geopolitical, sector — each writing into a shared intelligence graph. Then a single synthesizer reads the complete graph and produces a probability verdict with full reasoning.

No database. No cloud. All data stays local.

---

## How it works

```
┌─────────────────────────────────────────────────────────┐
│  PRE-FETCH (parallel, runs once per analysis)           │
│                                                         │
│  Market     Price + OHLCV history + financial news      │
│  World      Weather (8 agri regions) + commodities      │
│  State      Shipping BDI + conflicts + central banks    │
│             Agriculture + energy + trade + econ cal     │
│  Social     Reddit (5 subs) + X/Nitter + StockTwits    │
│             + HackerNews — all manipulation-scored      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (same context given to ALL agents)
┌─────────────────────────────────────────────────────────┐
│  PHASE 1 — All agents write to SharedGraph              │
│                                                         │
│  Macro Economist      ─┐                               │
│  Sentiment Analyst    ─┤                               │
│  Social Intelligence  ─┼──→ SharedGraph                │
│  Supply Chain         ─┤    (nodes + causal edges       │
│  Technical Analyst    ─┤     + signal votes)           │
│  Geopolitical Risk    ─┤                               │
│  Sector Specialist    ─┘                               │
│                                                         │
│  No agent sees another agent's output.                  │
│  Add 1 agent or 1,000 — they all write independently.   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (complete graph — all nodes + edges)
┌─────────────────────────────────────────────────────────┐
│  PHASE 2 — Synthesizer reads the complete graph         │
│                                                         │
│  Reads: all signal votes, causal edge chains,           │
│         butterfly effect nodes, manipulation flags      │
│                                                         │
│  Outputs: upProbability / downProbability / side        │
│           bull case / bear case / key risks             │
│           top butterfly chains / social assessment      │
│           world state highlights / signal conflicts     │
└─────────────────────────────────────────────────────────┘
```

### The butterfly effect model

Every agent is instructed to trace indirect causal chains — not just read headlines. The supply chain agent, for example, receiving a world state weather alert, might reason:

```
Heavy rain in Brazil soy belt (world state weather alert)
  → soy harvest delayed → supply shock
  → feed grain costs rise
  → livestock feed more expensive → protein prices up
  → food inflation tick up
  → consumer discretionary spending squeezed
  → retail sector margin pressure
  → [asset if retail-exposed] = bearish signal
```

This entire chain is written as structured `edgeClaims` into the shared graph. The synthesizer reads it.

### Social media — credible signal vs manipulation

Every social post is scored 0–100 for manipulation risk based on: price targets without reasoning, rocket/moon language, all-caps urgency, "NFA" paired with strong directional claims, suspiciously rapid upvote velocity, and cross-platform timing patterns.

- **Score < 40** — credible, included in full agent context
- **Score 40–70** — suspicious, shown with warning
- **Score > 70** — likely coordinated pump/dump — shown as manipulation attempt

Critically: a detected manipulation attempt is itself a signal. If 80% of posts about a stock are flagged as pump attempts, someone wants the price to move — the synthesizer factors this in.

---

## Requirements

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **At least one AI API key** — or a local Ollama install (completely free)
- Nothing else. No database, no cloud services, no required paid APIs.

---

## Quick start

```bash
# 1. Clone or download and extract
cd assetflow

# 2. Run setup (creates data/ and backend/.env)
node scripts/setup.js

# 3. Install all dependencies
npm run install:all

# 4. Start everything
npm run dev

# 5. Open
open http://localhost:5173
```

---

## First-time configuration

### Step 1 — Add agents

Go to **Agents** tab → **Add Agent**.

**Minimum:** One agent set to `specialist`. It will be reused for all 7 analytical roles.

**Recommended:** Two agents — one cheap/fast model for specialists, one smarter model as synthesizer.

**Best:** 7 agents — one per role plus a strong synthesizer.

| Field | What to enter |
|-------|---------------|
| Name | Any label you want |
| Provider | Your LLM provider |
| API Key | Your key for that provider |
| Model | Leave blank for default |
| Role | `specialist` for analysis, `synthesizer` for final verdict |

### Step 2 — Test your agents

Click **Test** next to any agent. You should see `✓ connected`. Fix any issues before running analysis.

### Step 3 — Run analysis

Go to **Analyze** tab:

| Field | Example |
|-------|---------|
| Symbol | `AAPL`, `BTC-USD`, `EURUSD=X`, `GC=F` (Gold), `CL=F` (Oil) |
| Name | Optional display name |
| Asset Type | equity / crypto / forex / commodity / index / etf |
| Alpha Vantage Key | Optional — free key at alphavantage.co gives better price data |

Click **Run Analysis**. Progress updates live via WebSocket. Takes 45–180 seconds.

---

## Data sources (all free, no keys required unless noted)

### Market data
| Source | Data | Key needed |
|--------|------|-----------|
| Yahoo Finance | Price, OHLCV history | No |
| Alpha Vantage | Price, OHLCV history | Optional (free) |
| Reuters, Yahoo, CNBC, MarketWatch RSS | Financial news | No |

### World state
| Source | Data | Key needed |
|--------|------|-----------|
| Open-Meteo | Weather forecasts (8 regions) | No |
| Yahoo Finance futures | 10 commodity prices | No |
| ReliefWeb RSS | Conflict/humanitarian alerts | No |
| UN News RSS | Geopolitical events | No |
| USDA RSS | Agricultural reports | No |
| FAO RSS | Food/agriculture news | No |
| EIA RSS | Energy sector news | No |
| Federal Reserve RSS | Central bank communications | No |
| ECB RSS | European monetary policy | No |
| WTO RSS | Trade/tariff news | No |
| IMF RSS | Global economic outlook | No |
| Investing.com RSS | Economic calendar | No |
| FreightWaves RSS | Shipping/freight news | No |

### Social media
| Source | Data | Key needed |
|--------|------|-----------|
| Reddit JSON API | r/stocks, r/investing, r/wallstreetbets, r/SecurityAnalysis, r/StockMarket | No |
| Nitter RSS (3 instances) | X/Twitter posts | No |
| StockTwits API | Posts + native bullish/bearish sentiment | No |
| HackerNews Algolia | Tech/company discussion | No |

---

## Supported LLM providers

| Provider | Free tier | Speed | Best for |
|----------|-----------|-------|----------|
| **OpenAI** | No | Fast | GPT-4o-mini specialists, GPT-4o synthesizer |
| **Anthropic** | No | Fast | Claude Haiku specialists, Claude Sonnet synthesizer |
| **Google Gemini** | Yes (1.5 Flash) | Very fast | Free high-quality specialists |
| **Groq** | Yes | Extremely fast | Best free option — Llama 3.3 70B |
| **OpenRouter** | Yes (some models) | Varies | 100+ models via one key |
| **Ollama** | Free (local) | Hardware-dependent | Complete privacy, zero cost |

### Getting API keys

- **OpenAI:** platform.openai.com → API keys
- **Anthropic:** console.anthropic.com → API keys
- **Google:** aistudio.google.com → Get API key
- **Groq:** console.groq.com (free, fast)
- **OpenRouter:** openrouter.ai (many free models)
- **Ollama:** ollama.com → install, run `ollama pull llama3.2`, use base URL `http://localhost:11434`
- **Alpha Vantage:** alphavantage.co/support/#api-key (free tier, for better price data)

---

## Agent configuration patterns

### Free, zero cost
```
2 agents:
  Groq / llama-3.3-70b-versatile → specialist
  Groq / llama-3.3-70b-versatile → synthesizer
```

### Balanced (~$0.01–0.05 per run)
```
2 agents:
  GPT-4o-mini → specialist  (handles all 7 analytical roles)
  GPT-4o      → synthesizer
```

### High coverage (~$0.05–0.20 per run)
```
7 agents (one per role + synthesizer):
  GPT-4o-mini    → specialist  (used for: macro, supply chain, technical)
  Claude Haiku   → specialist  (used for: sentiment, social, geopolitical, sector)
  Claude Sonnet  → synthesizer
```

### Full privacy, zero cost (local)
```
2 agents, both Ollama:
  ollama / llama3.2  → specialist
  ollama / llama3.2  → synthesizer
  Base URL: http://localhost:11434
```

### Maximum signal (power setup)
```
8+ agents:
  GPT-4o-mini  × 3 → specialists
  Gemini Flash × 2 → specialists
  Groq Llama   × 2 → specialists
  GPT-4o           → synthesizer
  
  With 8 agents all writing to the graph independently, the synthesizer
  receives a richer graph with more causal diversity and cross-validation.
```

---

## Data persistence

Everything lives in `./data/` (created on first run):

```
data/
  agents.json      ← agent configs (API keys stored locally only)
  analyses.json    ← past analysis results (last 500 kept)
```

To back up: copy the `data/` folder.  
To reset agents: delete `data/agents.json`.  
To reset history: delete `data/analyses.json`.

---

## Docker (production local run)

```bash
docker-compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

---

## Vercel deployment

```bash
npm install -g vercel
vercel login
vercel --prod
```

Note: Vercel is stateless — agent configs won't persist between cold starts. Best for demos. For persistent local use, run with `npm run dev` or Docker.

---

## Environment variables

`backend/.env` (auto-created from `.env.example` during setup):

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

All API keys are stored per-agent in `data/agents.json`. No other env vars needed.

---

## Troubleshooting

**"No agents configured"** → Go to Agents tab, add at least one agent.

**Agent test fails** → Verify API key and model name. For Ollama: ensure `ollama serve` is running and the model is pulled (`ollama pull llama3.2`).

**Price data unavailable** → Normal without Alpha Vantage key. Agents still work — they use news and world state context. Add a free Alpha Vantage key in the analysis form for OHLCV data.

**Social data shows 0 posts** → Reddit and Nitter can be rate-limited or have intermittent availability. StockTwits and HackerNews are more reliable. The analysis still runs without social data.

**World state partial** → Some RSS feeds are occasionally down. The system logs what succeeded and proceeds. Even partial world state significantly enriches agent context.

**Analysis runs slowly** → Use Groq (fastest) or Gemini Flash for specialists. The synthesizer benefits from a stronger model but specialists don't need to be expensive.

**Port conflict** → Change `PORT` in `backend/.env` and update the proxy target in `frontend/vite.config.js`.

---

## What AssetFlow is not

- Not financial advice. Probabilities are model outputs, not guarantees.
- Not a trading bot. It produces analysis — you make decisions.
- Does not execute trades or connect to brokers.
- Social signals are informational — the manipulation scoring reduces but does not eliminate noise.

---

## License

MIT
