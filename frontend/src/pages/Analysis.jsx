import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';
import AgentOutputCard from '../components/AgentOutputCard';

const ASSET_TYPES = ['equity', 'crypto', 'forex', 'commodity', 'index', 'etf'];

export default function Analysis() {
  const navigate = useNavigate();
  const { agents, setAgents, activeJob, setActiveJob, jobProgress, jobMessage, currentAnalysis, setCurrentAnalysis } = useStore();

  const [form, setForm] = useState({ symbol: '', name: '', assetType: 'equity', alphaVantageKey: '' });
  const [err, setErr] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {});
  }, []);

  async function handleRun(e) {
    e.preventDefault();
    setErr('');
    if (!form.symbol.trim()) return setErr('Symbol required');
    if (agents.filter(a => a.enabled !== false).length === 0) return setErr('Add at least one enabled agent first');
    setRunning(true);
    setCurrentAnalysis(null);
    setActiveJob({ status: 'running' });
    try {
      await analysisApi.run({ ...form, symbol: form.symbol.trim().toUpperCase() });
    } catch (e) {
      setErr(typeof e === 'string' ? e : 'Failed to start analysis');
      setRunning(false);
      setActiveJob(null);
    }
  }

  const isRunning = activeJob?.status === 'running';
  const isDone = activeJob?.status === 'done' || currentAnalysis;
  const analysis = currentAnalysis;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-mono font-semibold text-white">Analysis</h1>
        <p className="text-muted text-sm mt-1">Run probabilistic multi-agent prediction on any asset</p>
      </div>

      {/* Run form */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <form onSubmit={handleRun} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Symbol *</label>
            <input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              className="input w-32" placeholder="AAPL" disabled={isRunning} required />
          </div>
          <div>
            <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input w-44" placeholder="Apple Inc." disabled={isRunning} />
          </div>
          <div>
            <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Asset Type</label>
            <select value={form.assetType} onChange={e => setForm(f => ({ ...f, assetType: e.target.value }))} className="input" disabled={isRunning}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Alpha Vantage Key (optional)</label>
            <input type="password" value={form.alphaVantageKey} onChange={e => setForm(f => ({ ...f, alphaVantageKey: e.target.value }))}
              className="input w-48" placeholder="Free key for better data" disabled={isRunning} />
          </div>
          <button type="submit" disabled={isRunning}
            className="px-5 py-2 bg-accent text-bg font-mono font-medium text-sm rounded hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {isRunning ? '⟳ Running...' : '▶ Run Analysis'}
          </button>
        </form>
        {err && <p className="text-down text-sm font-mono mt-3">{err}</p>}
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="bg-surface border border-border rounded-lg p-6 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-white font-mono text-sm">Running analysis...</span>
            <span className="text-accent font-mono text-sm">{jobProgress}%</span>
          </div>
          <div className="w-full bg-bg rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all duration-500" style={{ width: `${jobProgress}%` }} />
          </div>
          <p className="text-muted text-xs font-mono">{jobMessage}</p>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < Math.floor(jobProgress / 12.5) ? 'bg-accent' : 'bg-border'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-4 animate-fade-in">
          {/* Synthesis header */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 bg-surface border border-border rounded-lg p-6 flex flex-col items-center justify-center">
              <div className="text-muted text-xs font-mono mb-4 uppercase tracking-wider">
                {analysis.asset?.symbol} — {new Date(analysis.createdAt).toLocaleString()}
              </div>
              <ProbabilityGauge synthesis={analysis.synthesis} />
              {analysis.price && (
                <div className="mt-4 text-center">
                  <div className="text-white font-mono text-lg">${analysis.price.price?.toFixed(2)}</div>
                  <div className={`text-sm font-mono ${analysis.price.changePercent >= 0 ? 'text-up' : 'text-down'}`}>
                    {analysis.price.changePercent >= 0 ? '+' : ''}{analysis.price.changePercent?.toFixed(2)}% today
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-3 bg-surface border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-white font-mono font-semibold text-lg">{analysis.asset?.symbol}</span>
                  {analysis.asset?.name && <span className="text-muted text-sm ml-2">{analysis.asset.name}</span>}
                </div>
                <span className={`text-xs font-mono px-3 py-1 rounded border font-semibold ${
                  analysis.synthesis?.primaryDirection === 'up' ? 'text-up border-up/30 bg-up/5' :
                  analysis.synthesis?.primaryDirection === 'down' ? 'text-down border-down/30 bg-down/5' :
                  'text-neutral border-neutral/30 bg-neutral/5'
                }`}>
                  {analysis.synthesis?.primaryDirection?.toUpperCase() || '?'}
                </span>
              </div>

              {analysis.synthesis?.summary && (
                <p className="text-sm text-gray-300 leading-relaxed">{analysis.synthesis.summary}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-up/5 border border-up/20 rounded p-3">
                  <div className="text-up text-xs font-mono mb-1.5 flex items-center justify-between">
                    BULL CASE
                    <span className="text-up font-bold">{analysis.synthesis?.upProbability}%</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{analysis.synthesis?.bullCase || '—'}</p>
                </div>
                <div className="bg-down/5 border border-down/20 rounded p-3">
                  <div className="text-down text-xs font-mono mb-1.5 flex items-center justify-between">
                    BEAR CASE
                    <span className="text-down font-bold">{analysis.synthesis?.downProbability}%</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{analysis.synthesis?.bearCase || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {analysis.synthesis?.topCatalysts?.length > 0 && (
                  <div>
                    <div className="text-muted text-xs font-mono mb-1.5">CATALYSTS</div>
                    <ul className="space-y-1">
                      {analysis.synthesis.topCatalysts.slice(0, 3).map((c, i) => (
                        <li key={i} className="text-xs text-gray-300 flex gap-1.5"><span className="text-accent">›</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.synthesis?.keyRisks?.length > 0 && (
                  <div>
                    <div className="text-muted text-xs font-mono mb-1.5">KEY RISKS</div>
                    <ul className="space-y-1">
                      {analysis.synthesis.keyRisks.slice(0, 3).map((r, i) => (
                        <li key={i} className="text-xs text-gray-300 flex gap-1.5"><span className="text-down">›</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="text-muted text-xs font-mono">
                Confidence: <span className="text-white">{analysis.synthesis?.confidence || 0}%</span>
                {' · '}Magnitude: <span className="text-white">{analysis.synthesis?.expectedMagnitude || '?'}</span>
                {' · '}Duration: <span className="text-white">{analysis.durationMs ? `${(analysis.durationMs / 1000).toFixed(1)}s` : '?'}</span>
              </div>
            </div>
          </div>

          {/* Agent graph */}
          {analysis.graph && (
            <div className="bg-surface border border-border rounded-lg overflow-hidden" style={{ height: 380 }}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-muted text-xs font-mono uppercase tracking-wider">Agent Signal Graph</span>
                <span className="text-muted text-xs font-mono">{analysis.agentOutputs?.length} specialists → synthesizer</span>
              </div>
              <div style={{ height: 340 }}>
                <AgentGraph graph={analysis.graph} />
              </div>
            </div>
          )}

          {/* Graph stats bar */}
          {analysis.stats && (
            <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-6 flex-wrap">
              <div className="text-muted text-xs font-mono uppercase tracking-wider">Graph</div>
              {[
                { label: 'Agents', value: analysis.stats.totalAgents },
                { label: 'Nodes', value: analysis.stats.totalNodes },
                { label: 'Edges', value: analysis.stats.totalEdges },
                { label: 'Bull votes', value: analysis.stats.bull, color: 'text-up' },
                { label: 'Bear votes', value: analysis.stats.bear, color: 'text-down' },
                { label: 'Neutral', value: analysis.stats.neut, color: 'text-neutral' },
                { label: 'Synthesizer', value: analysis.stats.synthAgent, mono: true },
              ].map(s => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-muted text-xs font-mono">{s.label}</span>
                  <span className={`font-mono font-semibold text-sm ${s.color || 'text-white'} ${s.mono ? 'text-accent' : ''}`}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phase labels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-accent text-xs font-mono mb-1 uppercase tracking-wider">◈ Phase 1 — Agent Graph Writes</div>
              <p className="text-muted text-xs leading-relaxed">All {analysis.stats?.totalAgents || 0} agents independently analyzed market data and wrote to the shared graph. No agent saw another's output.</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-accent text-xs font-mono mb-1 uppercase tracking-wider">◎ Phase 2 — Graph Synthesis</div>
              <p className="text-muted text-xs leading-relaxed">Synthesizer "{analysis.stats?.synthAgent}" read the complete graph ({analysis.stats?.totalNodes} nodes, {analysis.stats?.totalEdges} edges) and produced the probability verdict above.</p>
            </div>
          </div>

          {/* Butterfly effects */}
          {analysis.synthesis?.topButterflyEffects?.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-yellow-400 text-xs font-mono uppercase tracking-wider mb-3">🦋 Top Butterfly Effect Chains</div>
              <ul className="space-y-2">
                {analysis.synthesis.topButterflyEffects.map((b, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-yellow-500 font-mono mt-0.5">›</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* World state + social row */}
          <div className="grid grid-cols-2 gap-4">
            {analysis.synthesis?.worldStateHighlights && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-blue-400 text-xs font-mono uppercase tracking-wider mb-2">World State Highlights</div>
                <p className="text-sm text-gray-300">{analysis.synthesis.worldStateHighlights}</p>
                {analysis.worldState?.weatherAlerts?.length > 0 && (
                  <div className="mt-2 space-y-1">{analysis.worldState.weatherAlerts.map((w,i) => (<div key={i} className="text-xs text-yellow-400 font-mono">{w.region}: {w.alerts.join(", ")}</div>))}</div>
                )}
              </div>
            )}
            {analysis.synthesis?.socialSignalAssessment && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-purple-400 text-xs font-mono uppercase tracking-wider mb-2">Social Signal Assessment</div>
                <p className="text-sm text-gray-300">{analysis.synthesis.socialSignalAssessment}</p>
                {analysis.social?.stats && (
                  <div className="mt-2 text-xs font-mono text-muted">
                    <div>Posts: <span className="text-white">{analysis.social.stats.total}</span> total - <span className="text-up">{analysis.social.stats.clean}</span> credible - <span className="text-down">{analysis.social.stats.suspicious}</span> flagged</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Signal conflicts */}
          {analysis.synthesis?.signalConflicts && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-muted text-xs font-mono uppercase tracking-wider mb-2">Signal Conflicts</div>
              <p className="text-sm text-gray-300">{analysis.synthesis.signalConflicts}</p>
            </div>
          )}

          {/* Individual agent outputs */}
          {analysis.agentOutputs?.length > 0 && (
            <div>
              <h3 className="text-muted text-xs font-mono uppercase tracking-wider mb-3">
                Phase 1 — All Agent Contributions ({analysis.agentOutputs.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {analysis.agentOutputs.map((output, i) => (
                  <AgentOutputCard key={i} output={output} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
