/**
 * SocketIO hook — connects to Flask-SocketIO backend for real-time task updates.
 * Uses plain WebSocket protocol compatible with SocketIO v4 (no library needed for basic events).
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useSocketIO() {
  const { setWsConnected, setActiveJob, setCurrentAnalysis } = useStore();
  const pollRef = useRef(null);
  const activeTaskRef = useRef(null);

  // Store activeJob ref so polling can read it
  const { activeJob } = useStore();
  useEffect(() => { activeTaskRef.current = activeJob; }, [activeJob]);

  useEffect(() => {
    // Flask-SocketIO uses long-polling or WebSocket transport
    // We use the REST polling approach as the most reliable fallback
    // Real SocketIO connection via native WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl  = `${proto}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;

    let ws = null;
    let reconnectTimer = null;
    let pingTimer = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          // Send SocketIO handshake
          ws.send('2probe');
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('2');
          }, 25000);
        };

        ws.onclose = () => {
          setWsConnected(false);
          clearInterval(pingTimer);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();

        ws.onmessage = (e) => {
          const raw = e.data;
          if (!raw || raw === '3' || raw === '3probe') return;
          // Parse SocketIO packet: '42["event", data]'
          const m = raw.match(/^42\["([^"]+)",(.*)\]$/s);
          if (!m) return;
          const event = m[1];
          let data;
          try { data = JSON.parse(m[2]); } catch (_) { return; }
          handleEvent(event, data);
        };
      } catch (_) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    function handleEvent(event, data) {
      if (event === 'task_update') {
        const task = data;
        if (task.status === 'running') {
          setActiveJob({ status: 'running', progress: task.progress, message: task.message });
        } else if (task.status === 'completed' && task.result?.analysis) {
          setActiveJob({ status: 'done', progress: 100 });
          setCurrentAnalysis(task.result.analysis);
        } else if (task.status === 'failed') {
          setActiveJob({ status: 'error', error: task.error || task.message });
        }
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      ws?.close();
    };
  }, []);

  // Fallback: poll task endpoint if WebSocket fails
  function startPolling(taskId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { analysisApi } = await import('../utils/api');
        const res = await analysisApi.task(taskId);
        if (!res.success) return;
        const task = res.data;
        if (task.status === 'running') {
          setActiveJob({ status: 'running', progress: task.progress, message: task.message });
        } else if (task.status === 'completed' && task.result?.analysis) {
          clearInterval(pollRef.current);
          setActiveJob({ status: 'done', progress: 100 });
          setCurrentAnalysis(task.result.analysis);
        } else if (task.status === 'failed') {
          clearInterval(pollRef.current);
          setActiveJob({ status: 'error', error: task.error || task.message });
        }
      } catch (_) {}
    }, 1500);
  }

  return { startPolling };
}
