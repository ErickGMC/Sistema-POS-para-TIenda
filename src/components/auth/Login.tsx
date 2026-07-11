import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { Store, Lock, User, LogIn, CloudDownload } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore(state => state.login);
  const { setLoading } = useUIStore();

  useEffect(() => {
    // Escuchar mensajes de estado de sincronización del proceso principal
    let unsubscribe: (() => void) | null = null;
    if ((window as any).electron?.onSyncStatus) {
      unsubscribe = (window as any).electron.onSyncStatus((msg: string) => {
        if (msg) setLoading(true, msg);
      });
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Traduce errores del backend a mensajes amigables para el usuario
  const traducirError = (errorMsg: string): string => {
    const lower = errorMsg.toLowerCase();
    if (lower.includes('network') || lower.includes('fetch') || lower.includes('conexión') || lower.includes('enotfound') || lower.includes('timeout')) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.';
    }
    if (lower.includes('usuario incorrecto') || lower.includes('contraseña incorrecta') || lower.includes('credenciales')) {
      return errorMsg; // Ya son mensajes claros del backend
    }
    if (lower.includes('desactivado')) {
      return errorMsg; // "Usuario desactivado" ya es claro
    }
    if (lower.includes('firebase') || lower.includes('auth/')) {
      return 'Error de autenticación en la nube. Verifica que Firebase esté configurado correctamente.';
    }
    return errorMsg || 'Ocurrió un error inesperado. Intenta nuevamente.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true, 'Verificando credenciales...');
    setError('');
    
    try {
      const result = await (window as any).electron.login(username, password);
      if (result.success) {
        setLoading(false);
        login(result.user);
      } else {
        setError(traducirError(result.error || 'Credenciales inválidas'));
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(traducirError(err?.message || 'Error de conexión'));
      setLoading(false);
    }
  };


  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-y-auto p-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10 relative">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 backdrop-blur-xl">
          
          <div className="flex flex-col items-center mb-5">
            <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-3">
              <Store size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sistema POS</h1>
            <p className="text-slate-400 mt-1 text-center text-xs">Ingresa tus credenciales de Firebase Auth para acceder</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300 ml-1">Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  autoFocus
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none transition-all text-sm"
                  placeholder="tu nombre de usuario"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base rounded-xl py-3 mt-3 transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-wait"
            >
              <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
              Acceder al Sistema
            </button>
          </form>
          
        </div>
        
        <p className="text-slate-600 text-xs text-center mt-4">
          Minimarket Flor Local-First POS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
