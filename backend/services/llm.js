const axios = require('axios');

async function callLLM(agent, systemPrompt, userPrompt) {
  const { provider, apiKey, model, baseUrl } = agent;
  const opts = { timeout: 45000 };

  if (provider === 'openai') {
    const res = await axios.post('https://api.openai.com/v1/chat/completions',
      { model: model || 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000, temperature: 0.2 },
      { headers: { Authorization: `Bearer ${apiKey}` }, ...opts });
    return res.data.choices[0].message.content;
  }

  if (provider === 'anthropic') {
    const res = await axios.post('https://api.anthropic.com/v1/messages',
      { model: model || 'claude-3-5-haiku-20241022', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, ...opts });
    return res.data.content[0].text;
  }

  if (provider === 'google') {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.2 } },
      opts);
    return res.data.candidates[0].content.parts[0].text;
  }

  if (provider === 'groq') {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions',
      { model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000, temperature: 0.2 },
      { headers: { Authorization: `Bearer ${apiKey}` }, ...opts });
    return res.data.choices[0].message.content;
  }

  if (provider === 'openrouter') {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions',
      { model: model || 'meta-llama/llama-3.1-8b-instruct:free', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2000 },
      { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://assetflow.local', 'X-Title': 'AssetFlow' }, ...opts });
    return res.data.choices[0].message.content;
  }

  if (provider === 'ollama') {
    const base = baseUrl || 'http://localhost:11434';
    const res = await axios.post(`${base}/api/chat`,
      { model: model || 'llama3.2', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false },
      { timeout: 120000 });
    return res.data.message.content;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

module.exports = { callLLM };
