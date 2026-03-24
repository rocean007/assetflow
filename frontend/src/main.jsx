import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout   from './components/Layout';
import Home     from './pages/Home';
import NewRun   from './pages/NewRun';
import Run      from './pages/Run';
import Agents   from './pages/Agents';
import History  from './pages/History';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index       element={<Home />} />
          <Route path="run"  element={<NewRun />} />
          <Route path="run/:sid" element={<Run />} />
          <Route path="agents"   element={<Agents />} />
          <Route path="history"  element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
