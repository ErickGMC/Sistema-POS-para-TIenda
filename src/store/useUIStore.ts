import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (isLoading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  loadingMessage: '',
  setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
}));
