import { create } from 'zustand';
export const useStore = create((set) => ({
  agents: [], setAgents: (v) => set({ agents: v }),
  projects: [], setProjects: (v) => set({ projects: v }),
  currentProject: null, setCurrentProject: (v) => set({ currentProject: v }),
  currentAnalysis: null, setCurrentAnalysis: (v) => set({ currentAnalysis: v }),
  currentSimulation: null, setCurrentSimulation: (v) => set({ currentSimulation: v }),
  history: [], setHistory: (v) => set({ history: v }),
  activeJob: null, setActiveJob: (v) => set({ activeJob: v }),
  wsConnected: false, setWsConnected: (v) => set({ wsConnected: v }),
}));
