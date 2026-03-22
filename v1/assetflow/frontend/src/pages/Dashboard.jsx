import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { agentsApi, analysisApi } from '../utils/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import AgentGraph from '../components/AgentGraph';

export default function Dashboard() {
  const navigate = useNavigate();
  const { agents, setAgents, currentAnalysis, analysisHistory, setAnalysisHistory } = useStore();

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {});
    analysisApi.history(5).then(setAnalysisHistory).catch(() => {});
  }, []);

  const latest = currentAnalysis || analysisHistory[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-semibold text-white">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Probabilistic multi-agent asset intelligence</p>
        </div>
        <button
          onClick={() => navigate('/analysis')}
          className="px-4 py-2 bg-accent text-bg text-sm font-mono font-medium rounded hover:bg-accent/90 transition-colors"
        >
          + New Analysis
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Agents', value: agents.length, sub: `${agents.filter(a => a.enabled !== false).length} enabled` },
          { label: 'Analyses', value: analysisHistory.length, sub: 'total runs' },
          { label: 'Last Run', value: latest ? new Date(latest.createdAt).toLocaleDateString() : '—', sub: latest?.asset?.symbol || 'no data' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-4">
            <div className="text-muted text-xs font-mono uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-mono font-semibold text-white mt-1">{s.value}</div>
            <div className="text-muted text-xs mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Latest analysis */}
      {latest ? (
        <div className="grid grid-cols-5 gap-4">
          {/* Gauge */}
          <div className="col-span-2 bg-surface border border-border rounded-lg p-6 flex flex-col items-center justify-center">
            <div className="text-muted text-xs font-mono mb-4 uppercase tracking-wider">
              {latest.asset?.symbol} — Next Day Probability
            </div>
            <ProbabilityGauge synthesis={latest.synthesis} />
          </div>

          {/* Summary */}
          <div className="col-span-3 bg-surface border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-mono font-semibold">{latest.asset?.symbol}</span>
              <span className="text-muted text-xs font-mono">
                {new Date(latest.createdAt).toLocaleString()}
              </span>
            </div>
            {latest.synthesis?.summary && (
              <p className="text-sm text-gray-300 leading-relaxed">{latest.synthesis.summary}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-up/5 border border-up/20 rounded p-3">
                <div className="text-up text-xs font-mono mb-1">BULL CASE</div>
                <p className="text-sm text-gray-300">{latest.synthesis?.bullCase || '—'}</p>
              </div>
              <div className="bg-down/5 border border-down/20 rounded p-3">
                <div className="text-down text-xs font-mono mb-1">BEAR CASE</div>
                <p className="text-sm text-gray-300">{latest.synthesis?.bearCase || '—'}</p>
              </div>
            </div>
            {latest.synthesis?.topCatalysts?.length > 0 && (
              <div>
                <div className="text-muted text-xs font-mono mb-2">TOP CATALYSTS</div>
                <div className="flex flex-wrap gap-2">
                  {latest.synthesis.topCatalysts.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded font-mono">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">◎</div>
          <div className="text-white font-mono mb-2">No analyses yet</div>
          <p className="text-muted text-sm mb-4">Configure agents and run your first analysis</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/agents')} className="px-4 py-2 border border-border rounded text-sm font-mono hover:border-accent hover:text-accent transition-colors">
              Configure Agents
            </button>
            <button onClick={() => navigate('/analysis')} className="px-4 py-2 bg-accent text-bg rounded text-sm font-mono font-medium hover:bg-accent/90 transition-colors">
              Run Analysis
            </button>
          </div>
        </div>
      )}

      {/* Agent graph preview */}
      {latest?.graph && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden" style={{ height: 340 }}>
          <div className="px-4 py-3 border-b border-border">
            <span className="text-muted text-xs font-mono uppercase tracking-wider">Agent Signal Graph</span>
          </div>
          <div style={{ height: 300 }}>
            <AgentGraph graph={latest.graph} />
          </div>
        </div>
      )}
    </div>
  );
}
