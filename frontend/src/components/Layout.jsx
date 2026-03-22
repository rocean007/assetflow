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
  const { wsConnected, agents, activeJob } = useStore();
  const isRunning = activeJob?.status === 'running';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080a0f' }}>
      <header className="border-b flex items-center justify-between px-6 py-3 sticky top-0 z-50" style={{ background: 'rgba(8,10,15,0.97)', borderColor: '#1c2333' }}>
        <div className="flex items-center gap-3">
          <span className="mono font-semibold text-lg tracking-tight" style={{ color: '#00c8ff' }}>AssetFlow</span>
          <span className="mono text-xs" style={{ color: '#4a5568' }}>multi-agent intelligence</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `px-3 py-1.5 rounded text-sm mono transition-all ${isActive ? 'text-white' : 'hover:text-white'}`}
              style={({ isActive }) => isActive ? { background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.2)' } : { color: '#4a5568', border: '1px solid transparent' }}>
              <span className="mr-1.5">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4 mono text-xs" style={{ color: '#4a5568' }}>
          {isRunning && <span style={{ color: '#ffd740' }} className="dot-pulse">● running</span>}
          <span>{agents.length} agents</span>
          <span className="flex items-center gap-1" style={{ color: wsConnected ? '#00e676' : '#4a5568' }}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'dot-pulse' : ''}`} style={{ background: wsConnected ? '#00e676' : '#4a5568' }} />
            {wsConnected ? 'live' : 'offline'}
          </span>
        </div>
      </header>
      <main className="flex-1 p-6 anim-fade"><Outlet /></main>
    </div>
  );
}
