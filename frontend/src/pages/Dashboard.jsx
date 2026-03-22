import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';

const C = ({ children, className = '' }) => (
  <div className={`rounded-lg ${className}`} style={{ background: '#0f1218', border: '1px solid #1c2333' }}>
    {children}
  </div>
);

// Map Python snake_case synthesis to camelCase for ProbabilityGauge
function mapSyn(s) {
  if (!s) return null;
  return {
    upProbability:      s.upProbability   ?? s.up_probability   ?? 0,
    downProbability:    s.downProbability ?? s.down_probability ?? 0,
    neutralProbability: s.neutralProbability ?? s.neutral_probability ?? 0,
    primaryDirection:   s.primaryDirection  ?? s.primary_direction  ?? 'sideways',
    expectedMagnitude:  s.expectedMagnitude ?? s.expected_magnitude,
    confidence:         s.confidence ?? 0,
    bullCase:           s.bullCase   ?? s.bull_case ?? '',
    bearCase:           s.bearCase   ?? s.bear_case ?? '',
    topButterflyEffects: s.topButterflyEffects ?? s.top_butterfly_effects ?? [],
    summary:             s.summary ?? '',
  };
}

export default function Dashboard() {
  const nav = useNavigate();
  const { agents, setAgents, currentAnalysis, history, setHistory } = useStore();

  useEffect(() => {
    agentsApi.list().then(r => setAgents(r.data || [])).catch(() => {});
    analysisApi.history(5).then(r => setHistory(r.data || [])).catch(() => {});
  }, []);

  const latest = currentAnalysis || history[0];
  const syn    = latest ? mapSyn(latest.synthesis) : null;
  const dir    = syn?.primaryDirection;

  return (
    <div className="max-w-6xl mx-auto space-y-5 anim-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a5568' }}>
            Probabilistic multi-agent asset intelligence
          </p>
        </div>
        <button onClick={() => nav('/analysis')}
          className="mono text-sm font-medium px-4 py-2 rounded"
          style={{ background: '#00c8ff', color: '#080a0f' }}>
          + Run Analysis
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Agents',       value: agents.length,                                         sub: `${agents.filter(a => a.enabled !== false).length} enabled` },
          { label: 'Analyses',     value: history.length,                                        sub: 'total runs' },
          { label: 'Data Sources', value: '25+',                                                 sub: 'categories per run' },
          { label: 'Last Run',     value: latest ? new Date(latest.created_at).toLocaleDateString() : '—', sub: latest?.asset?.symbol || 'no data' },
        ].map(s => (
          <C key={s.label} className="p-4">
            <div className="mono text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5568' }}>{s.label}</div>
            <div className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5568' }}>{s.sub}</div>
          </C>
        ))}
      </div>

      {latest && syn ? (
        <>
          {/* Main result */}
          <div className="grid grid-cols-5 gap-4">
            <C className="col-span-2 p-6 flex flex-col items-center justify-center">
              <div className="mono text-xs mb-4 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                {latest.asset?.symbol} — Next Day
              </div>
              <ProbabilityGauge synthesis={syn} />
            </C>
            <C className="col-span-3 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="mono font-semibold" style={{ color: '#e2e8f0' }}>{latest.asset?.symbol}</span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>
                  {new Date(latest.created_at || latest.createdAt).toLocaleString()}
                </span>
              </div>
              {syn.summary && (
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{syn.summary}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded p-3"
                  style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#00e676' }}>
                    BULL CASE <span>{syn.upProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn.bullCase}</p>
                </div>
                <div className="rounded p-3"
                  style={{ background: 'rgba(255,61,90,0.04)', border: '1px solid rgba(255,61,90,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#ff3d5a' }}>
                    BEAR CASE <span>{syn.downProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{syn.bearCase}</p>
                </div>
              </div>
              {syn.topButterflyEffects?.length > 0 && (
                <div>
                  <div className="mono text-xs mb-1.5" style={{ color: '#4a5568' }}>🦋 BUTTERFLY CHAINS</div>
                  {syn.topButterflyEffects.slice(0, 2).map((b, i) => (
                    <div key={i} className="text-xs flex gap-1.5 mb-1" style={{ color: '#94a3b8' }}>
                      <span style={{ color: '#ffd740' }}>›</span>{b}
                    </div>
                  ))}
                </div>
              )}
              {latest.stats && (
                <div className="mono text-xs flex gap-4 flex-wrap" style={{ color: '#4a5568' }}>
                  {[
                    ['agents',  latest.stats.phase1_agents ?? latest.stats.phase1Agents],
                    ['nodes',   latest.stats.total_nodes   ?? latest.stats.totalNodes],
                    ['edges',   latest.stats.total_edges   ?? latest.stats.totalEdges],
                    ['social',  `${latest.stats.social_total ?? latest.stats.socialTotal ?? 0} posts`],
                  ].map(([k, v]) => (
                    <span key={k}>{k}: <span style={{ color: '#e2e8f0' }}>{v}</span></span>
                  ))}
                </div>
              )}
            </C>
          </div>

          {/* Agent graph */}
          {latest.graph && (
            <C className="overflow-hidden">
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1c2333' }}>
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>
                  Intelligence Graph
                </span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>
                  {latest.graph.stats?.total_nodes} nodes · {latest.graph.stats?.total_edges} edges
                </span>
              </div>
              <div style={{ height: 340 }}>
                <AgentGraph graph={latest.graph} />
              </div>
            </C>
          )}
        </>
      ) : (
        <C className="py-16 text-center">
          <div className="text-4xl mb-3">◎</div>
          <div className="mono mb-2" style={{ color: '#e2e8f0' }}>No analyses yet</div>
          <p className="text-sm mb-5" style={{ color: '#4a5568' }}>
            Built-in free agents are ready — just enter a symbol and run
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => nav('/agents')}
              className="mono text-sm px-4 py-2 rounded"
              style={{ border: '1px solid #1c2333', color: '#4a5568' }}>
              View Agents
            </button>
            <button onClick={() => nav('/analysis')}
              className="mono text-sm px-4 py-2 rounded"
              style={{ background: '#00c8ff', color: '#080a0f' }}>
              Run Analysis
            </button>
          </div>
        </C>
      )}
    </div>
  );
}
