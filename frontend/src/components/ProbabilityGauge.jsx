export default function ProbabilityGauge({ synthesis }) {
  if (!synthesis) return null;
  const up = synthesis.upProbability || 0;
  const dn = synthesis.downProbability || 0;
  const side = synthesis.neutralProbability || Math.max(0, 100 - up - dn);
  const dir = synthesis.primaryDirection;
  const main = dir === 'up' ? up : dir === 'down' ? dn : side;
  const color = dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740';

  const r = 68, cx = 88, cy = 88;
  const toRad = deg => (deg - 180) * Math.PI / 180;
  const arc = (s, e) => {
    const sx = cx + r * Math.cos(toRad(s)), sy = cy + r * Math.sin(toRad(s));
    const ex = cx + r * Math.cos(toRad(e)), ey = cy + r * Math.sin(toRad(e));
    return `M ${sx} ${sy} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${ex} ${ey}`;
  };

  const dnEnd = (dn / 100) * 180;
  const sideEnd = dnEnd + (side / 100) * 180;
  const needleDeg = (main / 100) * 180 - 90;
  const nx = cx + 52 * Math.cos((needleDeg - 90) * Math.PI / 180);
  const ny = cy + 52 * Math.sin((needleDeg - 90) * Math.PI / 180);

  return (
    <div className="flex flex-col items-center w-full">
      <svg width="176" height="96" viewBox="0 0 176 96">
        <path d={arc(0, 180, r)} fill="none" stroke="#1c2333" strokeWidth="11" strokeLinecap="round" />
        {dn > 0 && <path d={arc(0, dnEnd)} fill="none" stroke="#ff3d5a" strokeWidth="11" strokeLinecap="round" opacity="0.85" />}
        {side > 0 && <path d={arc(dnEnd, sideEnd)} fill="none" stroke="#ffd740" strokeWidth="11" strokeLinecap="round" opacity="0.7" />}
        {up > 0 && <path d={arc(sideEnd, 180)} fill="none" stroke="#00e676" strokeWidth="11" strokeLinecap="round" opacity="0.85" />}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={color} />
      </svg>
      <div className="mono font-bold text-3xl" style={{ color }}>{main}%</div>
      <div className="mono text-xs mt-1" style={{ color: '#4a5568' }}>
        {dir === 'up' ? 'PROBABILITY UP' : dir === 'down' ? 'PROBABILITY DOWN' : 'SIDEWAYS'}
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
        {synthesis.expectedMagnitude && <> · mag: <span style={{ color: '#e2e8f0' }}>{synthesis.expectedMagnitude}</span></>}
      </div>
    </div>
  );
}
