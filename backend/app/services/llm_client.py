"""LLM Client — 13 providers, robust JSON extraction, compact prompts for free models."""
import re, json, time, requests
from typing import Optional
from ..utils.logger import get_logger
log = get_logger('assetflow.llm')

TIMEOUT = 60

# ── JSON EXTRACTION ──────────────────────────────────────────────────────────
def extract_json(raw: str) -> Optional[dict]:
    if not raw: return None
    for attempt in [
        lambda: json.loads(raw.strip()),
        lambda: json.loads(re.sub(r'```(?:json)?\s*','',raw).replace('```','').strip()),
        lambda: json.loads(raw[raw.find('{'):raw.rfind('}')+1]) if '{' in raw else None,
        lambda: json.loads(re.search(r'\{[^{}]*"signal"[^{}]*\}',raw).group()) if re.search(r'\{[^{}]*"signal"[^{}]*\}',raw) else None,
    ]:
        try:
            r = attempt()
            if isinstance(r, dict): return r
        except: pass
    # prose fallback
    sig = re.search(r'\b(bullish|bearish|neutral)\b', raw, re.I)
    conf = re.search(r'\b(\d{1,3})\s*%?\s*(?:confidence|conf)', raw, re.I)
    if sig:
        return {'signal': sig.group(1).lower(), 'confidence': int(conf.group(1)) if conf else 50,
                'reasoning': raw[:300].replace('"',"'"), 'keyFactors':[], 'butterflies':[], 'edgeClaims':[]}
    return None

def safe_output(parsed, raw=''):
    if not parsed or not isinstance(parsed, dict):
        return {'signal':'neutral','confidence':20,
                'reasoning': f'Unparseable: {raw[:200]}' if raw else 'No response.',
                'keyFactors':[],'butterflies':[],'edgeClaims':[],'_parse_error':True}
    return {
        'signal':     parsed.get('signal','neutral') if parsed.get('signal') in ('bullish','bearish','neutral') else 'neutral',
        'confidence': max(0,min(100,int(parsed.get('confidence',0) or 0))),
        'reasoning':  str(parsed.get('reasoning',''))[:500],
        'keyFactors': list(parsed.get('keyFactors',[]))[:6],
        'butterflies':list(parsed.get('butterflies',[]))[:4],
        'edgeClaims': list(parsed.get('edgeClaims',[]))[:6],
        'manipulationNote': parsed.get('manipulationNote'),
    }

def is_small_model(provider, model=''):
    return provider in ('pollinations','huggingface_free','together_free','huggingface') or \
           (provider=='openrouter' and ':free' in (model or ''))

# ── PROVIDER CALLS ───────────────────────────────────────────────────────────
def _post(url, payload, headers=None, timeout=TIMEOUT):
    r = requests.post(url, json=payload, headers=headers or {'Content-Type':'application/json'}, timeout=timeout)
    r.raise_for_status(); return r

def call_pollinations(model, sys, usr):
    r = _post('https://text.pollinations.ai/openai',
              {'model': model or 'mistral',
               'messages':[{'role':'system','content':sys},{'role':'user','content':usr}],
               'max_tokens':800,'temperature':0.2,'seed':42})
    t = r.json().get('choices',[{}])[0].get('message',{}).get('content','')
    if not t: raise ValueError('Empty response from Pollinations')
    return t

def call_hf_free(model, sys, usr):
    model = model or 'HuggingFaceH4/zephyr-7b-beta'
    prompt = f'<|system|>\n{sys}</s>\n<|user|>\n{usr}</s>\n<|assistant|>\n'
    r = _post(f'https://api-inference.huggingface.co/models/{model}',
              {'inputs':prompt,'parameters':{'max_new_tokens':600,'temperature':0.2,'return_full_text':False}})
    d = r.json()
    return (d[0] if isinstance(d,list) else d).get('generated_text','')

def call_together_free(model, sys, usr):
    r = _post('https://api.together.xyz/v1/chat/completions',
              {'model': model or 'Qwen/Qwen2.5-7B-Instruct-Turbo',
               'messages':[{'role':'system','content':sys},{'role':'user','content':usr}],'max_tokens':600})
    return r.json()['choices'][0]['message']['content']

def _openai_compat(url, key, model, sys, usr, max_t=2000):
    r = _post(url, {'model':model,'messages':[{'role':'system','content':sys},{'role':'user','content':usr}],
                    'max_tokens':max_t,'temperature':0.2},
              headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'})
    return r.json()['choices'][0]['message']['content']

DISPATCH = {
    'pollinations':     lambda a,m,s,u: call_pollinations(m,s,u),
    'huggingface_free': lambda a,m,s,u: call_hf_free(m,s,u),
    'together_free':    lambda a,m,s,u: call_together_free(m,s,u),
    'openai':           lambda a,m,s,u: _openai_compat('https://api.openai.com/v1/chat/completions',a,m or 'gpt-4o-mini',s,u),
    'anthropic':        lambda a,m,s,u: _post('https://api.anthropic.com/v1/messages',
                            {'model':m or 'claude-3-5-haiku-20241022','max_tokens':2000,'system':s,'messages':[{'role':'user','content':u}]},
                            headers={'x-api-key':a,'anthropic-version':'2023-06-01','Content-Type':'application/json'}).json()['content'][0]['text'],
    'google':           lambda a,m,s,u: _post(f'https://generativelanguage.googleapis.com/v1beta/models/{m or "gemini-1.5-flash"}:generateContent?key={a}',
                            {'contents':[{'parts':[{'text':f'{s}\n\n{u}'}]}],'generationConfig':{'maxOutputTokens':2000,'temperature':0.2}}).json()['candidates'][0]['content']['parts'][0]['text'],
    'groq':             lambda a,m,s,u: _openai_compat('https://api.groq.com/openai/v1/chat/completions',a,m or 'llama-3.3-70b-versatile',s,u),
    'openrouter':       lambda a,m,s,u: _openai_compat('https://openrouter.ai/api/v1/chat/completions',a,m or 'meta-llama/llama-3.1-8b-instruct:free',s,u),
    'cohere':           lambda a,m,s,u: _post('https://api.cohere.com/v2/chat',
                            {'model':m or 'command-r-plus-08-2024','messages':[{'role':'system','content':s},{'role':'user','content':u}],'max_tokens':1500},
                            headers={'Authorization':f'Bearer {a}','Content-Type':'application/json'}).json()['message']['content'][0]['text'],
    'mistral':          lambda a,m,s,u: _openai_compat('https://api.mistral.ai/v1/chat/completions',a,m or 'mistral-small-latest',s,u),
    'deepseek':         lambda a,m,s,u: _openai_compat('https://api.deepseek.com/chat/completions',a,m or 'deepseek-chat',s,u),
    'ollama':           lambda a,m,s,u: requests.post(f'{a or "http://localhost:11434"}/api/chat',
                            json={'model':m or 'llama3.2','messages':[{'role':'system','content':s},{'role':'user','content':u}],'stream':False},
                            timeout=120).json()['message']['content'],
}

def call_llm(agent, system: str, user: str) -> str:
    fn = DISPATCH.get(agent.provider)
    if not fn: raise ValueError(f'Unknown provider: {agent.provider}')
    t0 = time.time()
    result = fn(agent.api_key, agent.model, system, user)
    log.debug(f'{agent.provider}/{agent.model or "default"} → {len(result)} chars in {time.time()-t0:.1f}s')
    return result
