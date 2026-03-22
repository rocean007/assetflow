import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { agentsApi } from '../utils/api';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-6'] },
  { value: 'google', label: 'Google Gemini', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
  { value: 'groq', label: 'Groq', models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
  { value: 'openrouter', label: 'OpenRouter', models: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemini-flash-1.5', 'mistralai/mistral-7b-instruct:free'] },
  { value: 'ollama', label: 'Ollama (Local)', models: ['llama3.2', 'mistral', 'phi3', 'qwen2.5'] },
];

const ROLES = [
  { value: 'specialist', label: 'Specialist (auto-assigned)' },
  { value: 'synthesizer', label: 'Synthesizer (final verdict)' },
];

const EMPTY_FORM = { name: '', provider: 'openai', apiKey: '', model: '', baseUrl: '', role: 'specialist', description: '' };

export default function Agents() {
  const { agents, setAgents, addAgent, updateAgent, removeAgent } = useStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {});
  }, []);

  const prov = PROVIDERS.find(p => p.value === form.provider);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      if (editId) {
        const updated = await agentsApi.update(editId, form);
        updateAgent(editId, updated);
        setEditId(null);
      } else {
        const agent = await agentsApi.create(form);
        addAgent(agent);
      }
      setForm(EMPTY_FORM);
    } catch (e) {
      setErr(typeof e === 'string' ? e : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(agent) {
    setEditId(agent.id);
    setForm({ name: agent.name, provider: agent.provider, apiKey: '', model: agent.model, baseUrl: agent.baseUrl || '', role: agent.role, description: agent.description || '' });
  }

  async function handleDelete(id) {
    if (!confirm('Delete this agent?')) return;
    await agentsApi.delete(id).catch(() => {});
    removeAgent(id);
  }

  async function handleTest(id) {
    setTesting(id);
    setTestResult(r => ({ ...r, [id]: null }));
    try {
      const res = await agentsApi.test(id);
      setTestResult(r => ({ ...r, [id]: { ok: true, msg: res.response } }));
    } catch (e) {
      setTestResult(r => ({ ...r, [id]: { ok: false, msg: typeof e === 'string' ? e : 'Test failed' } }));
    } finally {
      setTesting(null);
    }
  }

  async function toggleEnabled(agent) {
    const updated = await agentsApi.update(agent.id, { enabled: !agent.enabled }).catch(() => null);
    if (updated) updateAgent(agent.id, updated);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-mono font-semibold text-white">Agents</h1>
        <p className="text-muted text-sm mt-1">
          Add as many agents as you want. <span className="text-accent font-mono">specialist</span> agents all write to the shared graph in Phase 1.
          One <span className="text-accent font-mono">synthesizer</span> reads the complete graph in Phase 2.
        </p>
      </div>

      {/* Two-phase explainer */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-accent text-xs font-mono mb-1.5 uppercase tracking-wider">◈ Phase 1 — Specialists (unlimited)</div>
          <p className="text-muted text-xs leading-relaxed">Every specialist independently analyzes market data and writes to the shared graph. Roles are round-robin: Macro, Sentiment, Supply Chain, Technical, Geopolitical, Sector. Add 1 or 1,000.</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-accent text-xs font-mono mb-1.5 uppercase tracking-wider">◎ Phase 2 — Synthesizer (one)</div>
          <p className="text-muted text-xs leading-relaxed">One synthesizer receives the complete assembled graph — all nodes, edges, signal votes — as its only input. It never saw individual agent outputs. It reads the graph and produces the final verdict.</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-mono text-white mb-4 uppercase tracking-wider">
          {editId ? '✎ Edit Agent' : '+ Add Agent'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" required>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input" placeholder="e.g. GPT-4o Mini Analyst" required />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider" required>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: '' }))} className="input">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Model">
              <select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="input">
                <option value="">Default</option>
                {prov?.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          {form.provider === 'ollama' ? (
            <Field label="Base URL">
              <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                className="input" placeholder="http://localhost:11434" />
            </Field>
          ) : (
            <Field label="API Key">
              <input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                className="input" placeholder={editId ? 'Leave blank to keep existing' : 'sk-...'} />
            </Field>
          )}
          <Field label="Description (optional)">
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input" placeholder="What this agent specializes in..." />
          </Field>
          {err && <p className="text-down text-sm font-mono">{err}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-accent text-bg text-sm font-mono font-medium rounded hover:bg-accent/90 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editId ? 'Update Agent' : 'Add Agent'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_FORM); }}
                className="px-4 py-2 border border-border text-sm font-mono rounded hover:border-muted transition-colors">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {agents.length === 0 && (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted text-sm font-mono">
            No agents yet. Add one above.
          </div>
        )}
        {agents.map(agent => (
          <div key={agent.id} className={`bg-surface border rounded-lg p-4 transition-colors ${agent.enabled !== false ? 'border-border' : 'border-border/40 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleEnabled(agent)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${agent.enabled !== false ? 'bg-accent/30' : 'bg-muted/30'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${agent.enabled !== false ? 'translate-x-4 bg-accent' : 'translate-x-0.5 bg-muted'}`} />
                </button>
                <div>
                  <span className="text-white font-mono text-sm font-medium">{agent.name}</span>
                  <span className="ml-2 text-muted text-xs font-mono">{agent.provider} · {agent.model || 'default'}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                  agent.role === 'synthesizer' ? 'border-accent/30 text-accent bg-accent/5' : 'border-border text-muted'
                }`}>{agent.role}</span>
                {agent.hasApiKey && <span className="text-xs text-up font-mono">● key set</span>}
              </div>
              <div className="flex items-center gap-2">
                {testResult[agent.id] && (
                  <span className={`text-xs font-mono ${testResult[agent.id].ok ? 'text-up' : 'text-down'}`}>
                    {testResult[agent.id].ok ? '✓ connected' : '✗ failed'}
                  </span>
                )}
                <button onClick={() => handleTest(agent.id)} disabled={testing === agent.id}
                  className="px-3 py-1 text-xs font-mono border border-border rounded hover:border-accent hover:text-accent disabled:opacity-50 transition-colors">
                  {testing === agent.id ? '...' : 'Test'}
                </button>
                <button onClick={() => startEdit(agent)}
                  className="px-3 py-1 text-xs font-mono border border-border rounded hover:border-muted transition-colors">
                  Edit
                </button>
                <button onClick={() => handleDelete(agent.id)}
                  className="px-3 py-1 text-xs font-mono border border-border rounded hover:border-down hover:text-down transition-colors">
                  Delete
                </button>
              </div>
            </div>
            {agent.description && <p className="text-muted text-xs mt-2 ml-11">{agent.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// Inline style for inputs (easier than purging tailwind)
const styles = `
.input {
  width: 100%;
  background: #0a0b0e;
  border: 1px solid #1e2430;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: #00d4ff; }
.input option { background: #11141a; }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const el = document.createElement('style');
  el.textContent = styles;
  document.head.appendChild(el);
}
