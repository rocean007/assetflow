import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import { useSocketIO } from '../hooks/useSocketIO';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';
import AgentOutputCard from '../components/AgentOutputCard';

const Card  = ({ children, className = '' }) => (
  <div className={`rounded-lg ${className}`} style={{ background: '#0f1218', border: '1px solid #1c2333' }}>{children}</div>
);
const CardP = ({ children, className = '' }) => <Card className={`p-5 ${className}`}>{children}</Card>;

const Sec = ({ title, content, color = '#4a5568' }) => content ? (
  <div>
    <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color }}>{title}</div>
    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{content}</p>
  </div>
) : null;

const List = ({ title, items, color = '#4a5568' }) => items?.length ? (
  <div>
    <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color }}>{title}</div>
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm" style={{ color: '#94a3b8' }}>
          <span style={{ color }}>›</span>{item}
        </li>
      ))}
    </ul>
  </div>
) : null;

const inp = { background: '#080a0f', border: '1px solid #1c2333', borderRadius: 6,
              padding: '7px 11px', color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13, outline: 'none' };

export default function Analysis() {
  const { agents, setAgents, activeJob, setActiveJob, currentAnalysis, setCurrentAnalysis } = useStore();
  const { startPolling } = useSocketIO();
  const [form, setForm] = useState({ symbol: '', name: '', asset_type: 'equity', av_key: '' });
  const [err, setErr] = useState('');
  const taskIdRef = useRef(null);

  useEffect(() => { agentsApi.list().then(r => setAgents(r.data || [])).catch(() => {}); }, []);

  async function run(e) {
    e.preventDefault(); setErr('');
    if (!form.symbol.trim()) return setErr('Symbol is required');
    const enabled = agents.filter(a => a.enabled !== false);
    if (!enabled.length) return setErr('Add at least one enabled agent first');

    setCurrentAnalysis(null);
    setActiveJob({ status: 'running', progress: 0, message: 'Starting...' });

    try {
      const res = await analysisApi.run({ ...form, symbol: form.symbol.trim().toUpperCase() });
      if (!res.success) throw new Error(res.error || 'Failed to start');
      taskIdRef.current = res.data.task_id;
      // Always start polling as fallback (SocketIO will override if connected)
      startPolling(res.data.task_id);
    } catch (e2) {
      setErr(typeof e2 === 'string' ? e2 : String(e2));
      setActiveJob(null);
    }
  }

  const isRunning = activeJob?.status === 'running';
  const a = currentAnalysis;
  // Python backend uses snake_case — map to camelCase for components
  const syn = a ? mapSynthesis(a.synthesis) : null;
  const dir = syn?.primaryDirection;

  return (
    <div className="max-w-6xl mx-auto space-y-5 anim-up">
      <div>
        <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>Analysis</h1>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
          Every available data source · all agents · butterfly chain reasoning · real-time progress
        </p>
      </div>

      {/* Run form */}
      <CardP>
        <form onSubmit={run} className="flex flex-wrap gap-4 items-end">
          {[
            { label: 'Symbol *', key: 'symbol', w: 120, ph: 'AAPL', upper: true },
            { label: 'Name',     key: 'name',   w: 180, ph: 'Apple Inc.' },
          ].map(f => (
            <div key={f.key}>
              <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>{f.label}</label>
              <input value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value }))}
                style={{ ...inp, width: f.w }} placeholder={f.ph} disabled={isRunning} />
            </div>
          ))}
          <div>
            <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>Asset Type</label>
            <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))}
              style={inp} disabled={isRunning}>
              {['equity','crypto','forex','commodity','index','etf','bond','reit'].map(t =>
                <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block mono text-xs uppercase tracking-wider mb-1.5" style={{ color: '#4a5568' }}>Alpha Vantage Key</label>
            <input type="password" value={form.av_key}
              onChange={e => setForm(p => ({ ...p, av_key: e.target.value }))}
              style={{ ...inp, width: 200 }} placeholder="Optional — better price data" disabled={isRunning} />
          </div>
          <button type="submit" disabled={isRunning}
            className="mono font-medium text-sm px-5 py-2 rounded disabled:opacity-50"
            style={{ background: '#00c8ff', color: '#080a0f' }}>
            {isRunning ? '⟳ Running...' : '▶ Run Analysis'}
          </button>
        </form>
        {err && <p className="mono text-xs mt-3" style={{ color: '#ff3d5a' }}>{err}</p>}
      </CardP>

      {/* Progress */}
      {isRunning && (
        <CardP className="space-y-3 anim-fade">
          <div className="flex items-center justify-between">
            <span className="mono text-sm" style={{ color: '#e2e8f0' }}>Analyzing…</span>
            <span className="mono text-sm" style={{ color: '#00c8ff' }}>{activeJob.progress || 0}%</span>
          </div>
          <div className="rounded-full" style={{ height: 2, background: '#1c2333' }}>
            <div className="rounded-full transition-all duration-500"
              style={{ height: 2, width: `${activeJob.progress || 0}%`, background: '#00c8ff' }} />
          </div>
          <p className="mono text-xs" style={{ color: '#4a5568' }}>{activeJob.message || '…'}</p>
        </CardP>
      )}

      {/* Error */}
      {activeJob?.status === 'error' && (
        <CardP>
          <p className="mono text-sm" style={{ color: '#ff3d5a' }}>Analysis failed: {activeJob.error}</p>
        </CardP>
      )}

      {/* Results */}
      {a && syn && (
        <div className="space-y-4 anim-up">

          {/* Stats bar */}
          {a.stats && (
            <CardP>
              <div className="flex items-center gap-6 flex-wrap">
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>Run Stats</span>
                {[
                  ['Agents',    a.stats.phase1_agents],
                  ['Synths',    a.stats.synth_agents],
                  ['Nodes',     a.stats.total_nodes],
                  ['Edges',     a.stats.total_edges],
                  ['Social',    `${a.stats.social_total} posts`],
                  ['Alerts',    `${a.stats.weather_alerts} weather`],
                  ['Data',      a.stats.data_sources],
                  ['Duration',  `${(a.duration_ms/1000).toFixed(0)}s`],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="mono text-xs" style={{ color: '#4a5568' }}>{k}</span>
                    <span className="mono font-semibold text-sm" style={{ color: '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
                {a.stats.super_synth_used && (
                  <span className="mono text-xs px-2 py-1 rounded" style={{ color: '#f472b6', border: '1px solid rgba(244,114,182,0.25)' }}>
                    super synth
                  </span>
                )}
              </div>
            </CardP>
          )}

          {/* Main result */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="col-span-2 p-6 flex flex-col items-center justify-center">
              <div className="mono text-xs mb-4 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                {a.asset?.symbol} · {new Date(a.created_at).toLocaleString()}
              </div>
              <ProbabilityGauge synthesis={syn} />
              {a.price && (
                <div className="mt-4 text-center">
                  <div className="mono text-xl font-bold" style={{ color: '#e2e8f0' }}>
                    ${a.price.price?.toFixed(2)}
                  </div>
                  <div className="mono text-sm" style={{ color: a.price.change_pct >= 0 ? '#00e676' : '#ff3d5a' }}>
                    {a.price.change_pct >= 0 ? '+' : ''}{a.price.change_pct?.toFixed(2)}% today
                  </div>
                  {a.data_snapshot?.options && (
                    <div className="mono text-xs mt-1" style={{ color: '#4a5568' }}>
                      P/C: {a.data_snapshot.options.put_call_ratio} · {a.data_snapshot.options.signal}
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
                  color:  dir==='up'?'#00e676':dir==='down'?'#ff3d5a':'#ffd740',
                  border: `1px solid ${dir==='up'?'rgba(0,230,118,0.3)':dir==='down'?'rgba(255,61,90,0.3)':'rgba(255,215,64,0.3)'}`,
                  background: dir==='up'?'rgba(0,230,118,0.05)':dir==='down'?'rgba(255,61,90,0.05)':'rgba(255,215,64,0.05)',
                }}>{dir?.toUpperCase()}</span>
              </div>
              {syn.summary && <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{syn.summary}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded p-3" style={{ background:'rgba(0,230,118,0.04)', border:'1px solid rgba(0,230,118,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#00e676' }}>
                    BULL CASE <span>{syn.upProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn.bullCase}</p>
                </div>
                <div className="rounded p-3" style={{ background:'rgba(255,61,90,0.04)', border:'1px solid rgba(255,61,90,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#ff3d5a' }}>
                    BEAR CASE <span>{syn.downProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn.bearCase}</p>
                </div>
              </div>
              {a.data_snapshot?.analyst?.recommendation && (
                <div className="mono text-xs" style={{ color: '#4a5568' }}>
                  Analysts: <span style={{ color:'#e2e8f0' }}>{a.data_snapshot.analyst.recommendation.toUpperCase()}</span>
                  {' · '}Target: <span style={{ color:'#e2e8f0' }}>${a.data_snapshot.analyst.target_price}</span>
                  {' · '}{a.data_snapshot.analyst.num_analysts} analysts
                </div>
              )}
            </Card>
          </div>

          {/* Deep analysis panels */}
          <div className="grid grid-cols-2 gap-4">
            <CardP className="space-y-4">
              <Sec title="Technical Picture"    content={syn.technicalPicture}    color="#60a5fa" />
              <Sec title="Fundamental Picture"  content={syn.fundamentalPicture}  color="#a78bfa" />
              <Sec title="Signal Conflicts"     content={syn.signalConflicts}     color="#ffd740" />
            </CardP>
            <CardP className="space-y-4">
              <Sec title="World State Highlights"   content={syn.worldStateHighlights}  color="#34d399" />
              <Sec title="Social Signal Assessment" content={syn.socialAssessment}      color="#818cf8" />
              {a.data_snapshot?.weather_alerts?.length > 0 && (
                <div>
                  <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color: '#ffd740' }}>⚠ Weather Alerts</div>
                  {a.data_snapshot.weather_alerts.map((w, i) => (
                    <div key={i} className="mb-2">
                      <span className="mono text-xs" style={{ color: '#e2e8f0' }}>{w.region}</span>
                      <span className="text-xs ml-2" style={{ color: '#4a5568' }}>[{w.importance}]</span>
                      {(w.alerts || []).map((al, j) => (
                        <div key={j} className="mono text-xs mt-0.5 ml-2" style={{ color: '#ffd740' }}>› {al}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {a.data_snapshot?.commodities?.length > 0 && (
                <div>
                  <div className="mono text-xs uppercase tracking-wider mb-2" style={{ color: '#4a5568' }}>Commodities</div>
                  <div className="grid grid-cols-2 gap-1">
                    {a.data_snapshot.commodities.slice(0, 8).map((c, i) => (
                      <div key={i} className="mono text-xs flex justify-between" style={{ color: '#4a5568' }}>
                        <span>{c.name}</span>
                        <span style={{ color: c.direction==='up'?'#00e676':c.direction==='down'?'#ff3d5a':'#4a5568' }}>
                          {c.change_pct > 0 ? '+' : ''}{c.change_pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardP>
          </div>

          {/* Butterfly effects */}
          {syn.topButterflyEffects?.length > 0 && (
            <CardP>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#ffd740' }}>🦋 Top Butterfly Chains</div>
              <div className="space-y-2">
                {syn.topButterflyEffects.map((b, i) => (
                  <div key={i} className="flex gap-2 text-sm" style={{ color: '#94a3b8' }}>
                    <span className="mono mt-0.5" style={{ color: '#ffd740' }}>{i+1}.</span>{b}
                  </div>
                ))}
              </div>
            </CardP>
          )}

          <div className="grid grid-cols-2 gap-4">
            <CardP><List title="Top Catalysts" items={syn.topCatalysts} color="#00e676" /></CardP>
            <CardP><List title="Key Risks"     items={syn.keyRisks}     color="#ff3d5a" /></CardP>
          </div>

          {/* Agent graph */}
          {a.graph && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1c2333' }}>
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>Phase 1 Intelligence Graph</span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>
                  {a.graph.stats?.total_nodes} nodes · {a.graph.stats?.total_edges} edges ·{' '}
                  {a.graph.stats?.bull}B/{a.graph.stats?.bear}Be/{a.graph.stats?.neut}N
                </span>
              </div>
              <div style={{ height: 420 }}>
                <AgentGraph graph={a.graph} />
              </div>
            </Card>
          )}

          {/* Synthesizer outputs */}
          {a.synthesizer_outputs?.length > 1 && (
            <div>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>
                Phase 2 — Synthesizer Verdicts ({a.synthesizer_outputs.length})
              </div>
              <div className="grid grid-cols-2 gap-3">
                {a.synthesizer_outputs.map((s, i) => (
                  <CardP key={i}>
                    <div className="mono text-xs mb-2" style={{ color: '#a78bfa' }}>{s.agent_name}</div>
                    <div className="mono text-sm font-bold mb-1" style={{
                      color: s.primaryDirection==='up'?'#00e676':s.primaryDirection==='down'?'#ff3d5a':'#ffd740'
                    }}>
                      {s.primaryDirection?.toUpperCase()} · ↑{s.upProbability}% ↓{s.downProbability}%
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{s.summary?.slice(0, 300)}</p>
                  </CardP>
                ))}
              </div>
            </div>
          )}

          {/* Agent outputs */}
          {a.agent_outputs?.length > 0 && (
            <div>
              <div className="mono text-xs uppercase tracking-wider mb-3" style={{ color: '#4a5568' }}>
                Phase 1 — All Agent Contributions ({a.agent_outputs.length})
              </div>
              <div className="grid grid-cols-2 gap-3">
                {a.agent_outputs.map((o, i) => <AgentOutputCard key={i} output={mapAgentOutput(o)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Map Python snake_case to camelCase for components
function mapSynthesis(s) {
  if (!s) return null;
  return {
    upProbability:       s.upProbability       ?? s.up_probability       ?? 0,
    downProbability:     s.downProbability     ?? s.down_probability     ?? 0,
    neutralProbability:  s.neutralProbability  ?? s.neutral_probability  ?? 0,
    primaryDirection:    s.primaryDirection    ?? s.primary_direction    ?? 'sideways',
    expectedMagnitude:   s.expectedMagnitude   ?? s.expected_magnitude,
    confidence:          s.confidence          ?? 0,
    bullCase:            s.bullCase            ?? s.bull_case            ?? '',
    bearCase:            s.bearCase            ?? s.bear_case            ?? '',
    keyRisks:            s.keyRisks            ?? s.key_risks            ?? [],
    topCatalysts:        s.topCatalysts        ?? s.top_catalysts        ?? [],
    topButterflyEffects: s.topButterflyEffects ?? s.top_butterfly_effects ?? [],
    socialAssessment:    s.socialAssessment    ?? s.social_assessment,
    worldStateHighlights:s.worldStateHighlights?? s.world_state_highlights,
    signalConflicts:     s.signalConflicts     ?? s.signal_conflicts,
    technicalPicture:    s.technicalPicture    ?? s.technical_picture,
    fundamentalPicture:  s.fundamentalPicture  ?? s.fundamental_picture,
    summary:             s.summary            ?? '',
  };
}

function mapAgentOutput(o) {
  return {
    ...o,
    roleName:    o.role_name    ?? o.roleName    ?? o.role ?? '',
    agentName:   o.agent_name   ?? o.agentName   ?? '',
    keyFactors:  o.key_factors  ?? o.keyFactors  ?? [],
    butterflies: o.butterflies  ?? [],
    manipulationNote: o.manipulation_note ?? o.manipulationNote,
  };
}
