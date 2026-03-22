import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 120000 });
api.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data?.error || err.message)
);

export const agentsApi = {
  list:   ()        => api.get('/agents/'),
  create: (d)       => api.post('/agents/', d),
  update: (id, d)   => api.put(`/agents/${id}`, d),
  delete: (id)      => api.delete(`/agents/${id}`),
  test:   (id)      => api.post(`/agents/${id}/test`),
};

export const analysisApi = {
  run:     (d)       => api.post('/analysis/run', d),
  task:    (id)      => api.get(`/analysis/task/${id}`),
  history: (n = 50)  => api.get(`/analysis/history?limit=${n}`),
  get:     (id)      => api.get(`/analysis/${id}`),
};

export const marketApi = {
  price:   (sym, key) => api.get(`/market/price/${sym}${key ? `?av_key=${key}` : ''}`),
  history: (sym, d)   => api.get(`/market/history/${sym}?days=${d || 30}`),
};
