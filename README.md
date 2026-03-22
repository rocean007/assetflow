# AssetFlow

A multi-agent probabilistic asset prediction platform that runs entirely on your machine. Every analysis pulls from 25+ real-time data categories — price history, financial news, weather across 12 agricultural regions, 30 commodity prices, social media from 4 platforms, central bank feeds, geopolitical alerts, regulatory news, shipping indices, earnings data, options flow, insider transactions, and more. AI agents reason about all of it, trace butterfly effect chains, write to a shared intelligence graph, then a synthesizer reads the complete graph and produces a probability verdict.

---

## Requirements

- **Node.js 18 or higher** — download at [nodejs.org](https://nodejs.org)
- **Yarn** — install with `npm install -g yarn`
- **At least one AI API key**, or Ollama installed locally (free, no key needed)

---

## Installation

```bash
# 1. Extract the zip, then enter the folder
cd assetflow

# 2. Run setup (creates data/ folder and backend/.env)
node scripts/setup.js

# 3. Install all dependencies
yarn install

# 4. Start both backend and frontend
yarn dev
```

Open **http://localhost:5173** in your browser.

---

## First run — three steps

### Step 1: Add an agent

Go to the **Agents** tab. Click **Add Agent** and fill in:

| Field | What to put |
|-------|-------------|
| Name | Any label, e.g. `GPT-4o Mini` |
| Provider | Choose from the list |
| API Key | Your key for that provider |
| Model | Leave blank for default, or pick from the dropdown |
| Role | `specialist` for analysis agents; `synthesizer` for the final verdict |

Save the agent. If you only have one, AssetFlow will use it for everything.

### Step 2: Test it

Click **Test** next to the agent. You should see `✓ ok`. If not, check the API key.

### Step 3: Run analysis

Go to the **Analyze** tab. Enter a symbol and click **Run Analysis**.

| Symbol examples | |
|---|---|
| `AAPL` | Apple stock |
| `BTC-USD` | Bitcoin |
| `GC=F` | Gold futures |
| `CL=F` | Crude oil |
| `EURUSD=X` | Euro/USD forex |
| `^SPX` | S&P 500 index |

Analysis takes 60–180 seconds depending on how many agents you have and their speed.

---

## Agent roles explained

AssetFlow has three phases. Each agent role belongs to one phase:

**Phase 1 — Specialists** (all run in parallel, write to shared graph independently)

| Role | What it analyzes |
|------|-----------------|
| `specialist` | Auto-assigned round-robin to the 7 roles below |
| `macro` | Interest rates, inflation, GDP, central banks, yield curves, currencies |
| `sentiment` | News narratives, fear/greed, options flow, insider transactions, short interest |
| `social_sentiment` | Reddit/X/StockTwits/HackerNews — deep manipulation detection |
| `supply_chain` | Weather alerts, commodity prices, shipping, agriculture, energy |
| `technical` | Price action, momentum, volume, support/resistance, RSI estimation |
| `geopolitical` | Conflicts, sanctions, trade policy, regulatory actions, diplomacy |
| `sector` | Earnings, analyst ratings, insider trades, competitive dynamics |

**Phase 2 — Synthesizers** (read the complete assembled graph)

| Role | What it does |
|------|-------------|
| `synthesizer` | Reads all agent nodes + causal edges, produces probability verdict |

**Phase 3 — Super Synthesizer** (optional, reconciles multiple synthesizer verdicts)

| Role | What it does |
|------|-------------|
| `super_synthesizer` | If you have multiple synthesizers, this reconciles them into one final verdict |

---

## Supported AI providers

| Provider | Free tier | Notes |
|----------|-----------|-------|
| **Groq** | Yes | Fast, free — best option for getting started. Get key at console.groq.com |
| **Google Gemini** | Yes | Gemini 1.5 Flash is free. Get key at aistudio.google.com |
| **OpenRouter** | Some models free | Many free models. Get key at openrouter.ai |
| **Ollama** | Free (local) | Runs on your machine, no internet needed. Install at ollama.com |
| **OpenAI** | No | GPT-4o-mini is cheap. Get key at platform.openai.com |
| **Anthropic** | No | Claude Haiku is fast and affordable. Get key at console.anthropic.com |

### Getting started for free

The fastest zero-cost setup uses Groq:

1. Go to [console.groq.com](https://console.groq.com) and create a free account
2. Generate an API key
3. In AssetFlow, add an agent: Provider = **Groq**, API Key = your key, Role = **specialist**
4. Add a second agent with the same key, Role = **synthesizer**
5. Run analysis

For Ollama (fully local, no API key):

1. Install from [ollama.com](https://ollama.com)
2. Run: `ollama pull llama3.2`
3. In AssetFlow, add an agent: Provider = **Ollama (local, free)**, Base URL = `http://localhost:11434`, Model = `llama3.2`

---

## Recommended configurations

**Minimum (1 agent, free with Groq):**
```
Agent 1: Groq / llama-3.3-70b-versatile / role: specialist
         (AssetFlow reuses this for all roles including synthesis)
```

**Balanced (2 agents):**
```
Agent 1: Groq / llama-3.3-70b-versatile / role: specialist
Agent 2: Groq / llama-3.3-70b-versatile / role: synthesizer
```

**Better quality (3 agents):**
```
Agent 1: GPT-4o-mini / role: specialist   (handles all 7 specialist roles)
Agent 2: Gemini 1.5 Flash / role: specialist  (adds variety to Phase 1)
Agent 3: GPT-4o / role: synthesizer
```

**Full coverage (9 agents — one per specialist role + synthesizer + super):**
```
Agents 1–7: One agent per specialist role (macro, sentiment, social_sentiment,
             supply_chain, technical, geopolitical, sector)
Agent 8:    synthesizer
Agent 9:    super_synthesizer
```

---

## Optional: Better price data

By default AssetFlow fetches price data from Yahoo Finance for free. For more accurate OHLCV history, get a free Alpha Vantage key:

1. Go to [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Enter the key in the **Alpha Vantage Key** field when running analysis

---

## Data sources

AssetFlow fetches from 25+ categories on every run. None require API keys.

**Market data:** Yahoo Finance price + history, Alpha Vantage (optional), options chain, analyst ratings, earnings calendar, insider transactions, short interest

**Financial news (20 RSS feeds):** Reuters, Yahoo Finance, CNBC, MarketWatch, Bloomberg Economics, NYT Business, Financial Times, WSJ, Seeking Alpha, Investing.com, ZeroHedge, Motley Fool, TheStreet, Dow Jones

**Macro/central banks (12 feeds):** Federal Reserve, ECB, Bank of Japan, Bank of England, BIS, IMF, World Bank, OECD, BLS (jobs/CPI), BEA (GDP), US Treasury, CBO

**Weather (Open-Meteo, free):** 12 regions — US Midwest corn belt, Great Plains wheat, Ukraine/Black Sea wheat, Brazil soy/coffee/sugar, India wheat/rice, Australia wheat/coal, Indonesia palm oil, Texas/Gulf oil+gas, North Sea oil, China, Argentina soy, West Africa cocoa

**Commodities (30 instruments):** Gold, Silver, Platinum, WTI/Brent crude, Natural Gas, Wheat, Corn, Soybeans, Oats, Coffee, Cotton, Cocoa, Sugar, Live Cattle, Lean Hogs, Copper, Aluminum, USD Index, Bitcoin, Ethereum, VIX, US yields (3M/10Y/30Y), EUR/USD, USD/JPY, GBP/USD, USD/CNY

**Agriculture (7 feeds):** USDA, FAO, AgWeb, Farm Progress, Agriculture.com, World Grain, Coffee Review

**Energy (7 feeds):** EIA, OilPrice.com, Oil & Gas Journal, Natural Gas Intel, PV-Tech Solar, Electrek, Renewable Energy World

**Shipping/trade (6 feeds):** Splash247, TradeWinds, FreightWaves, Hellenic Shipping News, Lloyd's List, Journal of Commerce + Baltic Dry Index price

**Geopolitical (9 feeds):** ReliefWeb, UN News, ICG Crisis Group, CFR, Foreign Policy, Chatham House, Reuters World, Al Jazeera, BBC World

**Regulatory (6 feeds):** SEC, CFTC, FTC, FDA, Federal Register, EU Parliament

**Tech/innovation (8 feeds):** HackerNews, TechCrunch, Ars Technica, The Verge, VentureBeat, Reuters Tech, NYT Tech, Wired

**Healthcare/pharma (5 feeds):** FDA Press Releases, STAT News, Reuters Health, Fierce Pharma, BioPharma Dive

**Consumer/retail (4 feeds):** Reuters Consumer, ConsumerAffairs, NRF Retail, Chain Store Age

**ESG/environment (3 feeds):** ESG Today, Carbon Brief, Climate Change News

**Social media:** Reddit (10 subreddits: stocks, investing, wallstreetbets, SecurityAnalysis, StockMarket, options, dividends, ValueInvesting, ETFs, Superstonk), StockTwits (with native bullish/bearish sentiment), X/Twitter via Nitter RSS mirrors, HackerNews — all posts scored for manipulation risk

**Crypto (when relevant):** CoinTelegraph, Decrypt, CoinDesk, Alternative.me Fear & Greed Index

---

## Where data is stored

Everything stays on your computer:

```
data/
  agents.json      — your agent configurations (API keys stored locally)
  analyses.json    — past analysis results (last 500 kept automatically)
```

To back up your data: copy the `data/` folder.  
To reset agents: delete `data/agents.json`.  
To reset history: delete `data/analyses.json`.

---

## Running with Docker

```bash
docker-compose up --build
```

Frontend runs at http://localhost:5173, backend at http://localhost:3001.

---

## Environment variables

`backend/.env` is created automatically during setup. Default contents:

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

No other variables needed. All API keys are stored per-agent.

---

## Troubleshooting

**"No agents configured"** — Go to the Agents tab and add at least one agent.

**Agent test fails** — Double-check the API key. For Ollama, make sure the Ollama app is running (`ollama serve`) and you've pulled the model (`ollama pull llama3.2`).

**Price shows as unavailable** — Normal without an Alpha Vantage key. Agents still run using news and world-state context. Add a free Alpha Vantage key for OHLCV data.

**Social data shows 0 posts** — Reddit and Nitter instances can be rate-limited. StockTwits and HackerNews are more reliable. Analysis still completes without social data.

**Analysis is slow** — Use Groq (fastest available) or Gemini Flash for specialist agents. The synthesizer benefits from a smarter model but specialists can be cheap/fast.

**Port already in use** — Edit `PORT` in `backend/.env` and update the proxy target in `frontend/vite.config.js` to match.

**yarn not found** — Run `npm install -g yarn` first.

---

## Disclaimer

AssetFlow is a research and analysis tool. Output is probabilistic model-generated content, not financial advice. Do not make trading decisions based solely on its output.
