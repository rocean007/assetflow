import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 120000 });
api.interceptors.response.use(r => r.data, err => Promise.reject(err.response?.data?.error || err.message));

export const agentsApi = {
  list: () => api.get('/agents'),
  create: (d) => api.post('/agents', d),
  update: (id, d) => api.put(`/agents/${id}`, d),
  delete: (id) => api.delete(`/agents/${id}`),
  test: (id) => api.post(`/agents/${id}/test`),
};

export const analysisApi = {
  run: (d) => api.post('/analysis/run', d),
  job: (id) => api.get(`/analysis/job/${id}`),
  history: (limit = 50) => api.get(`/analysis/history?limit=${limit}`),
  get: (id) => api.get(`/analysis/${id}`),
};
