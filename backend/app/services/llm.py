"""
LLM Client - all providers use OpenAI-compatible API format.
Confirmed working providers (2025/2026):
  groq        - llama-3.3-70b-versatile (fast, free signup, best choice)
  openrouter  - many :free models (free, no CC)
  google      - gemini-1.5-flash (free tier, AI Studio key)
  mistral     - mistral-small-latest (free tier)
  together    - meta-llama/Llama-3.3-70B-Instruct-Turbo ($25 free credits)
  deepseek    - deepseek-chat (near-free, ~$0.00014/1K tokens)
  openai      - gpt-4o-mini (paid)
  anthropic   - claude-3-5-haiku-20241022 (paid)
  ollama      - any model (local, free)
  cerebras    - llama3.1-70b (fast free tier)
"""
import re, json, time, requests
from typing import Optional
from ..utils.logger import get_logger
log = get_logger('af.llm')
TIMEOUT = 60

def extract_json(raw: str) -> Optional[dict]:
    if not raw: return None
    for fn in [
        lambda: json.loads(raw.strip()),
        lambda: json.loads(re.sub(r'```(?:json)?', '', raw).replace('```','').strip()),
        lambda: json.loads(raw[raw.find('{'):raw.rfind('}')+1]) if '{' in raw else (_ for _ in ()).throw(ValueError()),
    ]:
        try:
            r = fn()
            if isinstance(r, dict): return r
        except: pass
    sig = re.search(r'\b(bullish|bearish|neutral)\b', raw, re.I)
    if sig:
        conf = re.search(r'\b(\d{1,3})\s*%', raw)
        return {'signal': sig.group(1).lower(), 'confidence': int(conf.group(1)) if conf else 50,
                'reasoning': raw[:300], 'factors': [], 'butterflies': []}
    return None

def _post(url, payload, headers=None, timeout=TIMEOUT):
    r = requests.post(url, json=payload,
                      headers=headers or {'Content-Type':'application/json'},
                      timeout=timeout)
    r.raise_for_status(); return r

def _openai_compat(base_url, api_key, model, system, user, max_tokens=2000):
    r = _post(f'{base_url}/chat/completions',
              {'model': model, 'max_tokens': max_tokens, 'temperature': 0.2,
               'messages': [{'role':'system','content':system},{'role':'user','content':user}]},
              {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'})
    return r.json()['choices'][0]['message']['content']

PROVIDERS = {
    'groq':       lambda a,m,s,u: _openai_compat('https://api.groq.com/openai/v1', a, m or 'llama-3.3-70b-versatile', s, u),
    'openrouter': lambda a,m,s,u: _openai_compat('https://openrouter.ai/api/v1', a, m or 'meta-llama/llama-3.1-8b-instruct:free', s, u),
    'google':     lambda a,m,s,u: _post(
        f'https://generativelanguage.googleapis.com/v1beta/models/{m or "gemini-1.5-flash"}:generateContent?key={a}',
        {'contents':[{'parts':[{'text':f'{s}\n\n{u}'}]}],'generationConfig':{'maxOutputTokens':2000,'temperature':0.2}}
    ).json()['candidates'][0]['content']['parts'][0]['text'],
    'mistral':    lambda a,m,s,u: _openai_compat('https://api.mistral.ai/v1', a, m or 'mistral-small-latest', s, u),
    'together':   lambda a,m,s,u: _openai_compat('https://api.together.xyz/v1', a, m or 'meta-llama/Llama-3.3-70B-Instruct-Turbo', s, u),
    'deepseek':   lambda a,m,s,u: _openai_compat('https://api.deepseek.com', a, m or 'deepseek-chat', s, u),
    'cerebras':   lambda a,m,s,u: _openai_compat('https://api.cerebras.ai/v1', a, m or 'llama3.1-70b', s, u),
    'openai':     lambda a,m,s,u: _openai_compat('https://api.openai.com/v1', a, m or 'gpt-4o-mini', s, u),
    'anthropic':  lambda a,m,s,u: _post('https://api.anthropic.com/v1/messages',
        {'model': m or 'claude-3-5-haiku-20241022','max_tokens':2000,'system':s,'messages':[{'role':'user','content':u}]},
        {'x-api-key':a,'anthropic-version':'2023-06-01','Content-Type':'application/json'}
    ).json()['content'][0]['text'],
    'ollama':     lambda a,m,s,u: requests.post(
        f'{a or "http://localhost:11434"}/api/chat',
        json={'model': m or 'llama3.2', 'stream': False,
              'messages': [{'role':'system','content':s},{'role':'user','content':u}]},
        timeout=120
    ).json()['message']['content'],
}

def call_llm(agent, system: str, user: str) -> str:
    fn = PROVIDERS.get(agent.provider)
    if not fn: raise ValueError(f'Unknown provider: {agent.provider}')
    t0 = time.time()
    r = fn(agent.api_key, agent.model, system, user)
    log.debug(f'{agent.provider} {len(r)}c in {time.time()-t0:.1f}s')
    return r
