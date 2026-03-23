import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 120000 });
api.interceptors.response.use(r => r.data, e => Promise.reject(e.response?.data?.error || e.message));
export const agentsApi = {
  list: () => api.get('/agents/'),
  create: (d) => api.post('/agents/', d),
  update: (id, d) => api.put(`/agents/${id}`, d),
  delete: (id) => api.delete(`/agents/${id}`),
  test: (id) => api.post(`/agents/${id}/test`),
};
export const projectsApi = {
  list: () => api.get('/projects/'),
  create: (d) => api.post('/projects/', d),
  get: (id) => api.get(`/projects/${id}`),
  update: (id, d) => api.put(`/projects/${id}`, d),
  delete: (id) => api.delete(`/projects/${id}`),
  reset: (id) => api.post(`/projects/${id}/reset`),
  upload: (id, file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post(`/projects/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteFile: (id, fn) => api.delete(`/projects/${id}/files/${encodeURIComponent(fn)}`),
};
export const graphApi = {
  build: (d) => api.post('/graph/build', d),
  get: (pid) => api.get(`/graph/${pid}`),
  nodes: (pid) => api.get(`/graph/${pid}/nodes`),
  signals: (pid) => api.get(`/graph/${pid}/signals`),
  delete: (pid) => api.delete(`/graph/${pid}`),
};
export const simulationApi = {
  create: (d) => api.post('/simulation/', d),
  list: (pid) => api.get(`/simulation/${pid ? '?project_id=' + pid : ''}`),
  get: (id) => api.get(`/simulation/${id}`),
  history: (n) => api.get(`/simulation/history?limit=${n || 20}`),
  prepare: (id, d) => api.post(`/simulation/${id}/prepare`, d || {}),
  profiles: (id) => api.get(`/simulation/${id}/profiles`),
  status: (id) => api.get(`/simulation/${id}/status`),
  interview: (id, d) => api.post(`/simulation/${id}/interview`, d),
  interviewBatch: (id, d) => api.post(`/simulation/${id}/interview/batch`, d),
  interviewAll: (id, d) => api.post(`/simulation/${id}/interview/all`, d),
  interviewHistory: (id) => api.get(`/simulation/${id}/interview/history`),
};
export const marketApi = {
  price: (sym, k) => api.get(`/market/price/${sym}${k ? '?av_key=' + k : ''}`),
  history: (sym, d) => api.get(`/market/history/${sym}?days=${d || 30}`),
};
export const tasksApi = {
  get: (id) => api.get(`/tasks/${id}`),
  list: () => api.get('/tasks/'),
};
