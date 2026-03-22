import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { analysisApi } from '../utils/api';

export default function History() {
  const { history, setHistory, setCurrentAnalysis } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisApi.history(100).then(h => { setHistory(h); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function open(id) {
    const full = await analysisApi.get(id).catch(() => null);
    if (full) setCurrentAnalysis(full);
  }

  if (loading) return <div className="mono text-sm p-8" style={{ color: '#4a5568' }}>Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5 anim-up">
      <div>
        <h1 className="mono font-semibold text-2xl" style={{ color: '#e2e8f0' }}>History</h1>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>{history.length} past analyses stored locally</p>
      </div>

      {!history.length ? (
        <div className="rounded-lg p-12 text-center mono text-sm" style={{ background: '#0f1218', border: '1px solid #1c2333', color: '#4a5568' }}>
          No analyses yet. Run your first from the Analyze tab.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(a => {
            const dir = a.synthesis?.primaryDirection;
            const up = a.synthesis?.upProbability || 0;
            const dn = a.synthesis?.downProbability || 0;
            const dirColor = dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740';
            return (
              <div key={a.id} onClick={() => open(a.id)}
                className="rounded-lg p-4 cursor-pointer transition-all"
                style={{ background: '#0f1218', border: '1px solid #1c2333' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,200,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1c2333'}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="mono font-semibold w-16" style={{ color: '#e2e8f0' }}>{a.asset?.symbol}</span>
                    <span className="mono text-xs px-2 py-0.5 rounded" style={{ color: dirColor, border: `1px solid ${dirColor}40` }}>
                      {dir?.toUpperCase()}
                    </span>
                    <div className="mono text-xs flex gap-3" style={{ color: '#4a5568' }}>
                      <span style={{ color: '#00e676' }}>↑{up}%</span>
                      <span style={{ color: '#ff3d5a' }}>↓{dn}%</span>
                    </div>
                    {a.price?.price && <span className="mono text-xs" style={{ color: '#4a5568' }}>${a.price.price.toFixed(2)}</span>}
                    {a.stats && (
                      <span className="mono text-xs" style={{ color: '#4a5568' }}>
                        {a.stats.phase1Agents} agents · {a.stats.totalNodes} nodes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mono text-xs" style={{ color: '#4a5568' }}>
                    <span>conf {a.synthesis?.confidence || 0}%</span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                    <span style={{ color: '#00c8ff' }}>›</span>
                  </div>
                </div>
                {a.synthesis?.summary && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: '#4a5568', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.synthesis.summary}
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
