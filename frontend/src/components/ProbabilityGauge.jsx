export default function ProbabilityGauge({ synthesis }) {
  if (!synthesis) return null;

  const up   = synthesis.upProbability   || 0;
  const dn   = synthesis.downProbability || 0;
  const side = synthesis.neutralProbability ?? Math.max(0, 100 - up - dn);
  const dir  = synthesis.primaryDirection;
  const main = dir === 'up' ? up : dir === 'down' ? dn : side;
  const col  = dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740';

  // SVG half-arc gauge
  const R = 68, CX = 88, CY = 88;
  const rad = deg => (deg - 180) * Math.PI / 180;
  const arc = (s, e) => {
    const x1 = CX + R * Math.cos(rad(s)), y1 = CY + R * Math.sin(rad(s));
    const x2 = CX + R * Math.cos(rad(e)), y2 = CY + R * Math.sin(rad(e));
    return `M ${x1} ${y1} A ${R} ${R} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  const dnEnd   = (dn   / 100) * 180;
  const sideEnd = dnEnd + (side / 100) * 180;
  const needleDeg = (main / 100) * 180 - 90;
  const nx = CX + 52 * Math.cos((needleDeg - 90) * Math.PI / 180);
  const ny = CY + 52 * Math.sin((needleDeg - 90) * Math.PI / 180);

  return (
    <div className="flex flex-col items-center w-full">
      <svg width="176" height="96" viewBox="0 0 176 96">
        <path d={arc(0, 180)} fill="none" stroke="#1c2333" strokeWidth="11" strokeLinecap="round" />
        {dn   > 0 && <path d={arc(0, dnEnd)}          fill="none" stroke="#ff3d5a" strokeWidth="11" opacity="0.85" />}
        {side > 0 && <path d={arc(dnEnd, sideEnd)}    fill="none" stroke="#ffd740" strokeWidth="11" opacity="0.65" />}
        {up   > 0 && <path d={arc(sideEnd, 180)}      fill="none" stroke="#00e676" strokeWidth="11" opacity="0.85" />}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="4" fill={col} />
      </svg>

      <div className="mono font-bold text-3xl mt-1" style={{ color: col }}>{main}%</div>
      <div className="mono text-xs mt-1 uppercase tracking-wider" style={{ color: '#4a5568' }}>
        {dir === 'up' ? 'probability up' : dir === 'down' ? 'probability down' : 'sideways'}
      </div>

      <div className="w-full mt-4 space-y-1.5">
        {[['UP', up, '#00e676'], ['SIDE', side, '#ffd740'], ['DOWN', dn, '#ff3d5a']].map(([label, pct, c]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="mono text-xs w-8" style={{ color: c }}>{label}</span>
            <div className="flex-1 rounded-full h-1" style={{ background: '#1c2333' }}>
              <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
            </div>
            <span className="mono text-xs w-8 text-right" style={{ color: '#4a5568' }}>{pct}%</span>
          </div>
        ))}
      </div>

      <div className="mono text-xs mt-3" style={{ color: '#4a5568' }}>
        conf: <span style={{ color: '#e2e8f0' }}>{synthesis.confidence || 0}%</span>
        {synthesis.expectedMagnitude && (
          <> · mag: <span style={{ color: '#e2e8f0' }}>{synthesis.expectedMagnitude}</span></>
        )}
      </div>
    </div>
  );
}
