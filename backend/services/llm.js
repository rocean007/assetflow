const axios = require('axios');

/**
 * FREE BUILT-IN PROVIDERS (no API key required):
 *
 *  pollinations   — Pollinations.ai text API. Completely free, no key, no signup.
 *                   Uses Meta Llama 3 / Mistral models. Rate-limited but generous.
 *                   https://text.pollinations.ai
 *
 *  huggingface    — HuggingFace Inference API free tier.
 *                   No key needed for some public models (Zephyr, Mistral).
 *                   https://api-inference.huggingface.co
 *
 *  together_free  — Together.ai has a set of genuinely free models with no key.
 *                   Uses their /completions endpoint with free model IDs.
 *
 *  openrouter_free — OpenRouter free-tier models. Key required but free signup.
 *                   Included here for completeness (user adds key once).
 *
 * PROVIDERS REQUIRING API KEYS:
 *  openai, anthropic, google, groq, openrouter, ollama
 */

const TIMEOUT = 60000;

// ─── FREE NO-KEY PROVIDERS ───────────────────────────────────────────────────

async function callPollinations(model, systemPrompt, userPrompt) {
  // Pollinations text API — completely free, no key, no rate limit headers needed
  // Supports: mistral, llama, openai (proxied), command-r, phi
  const useModel = model || 'mistral';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  const res = await axios.post(
    'https://text.pollinations.ai/openai',
    { model: useModel, messages, max_tokens: 2000, temperature: 0.2, seed: 42 },
    { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Pollinations returned empty response');
  return text;
}

async function callHuggingFace(model, systemPrompt, userPrompt) {
  // HuggingFace Inference API — free tier, no key for public models
  // Best free models: HuggingFaceH4/zephyr-7b-beta, mistralai/Mistral-7B-Instruct-v0.2
  const useModel = model || 'HuggingFaceH4/zephyr-7b-beta';
  const prompt = `<|system|>\n${systemPrompt}</s>\n<|user|>\n${userPrompt}</s>\n<|assistant|>\n`;
  const res = await axios.post(
    `https://api-inference.huggingface.co/models/${useModel}`,
    {
      inputs: prompt,
      parameters: { max_new_tokens: 1500, temperature: 0.2, return_full_text: false, do_sample: true }
    },
    { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  const text = res.data?.[0]?.generated_text || res.data?.generated_text;
  if (!text) throw new Error('HuggingFace returned empty response');
  return text.trim();
}

async function callHuggingFaceChat(model, systemPrompt, userPrompt, apiKey) {
  // HuggingFace with optional key for higher rate limits
  const useModel = model || 'mistralai/Mistral-7B-Instruct-v0.3';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await axios.post(
    `https://api-inference.huggingface.co/models/${useModel}/v1/chat/completions`,
    { model: useModel, messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }], max_tokens: 1500, temperature: 0.2 },
    { timeout: TIMEOUT, headers }
  );
  return res.data.choices[0].message.content;
}

async function callTogetherFree(model, systemPrompt, userPrompt) {
  // Together.ai serverless — free models available without a key via their public endpoint
  // Free models: Qwen/Qwen2.5-7B-Instruct, meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo
  const useModel = model || 'Qwen/Qwen2.5-7B-Instruct-Turbo';
  const res = await axios.post(
    'https://api.together.xyz/v1/chat/completions',
    { model: useModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1500, temperature: 0.2 },
    { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

async function callDeepSeekFree(model, systemPrompt, userPrompt) {
  // DeepSeek API — extremely cheap, nearly free, no key needed for demo endpoint
  // deepseek-chat is $0.00014/1K tokens — effectively free for this usage
  const res = await axios.post(
    'https://api.deepseek.com/chat/completions',
    { model: model || 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000, temperature: 0.2 },
    { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

async function callCohere(model, systemPrompt, userPrompt, apiKey) {
  // Cohere — free trial key available at cohere.com, generous limits
  const res = await axios.post(
    'https://api.cohere.com/v2/chat',
    { model: model || 'command-r-plus-08-2024', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1500 },
    { timeout: TIMEOUT, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  return res.data.message.content[0].text;
}

async function callMistralFree(model, systemPrompt, userPrompt, apiKey) {
  // Mistral AI — free tier available at console.mistral.ai
  const res = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    { model: model || 'mistral-small-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1500, temperature: 0.2 },
    { timeout: TIMEOUT, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

// ─── MAIN ROUTER ─────────────────────────────────────────────────────────────

async function callLLM(agent, systemPrompt, userPrompt) {
  const { provider, apiKey, model, baseUrl } = agent;

  switch (provider) {

    // ── Truly free, zero key required ──────────────────────────────
    case 'pollinations':
      return callPollinations(model, systemPrompt, userPrompt);

    case 'huggingface_free':
      return callHuggingFace(model, systemPrompt, userPrompt);

    case 'together_free':
      return callTogetherFree(model, systemPrompt, userPrompt);

    // ── Free with signup (key needed but free tier is generous) ────
    case 'huggingface':
      return callHuggingFaceChat(model, systemPrompt, userPrompt, apiKey);

    case 'cohere':
      return callCohere(model, systemPrompt, userPrompt, apiKey);

    case 'mistral':
      return callMistralFree(model, systemPrompt, userPrompt, apiKey);

    case 'deepseek':
      return callDeepSeekFree(model, systemPrompt, userPrompt);

    // ── Paid providers ─────────────────────────────────────────────
    case 'openai': {
      const res = await axios.post('https://api.openai.com/v1/chat/completions',
        { model: model || 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000, temperature: 0.2 },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: TIMEOUT });
      return res.data.choices[0].message.content;
    }

    case 'anthropic': {
      const res = await axios.post('https://api.anthropic.com/v1/messages',
        { model: model || 'claude-3-5-haiku-20241022', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
        { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, timeout: TIMEOUT });
      return res.data.content[0].text;
    }

    case 'google': {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.2 } },
        { timeout: TIMEOUT });
      return res.data.candidates[0].content.parts[0].text;
    }

    case 'groq': {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions',
        { model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000, temperature: 0.2 },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: TIMEOUT });
      return res.data.choices[0].message.content;
    }

    case 'openrouter': {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions',
        { model: model || 'meta-llama/llama-3.1-8b-instruct:free', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000 },
        { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://assetflow.local', 'X-Title': 'AssetFlow' }, timeout: TIMEOUT });
      return res.data.choices[0].message.content;
    }

    case 'ollama': {
      const base = baseUrl || 'http://localhost:11434';
      const res = await axios.post(`${base}/api/chat`,
        { model: model || 'llama3.2', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false },
        { timeout: 120000 });
      return res.data.message.content;
    }

    default:
      throw new Error(`Unknown provider: "${provider}". Valid options: pollinations, huggingface_free, together_free, huggingface, cohere, mistral, deepseek, openai, anthropic, google, groq, openrouter, ollama`);
  }
}

module.exports = { callLLM };
