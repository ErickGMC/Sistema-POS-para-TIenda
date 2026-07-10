import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Store, Lock, User, LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const login = useAuthStore(state => state.login);

  useEffect(() => {
    const handleSyncStatus = (_: any, msg: string) => {
      setLoadingMsg(msg);
    };
    
    // Asumimos que electron.ipcRenderer.on está expuesto o usamos una función similar
    if ((window as any).electron.onSyncStatus) {
      (window as any).electron.onSyncStatus(handleSyncStatus);
    } else {
       // fallback manual
       try {
           // @ts-ignore
           require('electron').ipcRenderer.on('sync:status', handleSyncStatus);
       } catch (e) {}
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoadingMsg('Verificando credenciales...');
    setError('');
    
    try {
      const result = await (window as any).electron.login(username, password);
      if (result.success) {
        login(result.user);
      } else {
        setError(result.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error(err);
      setError('Error interno del sistema');
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10 relative">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-6">
              <Store size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Flor POS</h1>
            <p className="text-slate-400 mt-2 text-center text-sm">Ingresa tus credenciales para acceder al sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-center text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300 ml-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  autoFocus
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white outline-none transition-all"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-3 pl-11 pr-4 text-white outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!!loadingMsg}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-xl py-3.5 mt-4 transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-wait"
            >
              <LogIn size={20} className={loadingMsg ? "animate-pulse" : "group-hover:translate-x-1 transition-transform"} />
              {loadingMsg ? loadingMsg : 'Acceder al Sistema'}
            </button>
          </form>
          
        </div>
        
        <p className="text-slate-600 text-xs text-center mt-6">
          Minimarket Flor Local-First POS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
