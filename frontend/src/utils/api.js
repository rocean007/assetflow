import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 60000 });

api.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data?.error || err.message || 'Request failed')
);

export const agentsApi = {
  list: () => api.get('/agents'),
  create: (data) => api.post('/agents', data),
  update: (id, data) => api.put(`/agents/${id}`, data),
  delete: (id) => api.delete(`/agents/${id}`),
  test: (id) => api.post(`/agents/${id}/test`),
};

export const analysisApi = {
  run: (data) => api.post('/analysis/run', data),
  job: (id) => api.get(`/analysis/job/${id}`),
  history: (limit = 50) => api.get(`/analysis/history?limit=${limit}`),
  get: (id) => api.get(`/analysis/${id}`),
};

export const marketApi = {
  price: (symbol, apiKey) => api.get(`/market/price/${symbol}${apiKey ? `?apiKey=${apiKey}` : ''}`),
  history: (symbol, days = 30) => api.get(`/market/history/${symbol}?days=${days}`),
  news: (q = '', limit = 20) => api.get(`/market/news?q=${encodeURIComponent(q)}&limit=${limit}`),
};

export default api;
