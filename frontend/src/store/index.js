import { create } from 'zustand';

export const useStore = create((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
  addAgent: (a) => set((s) => ({ agents: [...s.agents, a] })),
  updateAgent: (id, d) => set((s) => ({ agents: s.agents.map(a => a.id === id ? { ...a, ...d } : a) })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter(a => a.id !== id) })),

  currentAnalysis: null,
  setCurrentAnalysis: (a) => set({ currentAnalysis: a }),

  history: [],
  setHistory: (h) => set({ history: h }),

  activeJob: null,
  jobProgress: 0,
  jobMessage: '',
  setActiveJob: (j) => set({ activeJob: j }),
  setJobProgress: (p, m) => set({ jobProgress: p, jobMessage: m }),

  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
}));
