"""
LLM Client — unified caller for all providers.

Free providers (no API key):
  pollinations      — text.pollinations.ai, truly free, no signup
  huggingface_free  — HuggingFace inference API, keyless for public models
  together_free     — Together.ai free-tier models

Free with signup:
  groq, google, openrouter, cohere, mistral, huggingface, ollama

Paid:
  openai, anthropic, deepseek
"""
import re
import json
import time
import requests
from typing import Optional
from ..utils.logger import get_logger

logger = get_logger('assetflow.services.llm')

TIMEOUT = 60  # seconds


# ─── JSON EXTRACTION — ROBUST ────────────────────────────────────────────────

def extract_json(raw: str) -> Optional[dict]:
    """
    Try multiple strategies to extract JSON from model output.
    Free/small models often return JSON embedded in prose, with markdown
    fences, or with slight formatting issues.
    """
    if not raw:
        return None

    # 1. Parse as-is
    try:
        return json.loads(raw.strip())
    except Exception:
        pass

    # 2. Strip markdown code fences
    stripped = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
    try:
        return json.loads(stripped)
    except Exception:
        pass

    # 3. Extract outermost {...} block
    first = raw.find('{')
    last  = raw.rfind('}')
    if first != -1 and last > first:
        try:
            return json.loads(raw[first:last + 1])
        except Exception:
            pass

    # 4. Find innermost object containing "signal" key
    m = re.search(r'\{[^{}]*"signal"\s*:[^{}]*\}', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass

    # 5. Prose extraction — model explained instead of outputting JSON
    sig = re.search(r'\b(bullish|bearish|neutral)\b', raw, re.I)
    conf = re.search(r'\b(\d{1,3})\s*%?\s*(?:confidence|conf|certain)', raw, re.I)
    if sig:
        return {
            'signal':     sig.group(1).lower(),
            'confidence': int(conf.group(1)) if conf else 50,
            'reasoning':  raw[:400].replace('"', "'"),
            'keyFactors': [],
            'butterflies':[],
            'edgeClaims': [],
            '_from_prose': True,
        }

    return None


def safe_output(parsed: Optional[dict], raw: str = '') -> dict:
    """Guarantee a valid output dict regardless of parse result."""
    if not parsed or not isinstance(parsed, dict):
        return {
            'signal':      'neutral',
            'confidence':  20,
            'reasoning':   f'Model returned unparseable output: {raw[:200]}' if raw else 'No response.',
            'keyFactors':  [],
            'butterflies': [],
            'edgeClaims':  [],
            '_parse_error': True,
        }
    return {
        'signal':           parsed.get('signal', 'neutral') if parsed.get('signal') in ('bullish','bearish','neutral') else 'neutral',
        'confidence':       max(0, min(100, int(parsed.get('confidence', 0) or 0))),
        'reasoning':        str(parsed.get('reasoning', ''))[:500],
        'keyFactors':       list(parsed.get('keyFactors', []))[:6],
        'butterflies':      list(parsed.get('butterflies', []))[:4],
        'edgeClaims':       list(parsed.get('edgeClaims', []))[:6],
        'manipulationNote': parsed.get('manipulationNote'),
    }


def is_small_model(provider: str, model: str = '') -> bool:
    """Detect models that need compact/simple prompts."""
    if provider in ('pollinations', 'huggingface_free', 'together_free', 'huggingface'):
        return True
    if provider == 'ollama' and any(m in (model or '') for m in ('phi', 'tinyllama', 'qwen2:0.5')):
        return True
    if provider == 'openrouter' and ':free' in (model or ''):
        return True
    return False


# ─── PROVIDER IMPLEMENTATIONS ────────────────────────────────────────────────

def _post(url: str, payload: dict, headers: dict = None, timeout: int = TIMEOUT) -> requests.Response:
    headers = headers or {'Content-Type': 'application/json'}
    r = requests.post(url, json=payload, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r


def call_pollinations(model: str, system: str, user: str) -> str:
    model = model or 'mistral'
    r = _post(
        'https://text.pollinations.ai/openai',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 1000, 'temperature': 0.2, 'seed': 42}
    )
    text = r.json().get('choices', [{}])[0].get('message', {}).get('content', '')
    if not text:
        raise ValueError('Pollinations returned empty content')
    return text


def call_huggingface_free(model: str, system: str, user: str) -> str:
    model = model or 'HuggingFaceH4/zephyr-7b-beta'
    prompt = f'<|system|>\n{system}</s>\n<|user|>\n{user}</s>\n<|assistant|>\n'
    r = _post(
        f'https://api-inference.huggingface.co/models/{model}',
        {'inputs': prompt, 'parameters': {'max_new_tokens': 800, 'temperature': 0.2,
                                           'return_full_text': False, 'do_sample': True}}
    )
    data = r.json()
    if isinstance(data, list):
        return data[0].get('generated_text', '')
    return data.get('generated_text', '')


def call_together_free(model: str, system: str, user: str) -> str:
    model = model or 'Qwen/Qwen2.5-7B-Instruct-Turbo'
    r = _post(
        'https://api.together.xyz/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 800, 'temperature': 0.2}
    )
    return r.json()['choices'][0]['message']['content']


def call_openai(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'gpt-4o-mini'
    r = _post(
        'https://api.openai.com/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 2000, 'temperature': 0.2},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


def call_anthropic(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'claude-3-5-haiku-20241022'
    r = _post(
        'https://api.anthropic.com/v1/messages',
        {'model': model, 'max_tokens': 2000, 'system': system, 'messages': [{'role': 'user', 'content': user}]},
        headers={'x-api-key': api_key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}
    )
    return r.json()['content'][0]['text']


def call_google(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'gemini-1.5-flash'
    r = _post(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
        {'contents': [{'parts': [{'text': f'{system}\n\n{user}'}]}],
         'generationConfig': {'maxOutputTokens': 2000, 'temperature': 0.2}}
    )
    return r.json()['candidates'][0]['content']['parts'][0]['text']


def call_groq(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'llama-3.3-70b-versatile'
    r = _post(
        'https://api.groq.com/openai/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 2000, 'temperature': 0.2},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


def call_openrouter(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'meta-llama/llama-3.1-8b-instruct:free'
    r = _post(
        'https://openrouter.ai/api/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 2000},
        headers={'Authorization': f'Bearer {api_key}', 'HTTP-Referer': 'https://assetflow.local',
                 'X-Title': 'AssetFlow', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


def call_cohere(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'command-r-plus-08-2024'
    r = _post(
        'https://api.cohere.com/v2/chat',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 1500},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['message']['content'][0]['text']


def call_mistral(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'mistral-small-latest'
    r = _post(
        'https://api.mistral.ai/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 1500, 'temperature': 0.2},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


def call_deepseek(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'deepseek-chat'
    r = _post(
        'https://api.deepseek.com/chat/completions',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'max_tokens': 2000, 'temperature': 0.2},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


def call_ollama(base_url: str, model: str, system: str, user: str) -> str:
    base_url = base_url or 'http://localhost:11434'
    model = model or 'llama3.2'
    r = _post(
        f'{base_url}/api/chat',
        {'model': model, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
         'stream': False},
        timeout=120
    )
    return r.json()['message']['content']


def call_huggingface(api_key: str, model: str, system: str, user: str) -> str:
    model = model or 'mistralai/Mistral-7B-Instruct-v0.3'
    r = _post(
        f'https://api-inference.huggingface.co/models/{model}/v1/chat/completions',
        {'model': model, 'messages': [{'role': 'user', 'content': f'{system}\n\n{user}'}], 'max_tokens': 1500},
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    )
    return r.json()['choices'][0]['message']['content']


# ─── MAIN DISPATCHER ─────────────────────────────────────────────────────────

PROVIDERS = {
    'pollinations':     lambda a, m, sys, usr, bu: call_pollinations(m, sys, usr),
    'huggingface_free': lambda a, m, sys, usr, bu: call_huggingface_free(m, sys, usr),
    'together_free':    lambda a, m, sys, usr, bu: call_together_free(m, sys, usr),
    'openai':           lambda a, m, sys, usr, bu: call_openai(a, m, sys, usr),
    'anthropic':        lambda a, m, sys, usr, bu: call_anthropic(a, m, sys, usr),
    'google':           lambda a, m, sys, usr, bu: call_google(a, m, sys, usr),
    'groq':             lambda a, m, sys, usr, bu: call_groq(a, m, sys, usr),
    'openrouter':       lambda a, m, sys, usr, bu: call_openrouter(a, m, sys, usr),
    'cohere':           lambda a, m, sys, usr, bu: call_cohere(a, m, sys, usr),
    'mistral':          lambda a, m, sys, usr, bu: call_mistral(a, m, sys, usr),
    'deepseek':         lambda a, m, sys, usr, bu: call_deepseek(a, m, sys, usr),
    'ollama':           lambda a, m, sys, usr, bu: call_ollama(bu, m, sys, usr),
    'huggingface':      lambda a, m, sys, usr, bu: call_huggingface(a, m, sys, usr),
}


def call_llm(agent, system_prompt: str, user_prompt: str) -> str:
    """
    Unified LLM caller. Raises on network/API error.
    Returns raw text — caller is responsible for JSON extraction.
    """
    provider = agent.provider
    fn = PROVIDERS.get(provider)
    if not fn:
        raise ValueError(f'Unknown provider: {provider}. Valid: {list(PROVIDERS.keys())}')

    logger.debug(f'Calling {provider}/{agent.model or "default"} for agent {agent.name}')
    start = time.time()
    result = fn(agent.api_key, agent.model, system_prompt, user_prompt, agent.base_url)
    elapsed = time.time() - start
    logger.debug(f'{provider} responded in {elapsed:.1f}s ({len(result)} chars)')
    return result
