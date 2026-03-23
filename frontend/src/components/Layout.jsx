import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useStore } from '../store';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: '⬡' },
  { to: '/projects', label: 'Projects',  icon: '◈' },
  { to: '/agents',   label: 'Agents',    icon: '⬢' },
  { to: '/analyze',  label: 'Analyze',   icon: '◎' },
  { to: '/simulate', label: 'Simulate',  icon: '◷' },
  { to: '/history',  label: 'History',   icon: '⊞' },
];

export default function Layout() {
  useSocket();
  const { wsConnected, agents, activeJob } = useStore();
  const running = activeJob?.status === 'running';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#060912' }}>
      <header style={{ background: 'rgba(6,9,18,.97)', borderBottom: '1px solid #1e2433',
                       position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
            <div style={{ width: 28, height: 28, border: '1px solid #0ea5e9', borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#0ea5e9', fontSize: 14, fontFamily: 'monospace' }}>⬡</span>
            </div>
            <span className="mono" style={{ color: '#e2e8f0', fontWeight: 600, letterSpacing: '-0.5px', fontSize: 15 }}>
              AssetFlow
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 5, textDecoration: 'none',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                  background: isActive ? 'rgba(14,165,233,.12)' : 'transparent',
                  color: isActive ? '#0ea5e9' : '#64748b',
                  border: isActive ? '1px solid rgba(14,165,233,.25)' : '1px solid transparent',
                  transition: 'all .15s',
                })}>
                <span>{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>

          {/* Status bar */}
          <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#374151' }}>
            {running && (
              <span className="blink" style={{ color: '#f59e0b' }}>
                ● {activeJob.progress || 0}% {activeJob.message?.slice(0,40)}
              </span>
            )}
            <span>{agents.length} agents</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5,
                           color: wsConnected ? '#10b981' : '#374151' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                             background: wsConnected ? '#10b981' : '#374151',
                             ...(wsConnected ? { boxShadow: '0 0 6px #10b981' } : {}) }} />
              {wsConnected ? 'live' : 'offline'}
            </span>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1400, margin: '0 auto', padding: '28px 24px', width: '100%' }}>
        <Outlet />
      </main>

      <footer style={{ borderTop: '1px solid #1e2433', padding: '10px 24px',
                       textAlign: 'center', fontFamily: 'monospace', fontSize: 10, color: '#1e2433' }}>
        AssetFlow — multi-agent probabilistic intelligence
      </footer>
    </div>
  );
}
