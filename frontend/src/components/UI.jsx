// Shared UI primitives
export const Card = ({ children, style = {} }) => (
  <div style={{ background: '#0d1117', border: '1px solid #1e2433', borderRadius: 8, ...style }}>
    {children}
  </div>
);

export const CardPad = ({ children, style = {} }) => (
  <Card style={{ padding: 20, ...style }}>{children}</Card>
);

export const Badge = ({ label, color = '#64748b' }) => (
  <span className="mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
    background: color + '18', color, border: `1px solid ${color}40` }}>{label}</span>
);

export const Spinner = ({ size = 16 }) => (
  <div style={{ width: size, height: size, border: '2px solid #1e2433',
                borderTopColor: '#0ea5e9', borderRadius: '50%',
                animation: 'spin .7s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const ProgressBar = ({ value, color = '#0ea5e9', height = 2 }) => (
  <div style={{ height, background: '#1e2433', borderRadius: height }}>
    <div style={{ height, width: `${Math.min(100,value||0)}%`, background: color,
                  borderRadius: height, transition: 'width .4s ease' }} />
  </div>
);

export const SigColor = { bullish: '#10b981', bearish: '#f43f5e', neutral: '#f59e0b' };

export const DirColor = (dir) =>
  dir === 'up' ? '#10b981' : dir === 'down' ? '#f43f5e' : '#f59e0b';

export const StatBox = ({ label, value, color = '#94a3b8', sub }) => (
  <CardPad style={{ padding: 16 }}>
    <div className="mono" style={{ fontSize: 10, color: '#374151', textTransform: 'uppercase',
                                   letterSpacing: 1, marginBottom: 6 }}>{label}</div>
    <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: color || '#e2e8f0' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>{sub}</div>}
  </CardPad>
);
