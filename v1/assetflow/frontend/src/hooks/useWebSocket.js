import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useWebSocket() {
  const wsRef = useRef(null);
  const { setWsConnected, setJobProgress, setActiveJob, setCurrentAnalysis } = useStore();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    let reconnectTimer = null;
    let ws = null;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data);
          switch (event) {
            case 'analysis_progress':
              setJobProgress(data.progress, data.message);
              break;
            case 'analysis_complete':
              setJobProgress(100, 'Complete');
              setActiveJob({ ...data, status: 'done' });
              setCurrentAnalysis(data.analysis);
              break;
            case 'analysis_error':
              setActiveJob({ status: 'error', error: data.error });
              break;
          }
        } catch (_) {}
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return wsRef;
}
