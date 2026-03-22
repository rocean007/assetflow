import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';

const Card = ({ children, className = '' }) => (
  <div className={`rounded-lg p-4 ${className}`} style={{ background: '#0f1218', border: '1px solid #1c2333' }}>{children}</div>
);

export default function Dashboard() {
  const nav = useNavigate();
  const { agents, setAgents, currentAnalysis, history, setHistory } = useStore();

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {});
    analysisApi.history(5).then(setHistory).catch(() => {});
  }, []);

  const latest = currentAnalysis || history[0];

  return (
    <div className="max-w-6xl mx-auto space-y-5 anim-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a5568' }}>Probabilistic multi-agent asset intelligence</p>
        </div>
        <button onClick={() => nav('/analysis')} className="mono text-sm font-medium px-4 py-2 rounded transition-colors" style={{ background: '#00c8ff', color: '#080a0f' }}>
          + Run Analysis
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Agents', value: agents.length, sub: `${agents.filter(a => a.enabled !== false).length} enabled` },
          { label: 'Analyses', value: history.length, sub: 'total runs' },
          { label: 'Data Sources', value: '25+', sub: 'categories fetched' },
          { label: 'Last Run', value: latest ? new Date(latest.createdAt).toLocaleDateString() : '—', sub: latest?.asset?.symbol || 'no data' },
        ].map(s => (
          <Card key={s.label}>
            <div className="mono text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5568' }}>{s.label}</div>
            <div className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5568' }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-5 gap-4">
            <Card className="col-span-2 flex flex-col items-center justify-center py-6">
              <div className="mono text-xs mb-4 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                {latest.asset?.symbol} — Next Day
              </div>
              <ProbabilityGauge synthesis={latest.synthesis} />
            </Card>
            <Card className="col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="mono font-semibold" style={{ color: '#e2e8f0' }}>{latest.asset?.symbol}</span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>{new Date(latest.createdAt).toLocaleString()}</span>
              </div>
              {latest.synthesis?.summary && (
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{latest.synthesis.summary}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded p-3" style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#00e676' }}>
                    BULL CASE <span>{latest.synthesis?.upProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{latest.synthesis?.bullCase}</p>
                </div>
                <div className="rounded p-3" style={{ background: 'rgba(255,61,90,0.04)', border: '1px solid rgba(255,61,90,0.15)' }}>
                  <div className="mono text-xs mb-1.5 flex justify-between" style={{ color: '#ff3d5a' }}>
                    BEAR CASE <span>{latest.synthesis?.downProbability}%</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{latest.synthesis?.bearCase}</p>
                </div>
              </div>
              {latest.synthesis?.topButterflyEffects?.length > 0 && (
                <div>
                  <div className="mono text-xs mb-1.5" style={{ color: '#4a5568' }}>🦋 TOP BUTTERFLY CHAINS</div>
                  {latest.synthesis.topButterflyEffects.slice(0, 2).map((b, i) => (
                    <div key={i} className="text-xs flex gap-1.5 mb-1" style={{ color: '#94a3b8' }}><span style={{ color: '#ffd740' }}>›</span>{b}</div>
                  ))}
                </div>
              )}
              {latest.stats && (
                <div className="mono text-xs flex gap-4 flex-wrap" style={{ color: '#4a5568' }}>
                  <span>agents: <span style={{ color: '#e2e8f0' }}>{latest.stats.phase1Agents}</span></span>
                  <span>nodes: <span style={{ color: '#e2e8f0' }}>{latest.stats.totalNodes}</span></span>
                  <span>edges: <span style={{ color: '#e2e8f0' }}>{latest.stats.totalEdges}</span></span>
                  <span>social: <span style={{ color: '#e2e8f0' }}>{latest.stats.socialPostsTotal}</span> posts</span>
                </div>
              )}
            </Card>
          </div>

          {latest.graph && (
            <Card className="overflow-hidden p-0">
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1c2333' }}>
                <span className="mono text-xs uppercase tracking-wider" style={{ color: '#4a5568' }}>Intelligence Graph</span>
                <span className="mono text-xs" style={{ color: '#4a5568' }}>{latest.graph.stats?.totalNodes} nodes · {latest.graph.stats?.totalEdges} edges</span>
              </div>
              <div style={{ height: 340 }}>
                <AgentGraph graph={latest.graph} />
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="py-16 text-center">
          <div className="text-4xl mb-3">◎</div>
          <div className="mono mb-2" style={{ color: '#e2e8f0' }}>No analyses yet</div>
          <p className="text-sm mb-5" style={{ color: '#4a5568' }}>Add agents, then run your first analysis</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => nav('/agents')} className="mono text-sm px-4 py-2 rounded transition-all" style={{ border: '1px solid #1c2333', color: '#4a5568' }}
              onMouseEnter={e => { e.target.style.borderColor = '#00c8ff'; e.target.style.color = '#00c8ff'; }}
              onMouseLeave={e => { e.target.style.borderColor = '#1c2333'; e.target.style.color = '#4a5568'; }}>
              Configure Agents
            </button>
            <button onClick={() => nav('/analysis')} className="mono text-sm px-4 py-2 rounded" style={{ background: '#00c8ff', color: '#080a0f' }}>
              Run Analysis
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
