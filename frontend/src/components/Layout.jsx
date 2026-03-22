import { Outlet, NavLink } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useStore } from '../store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/agents', label: 'Agents', icon: '⬡' },
  { to: '/analysis', label: 'Analyze', icon: '◎' },
  { to: '/history', label: 'History', icon: '◷' },
];

export default function Layout() {
  useWebSocket();
  const { wsConnected, agents } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-accent text-xl font-mono font-semibold tracking-tight">AssetFlow</span>
          <span className="text-muted text-xs font-mono">v1.0</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-mono transition-all ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-muted hover:text-white hover:bg-surface'
                }`
              }
            >
              <span className="mr-1.5">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-muted">{agents.length} agents</span>
          <span className={`flex items-center gap-1 ${wsConnected ? 'text-up' : 'text-muted'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-up animate-pulse' : 'bg-muted'}`} />
            {wsConnected ? 'live' : 'offline'}
          </span>
        </div>
      </header>

      <main className="flex-1 p-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
