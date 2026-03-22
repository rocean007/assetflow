import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';
import AgentOutputCard from '../components/AgentOutputCard';

const Card = ({ children, className = '' }) => (
  <div className={`rounded-lg ${className}`} style={{ background: '#0f1218', border: '1px solid #1c2333' }}>{children}</div>
);
const CardP = ({ children, className = '' }) => <Card className={`p-5 ${className}`}>{children}</Card>;

const SSection = ({ title, content, color = '#4a5568' }) => content ? (
  <div>
    <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color }}>{title}</div>
    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{content}</p>
  </div>
) : null;

const ListSection = ({ title, items, color = '#4a5568', itemColor = '#94a3b8', bullet = '›' }) => items?.length ? (
  <div>
    <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color }}>{title}</div>
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm" style={{ color: itemColor }}>
          <span style={{ color }}>{bullet}</span>{item}
        </li>
      ))}
    </ul>
  </div>
) : null;

export default function Analysis() {
  const { agents, setAgents, activeJob, setActiveJob, jobProgress, jobMessage, currentAnalysis, setCurrentAnalysis } = useStore();
  const [form, setForm] = useState({ symbol: '', name: '', assetType: 'equity', alphaVantageKey: '' });
  const [err, setErr] = useState('');

  useEffect(() => { agentsApi.list().then(setAgents).catch(() => {}); }, []);

  async function run(e) {
    e.preventDefault(); setErr('');
    if (!form.symbol.trim()) return setErr('Symbol is required');
    if (!agents.filter(a => a.enabled !== false).length) return setErr('Add at least one enabled agent first');
    setCurrentAnalysis(null);
    setActiveJob({ status: 'running' });
    try {
      await analysisApi.run({ ...form, symbol: form.symbol.trim().toUpperCase() });
    } catch (e2) {
      setErr(typeof e2 === 'string' ? e2 : 'Failed to start');
      setActiveJob(null);
    }
  }

  const isRunning = activeJob?.status === 'running';
  const a = currentAnalysis;
  const syn = a?.synthesis;
  const dir = syn?.primaryDirection;

  const inp = { background: '#080a0f', border: '1px solid #1c2333', borderRadius: 6, padding: '7px 11px', color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, outline: 'none' };

  return (
    <div className="max-w-6xl mx-auto space-y-5 anim-up">
      <div>
        <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>Analysis</h1>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
          Run a complete omniscient analysis — every available data source, all agents, full butterfly chain reasoning
        </p>
      </div>

      {/* Run form */}
      <CardP>
        <form onSubmit={run} className="flex flex-wrap gap-4 items-end">
          {[
            { label: 'Symbol *', key: 'symbol', w: 120, ph: 'AAPL', upper: true },
            { label: 'Name', key: 'name', w: 180, ph: 'Apple Inc.' },
          ].map(f => (
            <div key={f.key}>
              <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value }))}
                style={{ ...inp, width: f.w }} placeholder={f.ph} disabled={isRunning} />
            </div>
          ))}
          <div>
            <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>Asset Type</label>
            <select value={form.assetType} onChange={e => setForm(p => ({ ...p, assetType: e.target.value }))} style={inp} disabled={isRunning}>
              {['equity', 'crypto', 'forex', 'commodity', 'index', 'etf', 'bond', 'reit'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>Alpha Vantage Key</label>
            <input type="password" value={form.alphaVantageKey} onChange={e => setForm(p => ({ ...p, alphaVantageKey: e.target.value }))}
              style={{ ...inp, width: 200 }} placeholder="Optional — better price data" disabled={isRunning} />
          </div>
          <button type="submit" disabled={isRunning} className="mono font-medium text-sm px-5 py-2 rounded disabled:opacity-50" style={{ background: '#00c8ff', color: '#080a0f' }}>
            {isRunning ? '⟳ Running...' : '▶ Run Analysis'}
          </button>
        </form>
        {err && <p className="mono text-xs mt-3" style={{ color: '#ff3d5a' }}>{err}</p>}
      </CardP>

      {/* Progress */}
      {isRunning && (
        <CardP className="space-y-3 anim-fade">
          <div className="flex items-center justify-between">
            <span className="mono text-sm" style={{ color: '#e2e8f0' }}>Analyzing...</span>
            <span className="mono text-sm" style={{ color: '#00c8ff' }}>{jobProgress}%</span>
          </div>
          <div className="rounded-full" style={{ height: 2, background: '#1c2333' }}>
            <div className="rounded-full transition-all duration-500" style={{ height: 2, width: `${jobProgress}%`, background: '#00c8ff' }} />
          </div>
          <p className="mono text-xs" style={{ color: '#4a5568' }}>{jobMessage}</p>
        </CardP>
      )}

      {/* Results */}
      {a && (
        <div className="space-y-4 anim-up">

          {/* Stats bar */}
          {a.stats && (
            <CardP>
              <div className="flex items-center gap-6 flex-wrap">
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>Run Stats</span>
                {[
                  ['Agents', a.stats.phase1Agents],
                  ['Synths', a.stats.synthAgents],
                  ['Nodes', a.stats.totalNodes],
                  ['Edges', a.stats.totalEdges],
                  ['Social', `${a.stats.socialPostsTotal} posts`],
                  ['Weather', `${a.stats.weatherAlertsCount} alerts`],
                  ['Data', a.stats.dataSources],
                  ['Duration', `${(a.durationMs / 1000).toFixed(0)}s`],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="mono text-xs" style={{ color: '#4a5568' }}>{k}</span>
                    <span className="mono font-semibold text-sm" style={{ color: '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
                {a.stats.superSynthUsed && <span className="mono text-xs px-2 py-1 rounded" style={{ color: '#f472b6', border: '1px solid rgba(244,114,182,0.25)' }}>super synth active</span>}
              </div>
            </CardP>
          )}

          {/* Main result */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="col-span-2 p-6 flex flex-col items-center justify-center">
              <div className="mono text-xs mb-4 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                {a.asset?.symbol} · {new Date(a.createdAt).toLocaleString()}
              </div>
              <ProbabilityGauge synthesis={syn} />
              {a.price && (
                <div className="mt-4 text-center">
                  <div className="mono text-xl font-bold" style={{ color: '#e2e8f0' }}>${a.price.price?.toFixed(2)}</div>
                  <div className="mono text-sm" style={{ color: a.price.changePct >= 0 ? '#00e676' : '#ff3d5a' }}>
                    {a.price.changePct >= 0 ? '+' : ''}{a.price.changePct?.toFixed(2)}% today
                  </div>
                  {a.dataSnapshot?.optionsSummary && (
                    <div className="mono text-xs mt-1" style={{ color: '#4a5568' }}>
                      P/C: {a.dataSnapshot.optionsSummary.putCallRatio} · {a.dataSnapshot.optionsSummary.signal}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="col-span-3 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="mono font-semibold text-xl" style={{ color: '#e2e8f0' }}>{a.asset?.symbol}</span>
                  {a.asset?.name && <span className="text-sm ml-2" style={{ color: '#4a5568' }}>{a.asset.name}</span>}
                </div>
                <span className="mono text-sm font-semibold px-3 py-1 rounded" style={{
                  color: dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740',
                  border: `1px solid ${dir === 'up' ? 'rgba(0,230,118,0.3)' : dir === 'down' ? 'rgba(255,61,90,0.3)' : 'rgba(255,215,64,0.3)'}`,
                  background: dir === 'up' ? 'rgba(0,230,118,0.05)' : dir === 'down' ? 'rgba(255,61,90,0.05)' : 'rgba(255,215,64,0.05)',
                }}>{dir?.toUpperCase()}</span>
              </div>
              {syn?.summary && <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{syn.summary}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded p-3" style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#00e676' }}>BULL CASE <span>{syn?.upProbability}%</span></div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn?.bullCase}</p>
                </div>
                <div className="rounded p-3" style={{ background: 'rgba(255,61,90,0.04)', border: '1px solid rgba(255,61,90,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#ff3d5a' }}>BEAR CASE <span>{syn?.downProbability}%</span></div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn?.bearCase}</p>
                </div>
              </div>
              {a.dataSnapshot?.analystRatings && (
                <div className="mono text-xs" style={{ color: '#4a5568' }}>
                  Analysts: <span style={{ color: '#e2e8f0' }}>{a.dataSnapshot.analystRatings.recommendation?.toUpperCase()}</span>
                  {' · '}Target: <span style={{ color: '#e2e8f0' }}>${a.dataSnapshot.analystRatings.targetPrice}</span>
                  {' · '}{a.dataSnapshot.analystRatings.numAnalysts} analysts
                </div>
              )}
            </Card>
          </div>

          {/* Deep analysis panels */}
          <div className="grid grid-cols-2 gap-4">
            <CardP className="space-y-4">
              <SSection title="Technical Picture" content={syn?.technicalPicture} color="#60a5fa" />
              <SSection title="Fundamental Picture" content={syn?.fundamentalPicture} color="#a78bfa" />
              <SSection title="Signal Conflicts" content={syn?.signalConflicts} color="#ffd740" />
              {syn?.synthesizerAgreement && <SSection title="Synthesizer Agreement" content={syn.synthesizerAgreement} color="#f472b6" />}
            </CardP>
            <CardP className="space-y-4">
              <SSection title="World State Highlights" content={syn?.worldStateHighlights} color="#34d399" />
              <SSection title="Social Signal Assessment" content={syn?.socialAssessment} color="#818cf8" />
              {a.dataSnapshot?.weatherAlerts?.length > 0 && (
                <div>
                  <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color: '#ffd740' }}>⚠ Weather Alerts</div>
                  {a.dataSnapshot.weatherAlerts.map((w, i) => (
                    <div key={i} className="mb-1.5">
                      <span className="mono text-xs" style={{ color: '#e2e8f0' }}>{w.region}</span>
                      <span className="text-xs ml-2" style={{ color: '#4a5568' }}>[{w.importance}]</span>
                      {w.alerts.map((al, j) => <div key={j} className="mono text-xs mt-0.5 ml-2" style={{ color: '#ffd740' }}>› {al}</div>)}
                    </div>
                  ))}
                </div>
              )}
              {a.dataSnapshot?.commodities?.length > 0 && (
                <div>
                  <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color: '#4a5568' }}>Commodity Moves</div>
                  <div className="grid grid-cols-2 gap-1">
                    {a.dataSnapshot.commodities.slice(0, 8).map((c, i) => (
                      <div key={i} className="mono text-xs flex justify-between" style={{ color: '#4a5568' }}>
                        <span>{c.name}</span>
                        <span style={{ color: c.direction === 'up' ? '#00e676' : c.direction === 'down' ? '#ff3d5a' : '#4a5568' }}>
                          {c.changePct > 0 ? '+' : ''}{c.changePct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardP>
          </div>

          {/* Butterfly effects */}
          {syn?.topButterflyEffects?.length > 0 && (
            <CardP>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#ffd740' }}>🦋 Top Butterfly Effect Chains</div>
              <div className="space-y-2">
                {syn.topButterflyEffects.map((b, i) => (
                  <div key={i} className="flex gap-2 text-sm" style={{ color: '#94a3b8' }}>
                    <span className="mono mt-0.5" style={{ color: '#ffd740' }}>{i + 1}.</span>{b}
                  </div>
                ))}
              </div>
            </CardP>
          )}

          {/* Catalysts + Risks */}
          <div className="grid grid-cols-2 gap-4">
            <CardP><ListSection title="Top Catalysts" items={syn?.topCatalysts} color="#00e676" itemColor="#94a3b8" bullet="›" /></CardP>
            <CardP><ListSection title="Key Risks" items={syn?.keyRisks} color="#ff3d5a" itemColor="#94a3b8" bullet="›" /></CardP>
          </div>

          {/* Agent graph */}
          {a.graph && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1c2333' }}>
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>Phase 1 Intelligence Graph</span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>
                  {a.graph.stats?.totalNodes} nodes · {a.graph.stats?.totalEdges} edges · {a.graph.stats?.bull}B/{a.graph.stats?.bear}Be/{a.graph.stats?.neut}N
                </span>
              </div>
              <div style={{ height: 420 }}>
                <AgentGraph graph={a.graph} />
              </div>
            </Card>
          )}

          {/* Multiple synthesizer outputs */}
          {a.synthesizerOutputs?.length > 1 && (
            <div>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>Phase 2 — Synthesizer Verdicts ({a.synthesizerOutputs.length})</div>
              <div className="grid grid-cols-2 gap-3">
                {a.synthesizerOutputs.map((s, i) => (
                  <CardP key={i}>
                    <div className="mono text-xs mb-2" style={{ color: '#a78bfa' }}>{s.agentName}</div>
                    <div className="mono text-sm font-bold mb-1" style={{ color: s.primaryDirection === 'up' ? '#00e676' : s.primaryDirection === 'down' ? '#ff3d5a' : '#ffd740' }}>
                      {s.primaryDirection?.toUpperCase()} · UP {s.upProbability}% · DOWN {s.downProbability}%
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{s.summary?.slice(0, 300)}</p>
                  </CardP>
                ))}
              </div>
            </div>
          )}

          {/* Individual agent outputs */}
          {a.agentOutputs?.length > 0 && (
            <div>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#4a5568' }}>
                Phase 1 — All Agent Contributions ({a.agentOutputs.length})
              </div>
              <div className="grid grid-cols-2 gap-3">
                {a.agentOutputs.map((o, i) => <AgentOutputCard key={i} output={o} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
