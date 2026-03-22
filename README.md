# AssetFlow

**Probabilistic multi-agent asset prediction — runs entirely on your machine.**

AssetFlow coordinates a swarm of AI agents, each analyzing an asset from a different angle (macro, sentiment, supply chain, geopolitics, technicals, sector), then synthesizes their outputs into a single probability verdict: what are the odds this asset goes up, down, or sideways tomorrow?

---

## How it works

```
Market Data (price, news, history)
         │
         ▼
┌─────────────────────────────────────────┐
│           Specialist Agents             │
│  Macro │ Sentiment │ Supply Chain       │
│  Technical │ Geopolitical │ Sector      │
└─────────────────────────────────────────┘
         │  (graph of all signals)
         ▼
┌─────────────────────────────────────────┐
│           Synthesizer Agent             │
│  Weighs conflicts, computes probability │
│  Bull case / Bear case / Key risks      │
└─────────────────────────────────────────┘
         │
         ▼
  Final verdict: 67% UP / 22% DOWN / 11% SIDE
```

Every agent reasons about butterfly effects — e.g. a drought in wheat-producing regions → grain prices rise → livestock feed costs rise → protein prices shift → consumer spending patterns change → retail sector margins compress. Nothing is too indirect to consider.

---

## Requirements

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **At least one AI API key** — OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, or a local Ollama install
- That's it. No database. No cloud. Everything saves to local JSON files.

---

## Quick Start

```bash
# 1. Clone or download
git clone https://github.com/rocean007/assetflow
cd assetflow

# 2. Run setup
node scripts/setup.js

# 3. Install all dependencies
npm run install:all

# 4. Start (opens backend on :3001, frontend on :5173)
npm run dev

# 5. Open in browser
open http://localhost:5173
```

---

## First-time configuration

### Step 1 — Add an agent

Go to **Agents** tab → click **Add Agent**.

| Field | What to enter |
|-------|---------------|
| Name | Any label, e.g. "GPT-4o Mini" |
| Provider | Pick your provider |
| API Key | Your key for that provider |
| Model | Leave blank for default, or pick from dropdown |
| Role | `specialist` for analysis agents, `synthesizer` for the final verdict agent |

**Minimum setup:** One agent as `specialist` is enough to run. AssetFlow will reuse it for all 6 analytical roles.

**Recommended setup:** 2–3 agents — one fast cheap model (Groq / GPT-4o-mini) for specialists, one smarter model (GPT-4o / Claude Sonnet) as synthesizer.

**Free setup (no cost):** Use Ollama locally with llama3.2, or use OpenRouter free-tier models.

### Step 2 — Test your agents

Click **Test** next to any agent. You'll see `✓ connected` or an error message. Fix API keys before running analysis.

### Step 3 — Run your first analysis

Go to **Analyze** tab:

| Field | Example |
|-------|---------|
| Symbol | `AAPL`, `BTC-USD`, `EURUSD=X`, `GC=F` (Gold) |
| Name | Apple Inc. (optional, for display) |
| Asset Type | equity / crypto / forex / commodity / index / etf |
| Alpha Vantage Key | Optional — get a free key at alphavantage.co for better price data |

Click **▶ Run Analysis**. Progress updates live. Takes 30–120 seconds depending on agent speed.

---

## Supported providers

| Provider | Free tier | Speed | Best for |
|----------|-----------|-------|----------|
| **OpenAI** | No | Fast | GPT-4o-mini (specialists), GPT-4o (synthesizer) |
| **Anthropic** | No | Fast | Claude Haiku (specialists), Claude Sonnet (synthesizer) |
| **Google Gemini** | Yes (1.5 Flash) | Very fast | Free high-quality specialists |
| **Groq** | Yes | Extremely fast | Llama 3.1 — best free option |
| **OpenRouter** | Yes (some models) | Varies | Access to 100+ models via one key |
| **Ollama** | Free (local) | Depends on hardware | Full privacy, no API costs |

### Getting API keys

- **OpenAI:** platform.openai.com → API keys
- **Anthropic:** console.anthropic.com → API keys
- **Google:** aistudio.google.com → Get API key
- **Groq:** console.groq.com → API keys (free, fast)
- **OpenRouter:** openrouter.ai → Keys (many free models)
- **Ollama:** Install from ollama.com, run `ollama pull llama3.2`, use base URL `http://localhost:11434`
- **Alpha Vantage:** alphavantage.co/support/#api-key (free, for better price/history data)

---

## Multi-agent configuration patterns

### Budget setup (free)
```
2 agents total:
  - Groq / llama-3.3-70b-versatile → role: specialist
  - Groq / llama-3.3-70b-versatile → role: synthesizer
```

### Balanced setup
```
3 agents total:
  - GPT-4o-mini → role: specialist  (fast, cheap for 6 roles)
  - GPT-4o → role: synthesizer      (smarter for final verdict)
  - Gemini 1.5 Flash → role: specialist (backup / parallel)
```

### Power setup
```
7 agents total (one per role + synthesizer):
  - Macro analyst → GPT-4o-mini
  - Sentiment → Claude Haiku
  - Supply Chain → Gemini Flash
  - Technical → Groq Llama
  - Geopolitical → GPT-4o-mini
  - Sector → Claude Haiku
  - Synthesizer → Claude Sonnet or GPT-4o
```

### Privacy-first (fully local)
```
2 agents, both Ollama:
  - ollama / llama3.2 or mistral → specialist
  - ollama / llama3.2 → synthesizer
  Base URL: http://localhost:11434
```

---

## Data storage

All data lives in `./data/` (created automatically):

```
data/
  agents.json     ← your agent configs (API keys stored locally, never sent anywhere)
  analyses.json   ← past analysis results (last 500)
```

To back up your agents and history, just copy the `data/` folder.

To reset everything: delete `data/agents.json` and/or `data/analyses.json`.

---

## Running in production (Docker)

```bash
# Build and run with Docker Compose
docker-compose up --build

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

---

## Deploying to Vercel

AssetFlow includes a `vercel.json`. To deploy:

```bash
npm install -g vercel
vercel login
vercel --prod
```

Note: Vercel deployment is stateless (no persistent `data/` folder). It works for demos but agent configs won't persist between deployments. For persistent use, run locally or on a VPS.

---

## Environment variables

Create `backend/.env` (copied automatically from `.env.example` during setup):

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

No other env vars needed — all API keys are stored per-agent in `data/agents.json`.

---

## What AssetFlow is not

- It is **not financial advice**. Probabilities are model outputs, not guarantees.
- It is **not a trading bot**. It produces analysis; you make the decision.
- It does **not execute trades** or connect to brokers.
- Past analysis results do **not** imply future prediction accuracy.

Always do your own research.

---

## Troubleshooting

**"No agents configured"** → Go to Agents tab, add at least one agent.

**Agent test fails** → Check API key, model name, and that you have credits. For Ollama, make sure `ollama serve` is running.

**Price data shows as unavailable** → This is normal without an Alpha Vantage key. Add a free key in the analysis form for better data. The agents still work with news-only context.

**Analysis takes too long** → Use faster/cheaper models (Groq, Gemini Flash) for specialist agents. The synthesizer benefits from a smarter model but specialists don't need to be.

**Port already in use** → Change `PORT` in `backend/.env` and update `vite.config.js` proxy target.

---

## License

MIT — use, modify, and distribute freely.
