import { useState } from 'react';

const SIG_STYLE = {
  bullish: { c: '#00e676', bg: 'rgba(0,230,118,0.05)', border: 'rgba(0,230,118,0.2)' },
  bearish: { c: '#ff3d5a', bg: 'rgba(255,61,90,0.05)', border: 'rgba(255,61,90,0.2)' },
  neutral: { c: '#ffd740', bg: 'rgba(255,215,64,0.05)', border: 'rgba(255,215,64,0.2)' },
};

export default function AgentOutputCard({ output }) {
  const [open, setOpen] = useState(false);
  const s = SIG_STYLE[output.signal] || SIG_STYLE.neutral;
  const hasDetails = output.keyFactors?.length || output.butterflies?.length || output.manipulationNote;

  return (
    <div className="rounded-lg p-4"
      style={{ background: '#0f1218', border: `1px solid ${output._error ? 'rgba(255,61,90,0.2)' : '#1c2333'}`,
               opacity: output._error ? 0.6 : 1 }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="mono text-sm font-semibold" style={{ color: '#e2e8f0' }}>
            {output.roleName || output.role_name || output.role}
          </span>
          <span className="mono text-xs ml-2" style={{ color: '#4a5568' }}>
            {output.agentName || output.agent_name}
          </span>
        </div>
        <span className="mono text-xs px-2 py-0.5 rounded"
          style={{ color: s.c, background: s.bg, border: `1px solid ${s.border}` }}>
          {output.signal?.toUpperCase()} {output.confidence}%
        </span>
      </div>

      {/* Confidence bar */}
      <div className="w-full rounded-full mb-3" style={{ height: 2, background: '#1c2333' }}>
        <div className="rounded-full transition-all duration-700"
          style={{ height: 2, width: `${output.confidence}%`, background: s.c }} />
      </div>

      {/* Reasoning */}
      <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
        {output.reasoning || output._parseError && 'Model returned unparseable output.'}
      </p>

      {hasDetails && (
        <button onClick={() => setOpen(x => !x)} className="mono text-xs mt-2 hover:underline"
          style={{ color: '#00c8ff' }}>
          {open ? '▾ less' : '▸ details'}
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-2 anim-up">
          {output.keyFactors?.length > 0 && (
            <div>
              <div className="mono text-xs mb-1" style={{ color: '#4a5568' }}>KEY FACTORS</div>
              {output.keyFactors.map((f, i) => (
                <div key={i} className="text-xs flex gap-1.5 mb-0.5" style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#00c8ff' }}>›</span>{f}
                </div>
              ))}
            </div>
          )}
          {output.butterflies?.length > 0 && (
            <div>
              <div className="mono text-xs mb-1" style={{ color: '#4a5568' }}>🦋 BUTTERFLY CHAINS</div>
              {output.butterflies.map((b, i) => (
                <div key={i} className="text-xs flex gap-1.5 mb-0.5" style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#ffd740' }}>›</span>{b}
                </div>
              ))}
            </div>
          )}
          {output.manipulationNote && (
            <div>
              <div className="mono text-xs mb-1" style={{ color: '#4a5568' }}>MANIPULATION NOTE</div>
              <p className="text-xs" style={{ color: '#94a3b8' }}>{output.manipulationNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
