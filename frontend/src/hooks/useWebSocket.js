import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useWebSocket() {
  const { setWsConnected, setJobProgress, setActiveJob, setCurrentAnalysis } = useStore();
  const wsRef = useRef(null);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    let reconnect;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => { setWsConnected(false); reconnect = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data);
          if (event === 'analysis_progress') setJobProgress(data.progress, data.message);
          if (event === 'analysis_complete') {
            setJobProgress(100, 'Complete');
            setActiveJob({ status: 'done' });
            setCurrentAnalysis(data.analysis);
          }
          if (event === 'analysis_error') setActiveJob({ status: 'error', error: data.error });
        } catch (_) {}
      };
    }

    connect();
    return () => { clearTimeout(reconnect); wsRef.current?.close(); };
  }, []);
}
