import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 120000 });
api.interceptors.response.use(r => r.data, e => Promise.reject(e.response?.data?.error || e.message));

export const sessionsApi = {
  list:         ()          => api.get('/sessions/'),
  create:       d           => api.post('/sessions/', d),
  get:          id          => api.get(`/sessions/${id}`),
  delete:       id          => api.delete(`/sessions/${id}`),
  upload:       (id, file)  => { const fd = new FormData(); fd.append('file',file); return api.post(`/sessions/${id}/upload`, fd, {headers:{'Content-Type':'multipart/form-data'}}); },
  interview:    (id, d)     => api.post(`/sessions/${id}/interview`, d),
  interviewAll: (id, d)     => api.post(`/sessions/${id}/interview/all`, d),
};
export const agentsApi = {
  list:   ()        => api.get('/agents/'),
  create: d         => api.post('/agents/', d),
  update: (id, d)   => api.put(`/agents/${id}`, d),
  delete: id        => api.delete(`/agents/${id}`),
  test:   id        => api.post(`/agents/${id}/test`),
};
export const marketApi = {
  price:   sym => api.get(`/market/price/${sym}`),
  history: sym => api.get(`/market/history/${sym}`),
};
