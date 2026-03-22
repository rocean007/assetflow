import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout    from './components/Layout';
import Dashboard from './pages/Dashboard';
import Agents    from './pages/Agents';
import Analysis  from './pages/Analysis';
import History   from './pages/History';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index          element={<Dashboard />} />
          <Route path="agents"   element={<Agents />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="history"  element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
