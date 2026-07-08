import { create } from 'zustand';

export interface Usuario {
  id: string;
  username: string;
  role: 'admin' | 'colaborador';
  permisos: string[];
  activo?: boolean;
  fecha_creacion?: string;
}

interface AuthState {
  user: Usuario | null;
  isAuthenticated: boolean;
  login: (user: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false })
}));
