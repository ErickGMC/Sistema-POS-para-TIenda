import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Usuario {
  id: string;
  username: string;
  nombreCompleto?: string;
  pin?: string;
  email?: string | null;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        sessionStorage.removeItem('auth-session-storage');
        localStorage.removeItem('auth-storage');
        set({ user: null, isAuthenticated: false });
      }
    }),
    {
      name: 'auth-session-storage',
      storage: {
        getItem: (name) => {
          const val = sessionStorage.getItem(name);
          return val ? JSON.parse(val) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      }
    }
  )
);

// Limpieza de almacenamiento local previo para asegurar que no persistan sesiones antiguas
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('auth-storage');
  } catch {}
}
