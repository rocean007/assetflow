const axios = require('axios');

/**
 * Unified LLM caller supporting multiple providers
 */
async function callLLM(agent, systemPrompt, userPrompt) {
  const { provider, apiKey, model, baseUrl } = agent;

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt);
    case 'anthropic':
      return callAnthropic(apiKey, model || 'claude-3-5-haiku-20241022', systemPrompt, userPrompt);
    case 'google':
      return callGoogle(apiKey, model || 'gemini-1.5-flash', systemPrompt, userPrompt);
    case 'ollama':
      return callOllama(baseUrl || 'http://localhost:11434', model || 'llama3.2', systemPrompt, userPrompt);
    case 'openrouter':
      return callOpenRouter(apiKey, model || 'meta-llama/llama-3.1-8b-instruct:free', systemPrompt, userPrompt);
    case 'groq':
      return callGroq(apiKey, model || 'llama-3.1-8b-instant', systemPrompt, userPrompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAI(apiKey, model, system, user) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1500, temperature: 0.3 },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
  );
  return res.data.choices[0].message.content;
}

async function callAnthropic(apiKey, model, system, user) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] },
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, timeout: 30000 }
  );
  return res.data.content[0].text;
}

async function callGoogle(apiKey, model, system, user) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { contents: [{ parts: [{ text: `${system}\n\n${user}` }] }], generationConfig: { maxOutputTokens: 1500, temperature: 0.3 } },
    { timeout: 30000 }
  );
  return res.data.candidates[0].content.parts[0].text;
}

async function callOllama(baseUrl, model, system, user) {
  const res = await axios.post(
    `${baseUrl}/api/chat`,
    { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], stream: false },
    { timeout: 60000 }
  );
  return res.data.message.content;
}

async function callOpenRouter(apiKey, model, system, user) {
  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1500 },
    { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://assetflow.local', 'X-Title': 'AssetFlow' }, timeout: 30000 }
  );
  return res.data.choices[0].message.content;
}

async function callGroq(apiKey, model, system, user) {
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1500, temperature: 0.3 },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
  );
  return res.data.choices[0].message.content;
}

module.exports = { callLLM };
