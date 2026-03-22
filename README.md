# AssetFlow

Probabilistic multi-agent asset intelligence. Python/Flask backend, React frontend.

Every analysis fetches 25+ real-time data categories in parallel — price, OHLCV history, options flow, analyst ratings, earnings, insider trades, 20 financial news feeds, 12 central bank feeds, weather across 12 agricultural regions, 30 commodity prices, shipping indices, social media from Reddit/StockTwits/X, geopolitical alerts, regulatory news, and more. AI agents reason about all of it, trace butterfly effect chains, write to a shared graph, then a synthesizer reads the complete graph and produces a probability verdict.

**Comes with 8 built-in free agents. No API key needed to run.**

---

## Requirements

- Python 3.10+ — [python.org](https://python.org)
- Node.js 18+ — [nodejs.org](https://nodejs.org)
- Yarn — `npm install -g yarn`

---

## Quick start

```bash
# 1. Setup
python scripts/setup.py

# 2. Backend
cd backend
pip install -r requirements.txt
python run.py
# Runs on http://localhost:5001

# 3. Frontend (new terminal)
cd frontend
yarn install
yarn dev
# Opens http://localhost:5173
```

Open **http://localhost:5173**. The built-in free agents are pre-configured. Go to **Analyze**, enter a symbol, click **Run Analysis**.

---

## How it works

```
All world data fetched in parallel (price, news, weather, social, commodities...)
                    │
          ┌─────────▼─────────┐
          │    Phase 1        │  All specialist agents run concurrently.
          │    SharedGraph    │  Each writes nodes + causal edges independently.
          │                   │  No agent sees another's output.
          └─────────┬─────────┘
                    │  (complete graph: all nodes, edges, signal votes)
          ┌─────────▼─────────┐
          │    Phase 2        │  Synthesizer reads the ENTIRE graph.
          │    Synthesizer(s) │  Produces probability verdict + analysis.
          └─────────┬─────────┘
                    │  (optional, if multiple synthesizers)
          ┌─────────▼─────────┐
          │    Phase 3        │  Super Synthesizer reconciles
          │    Super Synth    │  multiple synthesizer verdicts.
          └───────────────────┘
```

### Butterfly effect model

Every agent is instructed to trace indirect causal chains:

```
Weather alert: DROUGHT in US Midwest corn belt
  → corn supply drops → feed grain shortage
  → livestock feed more expensive → protein prices rise
  → food inflation tick up → consumer spending squeezed
  → retail sector margin pressure
  → [if asset is retail-exposed] → bearish signal
```

This chain is written as structured edge claims into the shared graph. The synthesizer reads the entire causal network.

---

## Built-in free agents

These are pre-installed with no configuration required:

| Agent | Provider | Role |
|-------|----------|------|
| Macro Agent | Pollinations.ai (Mistral) | macro |
| Sentiment Agent | Pollinations.ai (Mistral) | sentiment |
| Supply Chain Agent | Pollinations.ai (Mistral) | supply_chain |
| Technical Agent | Pollinations.ai (Mistral) | technical |
| Geopolitical Agent | Pollinations.ai (Mistral) | geopolitical |
| Sector Agent | Pollinations.ai (Mistral) | sector |
| Social Agent | Pollinations.ai (Mistral) | social_sentiment |
| Synthesizer | HuggingFace Zephyr-7B | synthesizer |

These use small models. For higher-quality analysis, add your own agents with GPT-4o, Claude Sonnet, or Groq.

---

## Adding better agents

Go to **Agents** tab → Add Agent.

| Provider | Free | Notes |
|----------|------|-------|
| **Pollinations.ai** | ★ Free, no key | Default built-in. Works instantly. |
| **HuggingFace Free** | ★ Free, no key | Zephyr-7B, Mistral-7B |
| **Together.ai Free** | ★ Free, no key | Qwen 2.5 |
| **Groq** | Free signup | Best free quality. console.groq.com |
| **Google Gemini** | Free tier | aistudio.google.com |
| **OpenRouter** | Free models | openrouter.ai |
| **Ollama** | Free (local) | ollama.com — full privacy |
| **OpenAI** | Paid | Best quality |
| **Anthropic** | Paid | Best reasoning |
| **DeepSeek** | Near-free | $0.00014/1K tokens |

### Recommended upgrade (better quality, still mostly free)

```
Add 2 agents:
  Groq / llama-3.3-70b-versatile / role: specialist
  Groq / llama-3.3-70b-versatile / role: synthesizer

Disable the built-in Pollinations agents if you want to use only Groq.
```

### Best setup

```
7 specialist agents (one per role):
  macro, sentiment, social_sentiment, supply_chain, technical, geopolitical, sector
  → use Groq or Gemini Flash (fast + free)

1 synthesizer:
  → use GPT-4o or Claude Sonnet (smarter for final verdict)

Optional: 1 super_synthesizer for reconciling multiple synthesizer verdicts
```

---

## Agent roles

**Phase 1 — Specialists (unlimited, all write to graph):**

| Role | Analyzes |
|------|---------|
| `specialist` | Auto round-robin assigned to all 7 roles below |
| `macro` | Interest rates, inflation, GDP, central banks, yield curves |
| `sentiment` | News narratives, fear/greed, options P/C ratio, insider trades |
| `social_sentiment` | Reddit (10 subs), StockTwits, X — manipulation-scored |
| `supply_chain` | Weather (12 regions), commodities, shipping BDI, agriculture |
| `technical` | OHLCV price action, momentum, volume, RSI, support/resistance |
| `geopolitical` | Conflicts, sanctions, trade policy, regulatory actions |
| `sector` | Earnings, analysts, insiders, M&A, competitive dynamics |

**Phase 2 — Synthesizer:** reads complete assembled graph → verdict

**Phase 3 — Super Synthesizer:** reconciles multiple synthesizer verdicts (optional)

---

## Data sources

All free. No API key required unless noted.

**Market:** Yahoo Finance price + history, Alpha Vantage (optional), options chain, analyst ratings, earnings calendar, insider transactions, short interest

**News (20 feeds):** Reuters, Yahoo Finance, CNBC, MarketWatch, Bloomberg Economics, NYT Business, FT, WSJ, Seeking Alpha, Investing.com, ZeroHedge, Motley Fool, TheStreet, Dow Jones, TechCrunch, Ars Technica, VentureBeat, HackerNews

**Central banks/macro (12 feeds):** Federal Reserve, ECB, Bank of Japan, Bank of England, BIS, IMF, World Bank, OECD, BLS (jobs/CPI), BEA (GDP), WTO, US Treasury

**Weather (Open-Meteo, free):** US Midwest corn belt, Great Plains wheat, Ukraine wheat, Brazil soy/coffee, India wheat/rice, Australia wheat, Indonesia palm oil, Texas oil/gas, North Sea crude, China manufacturing, Argentina soy, West Africa cocoa

**Commodities (30):** Gold, Silver, Platinum, WTI/Brent crude, Natural Gas, Wheat, Corn, Soybeans, Coffee, Cotton, Cocoa, Sugar, Live Cattle, Lean Hogs, Copper, USD Index, Bitcoin, Ethereum, VIX, US yields, EUR/USD, USD/JPY, GBP/USD, USD/CNY, Baltic Dry Index

**Agriculture:** USDA, FAO, AgWeb, World Grain

**Energy:** EIA, OilPrice, Electrek, PV-Tech

**Shipping:** FreightWaves, Splash247, Hellenic Shipping News + Baltic Dry Index

**Geopolitical:** ReliefWeb, UN News, CFR, Foreign Policy, Al Jazeera, BBC World

**Regulatory:** SEC 8-K filings, CFTC, FTC, FDA press releases

**Healthcare:** STAT News, Fierce Pharma, BioPharma Dive

**Consumer:** NRF Retail, ConsumerAffairs

**ESG:** ESG Today, Carbon Brief

**Social:** Reddit (10 subs), StockTwits (native sentiment), X/Nitter (3 instances), HackerNews

**Crypto:** CoinTelegraph, Decrypt, CoinDesk

**Labor:** BLS employment, Layoffs.fyi

---

## Data storage

Everything stays local:

```
data/
  agents.json     — agent configs (API keys stored locally only)
  analyses.json   — past results (last 500 kept)
```

---

## Environment variables

`backend/.env` (auto-created by setup):

```
PORT=5001
FLASK_ENV=development
FRONTEND_URL=http://localhost:5173
DATA_DIR=./data
```

---

## Docker

```bash
docker-compose up --build
```

---

## Troubleshooting

**"Unparseable output" from agents** — This means the LLM didn't return valid JSON. The system has automatic retry with a simpler prompt. If it keeps happening with free built-in agents, add a Groq agent (free) for better reliability.

**Built-in agents not appearing** — Delete `data/agents.json` and restart the backend. It will re-seed the free agents.

**Price unavailable** — Normal without Alpha Vantage key. Agents still work using news + world state context. Enter a free AV key at alphavantage.co for OHLCV data.

**Social data shows 0** — Reddit/Nitter can be rate-limited. StockTwits is more reliable. Analysis still completes.

**Port conflict** — Change `PORT` in `backend/.env` and update the proxy target in `frontend/vite.config.js`.

---

## Disclaimer

Not financial advice. Do not make trading decisions based solely on model output.
