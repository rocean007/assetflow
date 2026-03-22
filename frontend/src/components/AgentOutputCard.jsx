import { useState } from 'react';

const SIGNAL_STYLE = {
  bullish: { color: 'text-up', border: 'border-up/20', bg: 'bg-up/5' },
  bearish: { color: 'text-down', border: 'border-down/20', bg: 'bg-down/5' },
  neutral: { color: 'text-neutral', border: 'border-neutral/20', bg: 'bg-neutral/5' },
};

export default function AgentOutputCard({ output }) {
  const [expanded, setExpanded] = useState(false);
  const style = SIGNAL_STYLE[output.signal] || SIGNAL_STYLE.neutral;

  return (
    <div className={`bg-surface border rounded-lg p-4 ${output.error ? 'border-down/20 opacity-60' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-white text-sm font-mono font-medium">{output.roleName}</span>
          <span className="text-muted text-xs font-mono ml-2">{output.agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${style.color} ${style.border} ${style.bg}`}>
            {output.signal?.toUpperCase() || '?'}
          </span>
          <span className="text-muted text-xs font-mono">{output.confidence}%</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="w-full bg-border rounded-full h-0.5 mb-3">
        <div className="h-0.5 rounded-full transition-all duration-700"
          style={{ width: `${output.confidence}%`, background: output.signal === 'bullish' ? '#00e676' : output.signal === 'bearish' ? '#ff3d5a' : '#ffd740' }} />
      </div>

      <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{output.reasoning}</p>

      {(output.keyFactors?.length > 0 || output.butterflies?.length > 0) && (
        <button onClick={() => setExpanded(x => !x)} className="text-accent text-xs font-mono mt-2 hover:underline">
          {expanded ? '▾ Less' : '▸ More'}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {output.keyFactors?.length > 0 && (
            <div>
              <div className="text-muted text-xs font-mono mb-1">KEY FACTORS</div>
              <ul className="space-y-0.5">
                {output.keyFactors.map((f, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-accent">›</span>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {output.butterflies?.length > 0 && (
            <div>
              <div className="text-muted text-xs font-mono mb-1">🦋 BUTTERFLY EFFECTS</div>
              <ul className="space-y-0.5">
                {output.butterflies.map((b, i) => (
                  <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-yellow-500">›</span>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
