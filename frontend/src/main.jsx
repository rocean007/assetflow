import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout    from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects  from './pages/Projects';
import Agents    from './pages/Agents';
import Analyze   from './pages/Analyze';
import Simulation from './pages/Simulation';
import History   from './pages/History';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index           element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="agents"   element={<Agents />} />
          <Route path="analyze"  element={<Analyze />} />
          <Route path="simulate" element={<Simulation />} />
          <Route path="history"  element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
