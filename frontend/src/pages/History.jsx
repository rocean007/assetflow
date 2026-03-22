import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { analysisApi } from '../utils/api';

export default function History() {
  const { history, setHistory, setCurrentAnalysis } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisApi.history(100)
      .then(r => { setHistory(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function open(id) {
    try {
      const res = await analysisApi.get(id);
      if (res.success) setCurrentAnalysis(res.data);
    } catch (_) {}
  }

  if (loading) return (
    <div className="mono text-sm p-8" style={{ color: '#4a5568' }}>Loading…</div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 anim-up">
      <div>
        <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>History</h1>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
          {history.length} past analyses stored locally
        </p>
      </div>

      {!history.length ? (
        <div className="rounded-lg p-12 text-center mono text-sm"
          style={{ background: '#0f1218', border: '1px solid #1c2333', color: '#4a5568' }}>
          No analyses yet. Run your first from the Analyze tab.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(a => {
            const syn = a.synthesis || {};
            const dir = syn.primaryDirection ?? syn.primary_direction ?? 'sideways';
            const up  = syn.upProbability   ?? syn.up_probability   ?? 0;
            const dn  = syn.downProbability ?? syn.down_probability ?? 0;
            const conf= syn.confidence ?? 0;
            const dirColor = dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740';
            const stats = a.stats || {};

            return (
              <div key={a.id} onClick={() => open(a.id)}
                className="rounded-lg p-4 cursor-pointer transition-all"
                style={{ background: '#0f1218', border: '1px solid #1c2333' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,200,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1c2333'}>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="mono font-semibold w-16" style={{ color: '#e2e8f0' }}>
                      {a.asset?.symbol}
                    </span>
                    <span className="mono text-xs px-2 py-0.5 rounded"
                      style={{ color: dirColor, border: `1px solid ${dirColor}40` }}>
                      {dir.toUpperCase()}
                    </span>
                    <span className="mono text-xs" style={{ color: '#00e676' }}>↑{up}%</span>
                    <span className="mono text-xs" style={{ color: '#ff3d5a' }}>↓{dn}%</span>
                    {a.price?.price && (
                      <span className="mono text-xs" style={{ color: '#4a5568' }}>
                        ${a.price.price.toFixed(2)}
                      </span>
                    )}
                    <span className="mono text-xs" style={{ color: '#4a5568' }}>
                      {stats.phase1_agents ?? stats.phase1Agents ?? '?'} agents
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mono text-xs" style={{ color: '#4a5568' }}>
                    <span>conf {conf}%</span>
                    <span>{new Date(a.created_at || a.createdAt).toLocaleString()}</span>
                    <span style={{ color: '#00c8ff' }}>›</span>
                  </div>
                </div>

                {syn.summary && (
                  <p className="text-xs mt-2 leading-relaxed"
                    style={{ color: '#4a5568',
                             display: '-webkit-box', WebkitLineClamp: 2,
                             WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {syn.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
