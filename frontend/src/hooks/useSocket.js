import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { tasksApi } from '../utils/api';

export function useSocket() {
  const { setWsConnected, setActiveJob, setCurrentAnalysis } = useStore();
  const pollRef = useRef(null);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;
    let ws, ping, retry;

    function connect() {
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          setWsConnected(true);
          ws.send('2probe');
          ping = setInterval(() => ws.readyState === 1 && ws.send('2'), 25000);
        };
        ws.onclose = () => { setWsConnected(false); clearInterval(ping); retry = setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          const raw = e.data;
          if (!raw || raw === '3' || raw === '3probe') return;
          const m = raw.match(/^42\["([^"]+)",(.*)\]$/s);
          if (!m) return;
          let data; try { data = JSON.parse(m[2]); } catch { return; }
          if (m[1] === 'task_update') handleTask(data);
        };
      } catch { retry = setTimeout(connect, 3000); }
    }

    function handleTask(task) {
      if (task.status === 'running') {
        setActiveJob({ status: 'running', progress: task.progress, message: task.message, task_id: task.task_id });
      } else if (task.status === 'completed' && task.result?.analysis) {
        setActiveJob({ status: 'done', progress: 100, task_id: task.task_id });
        setCurrentAnalysis(task.result.analysis);
      } else if (task.status === 'failed') {
        setActiveJob({ status: 'error', error: task.error || task.message, task_id: task.task_id });
      }
    }

    connect();
    return () => { clearTimeout(retry); clearInterval(ping); ws?.close(); };
  }, []);

  function startPolling(taskId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await tasksApi.get(taskId);
        if (!res.success) return;
        handleTaskPoll(res.data);
      } catch {}
    }, 1800);
  }

  function handleTaskPoll(task) {
    if (task.status === 'running') {
      setActiveJob({ status: 'running', progress: task.progress, message: task.message, task_id: task.task_id });
    } else if (task.status === 'completed' && task.result?.analysis) {
      clearInterval(pollRef.current);
      setActiveJob({ status: 'done', progress: 100 });
      setCurrentAnalysis(task.result.analysis);
    } else if (task.status === 'failed') {
      clearInterval(pollRef.current);
      setActiveJob({ status: 'error', error: task.error || task.message });
    }
  }

  return { startPolling };
}
