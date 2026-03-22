import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { analysisApi } from '../utils/api';

export default function History() {
  const { analysisHistory, setAnalysisHistory, setCurrentAnalysis } = useStore();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    analysisApi.history(50)
      .then(h => { setAnalysisHistory(h); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function viewFull(id) {
    const full = await analysisApi.get(id).catch(() => null);
    if (full) { setCurrentAnalysis(full); setSelected(full); }
  }

  if (loading) return <div className="text-muted font-mono text-sm p-8">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-mono font-semibold text-white">History</h1>
        <p className="text-muted text-sm mt-1">{analysisHistory.length} past analyses</p>
      </div>

      {analysisHistory.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-muted text-sm font-mono">
          No analyses yet. Run your first one in the Analyze tab.
        </div>
      ) : (
        <div className="space-y-2">
          {analysisHistory.map(a => {
            const dir = a.synthesis?.primaryDirection;
            const upP = a.synthesis?.upProbability || 0;
            const downP = a.synthesis?.downProbability || 0;
            return (
              <div key={a.id} className="bg-surface border border-border rounded-lg p-4 hover:border-accent/30 transition-colors cursor-pointer"
                onClick={() => viewFull(a.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-mono font-semibold w-16">{a.asset?.symbol}</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      dir === 'up' ? 'text-up border-up/30 bg-up/5' :
                      dir === 'down' ? 'text-down border-down/30 bg-down/5' :
                      'text-neutral border-neutral/30 bg-neutral/5'
                    }`}>{dir?.toUpperCase() || '?'}</span>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-up">↑{upP}%</span>
                      <span className="text-down">↓{downP}%</span>
                    </div>
                    {a.price?.price && (
                      <span className="text-muted text-xs font-mono">${a.price.price.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted">
                    <span>{a.synthesis?.confidence || 0}% conf</span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                    <span className="text-accent/60">›</span>
                  </div>
                </div>
                {a.synthesis?.summary && (
                  <p className="text-muted text-xs mt-2 leading-relaxed line-clamp-2">{a.synthesis.summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
