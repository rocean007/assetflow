export default function ProbabilityGauge({ synthesis }) {
  if (!synthesis) return null;

  const up = synthesis.upProbability || 0;
  const down = synthesis.downProbability || 0;
  const neutral = synthesis.neutralProbability || Math.max(0, 100 - up - down);

  const dir = synthesis.primaryDirection;
  const mainPct = dir === 'up' ? up : dir === 'down' ? down : neutral;
  const mainColor = dir === 'up' ? '#00e676' : dir === 'down' ? '#ff3d5a' : '#ffd740';

  // SVG arc gauge
  const radius = 70;
  const cx = 90, cy = 90;
  const sweep = 180;
  const toRad = deg => (deg - 180) * Math.PI / 180;

  function arcPath(startDeg, endDeg, r) {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const needleAngle = (mainPct / 100) * 180 - 90; // -90 to +90
  const nx = cx + 55 * Math.cos((needleAngle - 90) * Math.PI / 180);
  const ny = cy + 55 * Math.sin((needleAngle - 90) * Math.PI / 180);

  const upEnd = (up / 100) * 180;
  const neutralEnd = upEnd + (neutral / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Background arc */}
        <path d={arcPath(0, 180, radius)} fill="none" stroke="#1e2430" strokeWidth="12" strokeLinecap="round" />
        {/* Down segment */}
        {down > 0 && <path d={arcPath(0, (down / 100) * 180, radius)} fill="none" stroke="#ff3d5a" strokeWidth="12" opacity="0.8" />}
        {/* Neutral segment */}
        {neutral > 0 && <path d={arcPath((down / 100) * 180, ((down + neutral) / 100) * 180, radius)} fill="none" stroke="#ffd740" strokeWidth="12" opacity="0.6" />}
        {/* Up segment */}
        {up > 0 && <path d={arcPath(((down + neutral) / 100) * 180, 180, radius)} fill="none" stroke="#00e676" strokeWidth="12" opacity="0.8" />}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={mainColor} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={mainColor} />
      </svg>

      {/* Labels */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-3xl font-mono font-bold" style={{ color: mainColor }}>{mainPct}%</span>
      </div>
      <div className="text-muted text-xs font-mono mt-1 uppercase tracking-wider">
        {dir === 'up' ? 'probability up' : dir === 'down' ? 'probability down' : 'sideways'}
      </div>

      {/* Bar breakdown */}
      <div className="w-full mt-4 space-y-1.5">
        {[
          { label: 'UP', pct: up, color: '#00e676' },
          { label: 'SIDE', pct: neutral, color: '#ffd740' },
          { label: 'DOWN', pct: down, color: '#ff3d5a' },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-mono w-8" style={{ color }}>{label}</span>
            <div className="flex-1 bg-border rounded-full h-1">
              <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-xs font-mono text-muted w-8 text-right">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
