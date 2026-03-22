import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  updateAgent: (id, data) => set((s) => ({ agents: s.agents.map(a => a.id === id ? { ...a, ...data } : a) })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter(a => a.id !== id) })),

  // Analysis
  currentAnalysis: null,
  setCurrentAnalysis: (a) => set({ currentAnalysis: a }),
  analysisHistory: [],
  setAnalysisHistory: (h) => set({ analysisHistory: h }),

  // Active job
  activeJob: null,
  setActiveJob: (job) => set({ activeJob: job }),
  jobProgress: 0,
  jobMessage: '',
  setJobProgress: (progress, message) => set({ jobProgress: progress, jobMessage: message }),

  // WebSocket
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
}));
