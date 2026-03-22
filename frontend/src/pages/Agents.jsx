import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { agentsApi } from '../utils/api';

// Providers grouped: free-first so users see them at top
const PROVIDERS = [
  // ── Truly free, zero signup, zero key ──────────────────────────────────────
  { v: 'pollinations',    l: 'Pollinations.ai ★ FREE no key',  free: true,  noKey: true,  models: ['mistral', 'llama', 'openai', 'phi', 'command-r'], note: 'Completely free. No account. No key. Rate-limited but works.' },
  { v: 'huggingface_free',l: 'HuggingFace ★ FREE no key',      free: true,  noKey: true,  models: ['HuggingFaceH4/zephyr-7b-beta', 'mistralai/Mistral-7B-Instruct-v0.2', 'microsoft/Phi-3-mini-4k-instruct'], note: 'Free public inference. No account needed. May be slow when busy.' },
  { v: 'together_free',   l: 'Together.ai ★ FREE no key',      free: true,  noKey: true,  models: ['Qwen/Qwen2.5-7B-Instruct-Turbo', 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo'], note: 'Free tier models. No key required.' },
  // ── Free with signup (generous free tiers) ─────────────────────────────────
  { v: 'groq',            l: 'Groq — free signup',             free: true,  noKey: false, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'], note: 'Free tier. Get key at console.groq.com — takes 1 minute.' },
  { v: 'google',          l: 'Google Gemini — free tier',      free: true,  noKey: false, models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'], note: 'Free tier available. Get key at aistudio.google.com.' },
  { v: 'openrouter',      l: 'OpenRouter — free models',       free: true,  noKey: false, models: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemini-flash-1.5', 'mistralai/mistral-7b-instruct:free', 'nousresearch/hermes-3-llama-3.1-405b:free'], note: 'Many free models. Get key at openrouter.ai.' },
  { v: 'cohere',          l: 'Cohere — free trial',            free: true,  noKey: false, models: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-light'], note: 'Free trial key at cohere.com. Generous limits.' },
  { v: 'mistral',         l: 'Mistral AI — free tier',         free: true,  noKey: false, models: ['mistral-small-latest', 'mistral-medium-latest', 'open-mistral-7b'], note: 'Free tier. Get key at console.mistral.ai.' },
  { v: 'huggingface',     l: 'HuggingFace — with key',         free: true,  noKey: false, models: ['mistralai/Mistral-7B-Instruct-v0.3', 'meta-llama/Meta-Llama-3-8B-Instruct', 'HuggingFaceH4/zephyr-7b-beta'], note: 'Free API key at huggingface.co. Higher rate limits than keyless.' },
  { v: 'ollama',          l: 'Ollama — local (free)',          free: true,  noKey: true,  models: ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'qwen2.5', 'deepseek-r1', 'gemma2'], note: 'Runs on your machine. Install at ollama.com. Fully private.' },
  // ── Paid providers ─────────────────────────────────────────────────────────
  { v: 'openai',          l: 'OpenAI',                         free: false, noKey: false, models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini'], note: 'Paid. Best quality. Key at platform.openai.com.' },
  { v: 'anthropic',       l: 'Anthropic',                      free: false, noKey: false, models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-6'], note: 'Paid. Excellent reasoning. Key at console.anthropic.com.' },
  { v: 'deepseek',        l: 'DeepSeek (near-free)',           free: true,  noKey: false, models: ['deepseek-chat', 'deepseek-reasoner'], note: 'Extremely cheap ($0.00014/1K tokens). Key at platform.deepseek.com.' },
];

const ROLES = [
  { v: 'specialist',       l: 'Specialist',        desc: 'Auto-assigned round-robin to all 7 roles below' },
  { v: 'macro',            l: 'Macro Economist',   desc: 'Interest rates, inflation, GDP, central banks, currencies' },
  { v: 'sentiment',        l: 'Sentiment Analyst', desc: 'News narratives, fear/greed, options flow, insider activity' },
  { v: 'social_sentiment', l: 'Social Intelligence',desc: 'Reddit/X/StockTwits/HN — manipulation detection and crowd signals' },
  { v: 'supply_chain',     l: 'Supply Chain',      desc: 'Weather, commodities, shipping, agriculture — butterfly chains' },
  { v: 'technical',        l: 'Technical Analyst', desc: 'Price action, momentum, support/resistance, volume, RSI' },
  { v: 'geopolitical',     l: 'Geopolitical Risk', desc: 'Conflicts, sanctions, trade policy, regulatory, diplomacy' },
  { v: 'sector',           l: 'Sector Specialist', desc: 'Earnings, analysts, insiders, competitive dynamics, M&A' },
  { v: 'synthesizer',      l: 'Synthesizer',       desc: 'Phase 2: reads the complete assembled graph → produces verdict' },
  { v: 'super_synthesizer',l: 'Super Synthesizer', desc: 'Phase 3: reconciles multiple synthesizer verdicts into final call' },
];

const EMPTY = { name: '', provider: 'pollinations', apiKey: '', model: '', baseUrl: '', role: 'specialist', description: '' };

const inp = { width: '100%', background: '#080a0f', border: '1px solid #1c2333', borderRadius: 6, padding: '7px 11px', color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, outline: 'none' };

export default function Agents() {
  const { agents, setAgents, addAgent, updateAgent, removeAgent } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { agentsApi.list().then(setAgents).catch(() => {}); }, []);

  const prov = PROVIDERS.find(p => p.v === form.provider);
  const roleInfo = ROLES.find(r => r.v === form.role);

  async function submit(e) {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      if (editId) { const u = await agentsApi.update(editId, form); updateAgent(editId, u); setEditId(null); }
      else { const a = await agentsApi.create(form); addAgent(a); }
      setForm(EMPTY);
    } catch (e2) { setErr(typeof e2 === 'string' ? e2 : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function test(id) {
    setTesting(id);
    try {
      const r = await agentsApi.test(id);
      setTestResults(t => ({ ...t, [id]: { ok: true, msg: r.response } }));
    } catch (e2) { setTestResults(t => ({ ...t, [id]: { ok: false, msg: typeof e2 === 'string' ? e2 : 'Failed' } })); }
    finally { setTesting(null); }
  }

  async function toggle(agent) {
    const u = await agentsApi.update(agent.id, { enabled: !agent.enabled }).catch(() => null);
    if (u) updateAgent(agent.id, u);
  }

  async function del(id) {
    if (!confirm('Delete this agent?')) return;
    await agentsApi.delete(id).catch(() => {});
    removeAgent(id);
  }

  const F = ({ label, req, children }) => (
    <div>
      <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>{label}{req && <span style={{ color: '#00c8ff' }}> *</span>}</label>
      {children}
    </div>
  );

  const roleCount = (role) => agents.filter(a => a.role === role || (role === 'specialist' && !['synthesizer', 'super_synthesizer'].includes(a.role))).length;

  return (
    <div className="max-w-5xl mx-auto space-y-5 anim-up">
      <div>
        <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>Agents</h1>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
          Add unlimited agents. All <span style={{ color: '#00c8ff' }} className="mono">specialist</span> agents write independently to the graph in Phase 1.
          <span style={{ color: '#00c8ff' }} className="mono"> synthesizer</span> agents read the complete graph in Phase 2.
          <span style={{ color: '#f472b6' }} className="mono"> super_synthesizer</span> reconciles all synthesizers in Phase 3.
        </p>
      </div>

      {/* Phase diagram */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { phase: 'Phase 1', role: 'Specialists', color: '#60a5fa', count: agents.filter(a => !['synthesizer','super_synthesizer'].includes(a.role)).length, desc: 'All write to shared graph with full world data' },
          { phase: 'Phase 2', role: 'Synthesizers', color: '#a78bfa', count: agents.filter(a => a.role === 'synthesizer').length, desc: 'Each reads complete graph, produces verdict' },
          { phase: 'Phase 3', role: 'Super Synthesizer', color: '#f472b6', count: agents.filter(a => a.role === 'super_synthesizer').length, desc: 'Reconciles all synthesizer verdicts (optional)' },
        ].map(p => (
          <div key={p.phase} className="rounded-lg p-4" style={{ background: '#0f1218', border: '1px solid #1c2333' }}>
            <div className="mono text-xs mb-1" style={{ color: p.color }}>{p.phase} — {p.role}</div>
            <div className="mono text-2xl font-bold mb-1" style={{ color: '#e2e8f0' }}>{p.count}</div>
            <p className="text-xs" style={{ color: '#4a5568' }}>{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Add/Edit form */}
      <div className="rounded-lg p-6" style={{ background: '#0f1218', border: '1px solid #1c2333' }}>
        <h2 className="mono text-sm uppercase tracking-wider mb-4" style={{ color: '#e2e8f0' }}>
          {editId ? '✎ Edit Agent' : '+ Add Agent'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Name" req><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. GPT-4o Macro Agent" required /></F>
            <F label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>
                {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </F>
          </div>
          {roleInfo && <p className="text-xs" style={{ color: '#4a5568' }}>↳ {roleInfo.desc}</p>}
          <div className="grid grid-cols-2 gap-4">
            <F label="Provider" req>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: '' }))} style={inp}>
                {PROVIDERS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </F>
            <F label="Model">
              <select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} style={inp}>
                <option value="">Default</option>
                {prov?.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </F>
          </div>
          {prov?.note && (
            <div className="rounded px-3 py-2 mono text-xs" style={{ background: prov.noKey ? 'rgba(0,230,118,0.06)' : 'rgba(0,200,255,0.06)', border: `1px solid ${prov.noKey ? 'rgba(0,230,118,0.2)' : 'rgba(0,200,255,0.15)'}`, color: prov.noKey ? '#00e676' : '#00c8ff' }}>
              {prov.noKey ? '\u2605 No API key needed — ' : '\u2691 Free tier — '}{prov.note}
            </div>
          )}
          {form.provider === 'ollama' ? (
            <F label="Ollama Base URL"><input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} style={inp} placeholder="http://localhost:11434" /></F>
          ) : prov?.noKey ? (
            <div className="rounded px-3 py-2 mono text-xs" style={{ color: '#4a5568', background: '#0a0c11', border: '1px solid #1c2333' }}>
              No API key required for this provider.
            </div>
          ) : (
            <F label="API Key"><input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} style={inp} placeholder={editId ? 'Leave blank to keep existing key' : 'Your API key...'} /></F>
          )}
          <F label="Description (optional)"><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="What this agent specializes in..." /></F>
          {err && <p className="mono text-xs" style={{ color: '#ff3d5a' }}>{err}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="mono text-sm font-medium px-4 py-2 rounded transition-opacity disabled:opacity-50" style={{ background: '#00c8ff', color: '#080a0f' }}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Add Agent'}
            </button>
            {editId && <button type="button" onClick={() => { setEditId(null); setForm(EMPTY); }} className="mono text-sm px-4 py-2 rounded" style={{ border: '1px solid #1c2333', color: '#4a5568' }}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {agents.length === 0 && (
          <div className="rounded-lg p-10 text-center mono text-sm" style={{ background: '#0f1218', border: '1px solid #1c2333', color: '#4a5568' }}>
            No agents yet. Add your first agent above.
          </div>
        )}
        {agents.map(agent => {
          const roleConfig = ROLES.find(r => r.v === agent.role);
          const testR = testResults[agent.id];
          return (
            <div key={agent.id} className="rounded-lg p-4 transition-all" style={{ background: '#0f1218', border: `1px solid ${agent.enabled !== false ? '#1c2333' : '#1c2333'}`, opacity: agent.enabled !== false ? 1 : 0.5 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggle(agent)} className="relative rounded-full transition-colors" style={{ width: 32, height: 16, background: agent.enabled !== false ? 'rgba(0,200,255,0.25)' : '#1c2333' }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ left: agent.enabled !== false ? 16 : 2, background: agent.enabled !== false ? '#00c8ff' : '#4a5568' }} />
                  </button>
                  <div>
                    <span className="mono text-sm font-medium" style={{ color: '#e2e8f0' }}>{agent.name}</span>
                    <span className="mono text-xs ml-2" style={{ color: '#4a5568' }}>{agent.provider} · {agent.model || 'default'}</span>
                  </div>
                  <span className="mono text-xs px-2 py-0.5 rounded" style={{
                    color: agent.role === 'super_synthesizer' ? '#f472b6' : agent.role === 'synthesizer' ? '#a78bfa' : '#60a5fa',
                    border: `1px solid ${agent.role === 'super_synthesizer' ? 'rgba(244,114,182,0.25)' : agent.role === 'synthesizer' ? 'rgba(167,139,250,0.25)' : 'rgba(96,165,250,0.25)'}`,
                    background: 'transparent'
                  }}>{agent.role}</span>
                  {agent.builtin && <span className="mono text-xs px-1.5 py-0.5 rounded" style={{ color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)' }}>★ free built-in</span>}
                  {!agent.builtin && agent.hasApiKey && <span className="mono text-xs" style={{ color: '#00e676' }}>● key</span>}
                  {!agent.builtin && !agent.hasApiKey && PROVIDERS.find(p => p.v === agent.provider)?.noKey && <span className="mono text-xs" style={{ color: '#00e676' }}>★ no key</span>}
                </div>
                <div className="flex items-center gap-2">
                  {testR && <span className="mono text-xs" style={{ color: testR.ok ? '#00e676' : '#ff3d5a' }}>{testR.ok ? '✓ ok' : '✗ fail'}</span>}
                  <button onClick={() => test(agent.id)} disabled={testing === agent.id} className="mono text-xs px-3 py-1 rounded disabled:opacity-50 transition-all" style={{ border: '1px solid #1c2333', color: '#4a5568' }}
                    onMouseEnter={e => e.target.style.borderColor = '#00c8ff'}
                    onMouseLeave={e => e.target.style.borderColor = '#1c2333'}>
                    {testing === agent.id ? '…' : 'test'}
                  </button>
                  <button onClick={() => { setEditId(agent.id); setForm({ name: agent.name, provider: agent.provider, apiKey: '', model: agent.model, baseUrl: agent.baseUrl || '', role: agent.role, description: agent.description || '' }); }} className="mono text-xs px-3 py-1 rounded transition-all" style={{ border: '1px solid #1c2333', color: '#4a5568' }}>edit</button>
                  <button onClick={() => del(agent.id)} className="mono text-xs px-3 py-1 rounded transition-all" style={{ border: '1px solid #1c2333', color: '#4a5568' }}
                    onMouseEnter={e => { e.target.style.borderColor = '#ff3d5a'; e.target.style.color = '#ff3d5a'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#1c2333'; e.target.style.color = '#4a5568'; }}>del</button>
                </div>
              </div>
              {agent.description && <p className="text-xs mt-2 ml-10" style={{ color: '#4a5568' }}>{agent.description}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
