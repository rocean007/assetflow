import { create } from 'zustand';
export const useStore = create((set, get) => ({
  agents: [], setAgents: v => set({ agents: v }),
  sessions: [], setSessions: v => set({ sessions: v }),
  currentRun: null, setCurrentRun: v => set({ currentRun: v }),
}));
