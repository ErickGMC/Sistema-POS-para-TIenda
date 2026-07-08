import { useState, useEffect } from 'react';
import CajaRegistradora from './components/pos/CajaRegistradora';
import Inventario from './components/inventory/Inventario';
import GestionUsuarios from './components/users/GestionUsuarios';
import Login from './components/auth/Login';
import HistorialVentas from './components/pos/HistorialVentas';
import WebAdmin from './components/web/WebAdmin';
import Dashboard from './components/dashboard/Dashboard';
import { useAuthStore } from './store/useAuthStore';
import { ShoppingCart, Package, Users, LogOut, Cloud, CloudOff, RefreshCw, Check, X, Receipt, Globe, ShieldAlert, BarChart3 } from 'lucide-react';

function App() {
  const [vistaActiva, setVistaActiva] = useState<'pos' | 'ventas' | 'inventario' | 'usuarios' | 'web' | 'dashboard'>('pos');
  const { isAuthenticated, user, logout } = useAuthStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    if (!online || pendingCount === 0 || isSyncing) return;
    setIsSyncing(true);
    showToast("Sincronizando con la nube...", 'success');
    try {
      await (window as any).electron.startManualSync();
    } catch {
       showToast("Error al invocar la sincronización manual.", 'error');
    } finally {
       setIsSyncing(false);
    }
  };

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Escuchar estado de conexión e interrogar la cola SQLite
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkSync = async () => {
      try {
        const res = await (window as any).electron.obtenerEstadoSync();
        if (res.success) {
          setPendingCount(res.pendingCount);
        }
      } catch (err) {
        console.error('Error obteniendo estado sync:', err);
      }
    };

    checkSync();
    const interval = setInterval(checkSync, 5000); // Revisar cada 5 segundos
    
    // Escuchar eventos de sincronización del proceso principal
    const unsubscribeSyncOk = (window as any).electron.onSyncCompleted((count: number) => {
      if (count > 0) {
        showToast(`Se sincronizaron ${count} registro(s) con la nube correctamente.`, 'success');
        checkSync(); // Actualizar el contador
      }
    });

    const unsubscribeSyncErr = (window as any).electron.onSyncError((err: string) => {
      showToast(`Error de sincronización remota: ${err}`, 'error');
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      if (typeof unsubscribeSyncOk === 'function') unsubscribeSyncOk();
      if (typeof unsubscribeSyncErr === 'function') unsubscribeSyncErr();
    };
  }, [isAuthenticated, user]);

  // Redirigir si la vista activa inicial no es accesible para el colaborador
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (vistaActiva === 'pos' && user.role !== 'admin' && Array.isArray(user.permisos) && !user.permisos.includes('ventas:cobrar')) {
      if (user.permisos.includes('ventas:historial')) setVistaActiva('ventas');
      else if (user.permisos.includes('inventario:modificar')) setVistaActiva('inventario');
      else if (user.permisos.includes('usuarios:gestionar')) setVistaActiva('usuarios');
      else if (user.permisos.includes('web:configurar')) setVistaActiva('web');
    }
  }, [isAuthenticated, user, vistaActiva]);

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  const isAdmin = user.role === 'admin';
  const hasPermission = (perm: string) => {
    if (isAdmin) return true;
    if (!user.permisos || !Array.isArray(user.permisos)) return false;
    return user.permisos.includes(perm);
  };

  const hasAnyViewPermission = isAdmin || (
    Array.isArray(user.permisos) && (
      user.permisos.includes('ventas:cobrar') ||
      user.permisos.includes('ventas:historial') ||
      user.permisos.includes('inventario:modificar') ||
      user.permisos.includes('usuarios:gestionar') ||
      user.permisos.includes('web:configurar')
    )
  );


  if (!hasAnyViewPermission) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-full max-w-md z-10 relative px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl text-center">
            
            <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-6 mx-auto animate-pulse">
              <ShieldAlert size={40} className="text-slate-950" />
            </div>
            
            <h1 className="text-2xl font-bold text-white tracking-tight">Acceso Restringido</h1>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed">
              Hola, <span className="text-slate-200 font-semibold">{user.username}</span>. Tu cuenta de colaborador actualmente no tiene asignados los permisos necesarios para utilizar la caja registradora, ver el inventario o administrar el sistema.
            </p>
            
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-left my-6 text-xs text-slate-500 leading-normal">
              <p className="font-semibold text-slate-400 mb-1">¿Qué puedes hacer?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Solicita a un administrador de la tienda que te asigne permisos desde el panel de control.</li>
                <li>Si esta no es tu cuenta, cierra la sesión e ingresa con tus credenciales correctas.</li>
              </ul>
            </div>

            <button
              onClick={logout}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl py-3.5 transition-all duration-300 flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-650 cursor-pointer"
            >
              <LogOut size={18} />
              Cerrar Sesión
            </button>
          </div>
          
          <p className="text-slate-600 text-xs text-center mt-6">
            Minimarket Flor Local-First POS &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      
      {/* Sidebar / Tabs */}
      <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-50 shadow-xl relative">
        <div className="flex flex-col gap-4 w-full px-3">
          {hasPermission('ventas:cobrar') && (
            <button 
              onClick={() => setVistaActiva('pos')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'pos' ? 'bg-emerald-500 text-slate-900 scale-105 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Caja Registradora (POS)"
            >
              <ShoppingCart size={26} strokeWidth={2.5} />
            </button>
          )}
          
          {hasPermission('ventas:historial') && (
            <button 
              onClick={() => setVistaActiva('ventas')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'ventas' ? 'bg-indigo-500 text-slate-900 scale-105 shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Historial de Ventas"
            >
              <Receipt size={26} strokeWidth={2.5} />
            </button>
          )}
          
          {hasPermission('inventario:modificar') && (
            <button 
              onClick={() => setVistaActiva('inventario')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'inventario' ? 'bg-blue-500 text-slate-900 scale-105 shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Inventario y Catálogo Web"
            >
              <Package size={26} strokeWidth={2.5} />
            </button>
          )}
          
          {hasPermission('usuarios:gestionar') && (
            <button 
              onClick={() => setVistaActiva('usuarios')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'usuarios' ? 'bg-purple-500 text-slate-900 scale-105 shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Gestión de Usuarios"
            >
              <Users size={26} strokeWidth={2.5} />
            </button>
          )}

          {hasPermission('web:configurar') && (
            <button 
              onClick={() => setVistaActiva('web')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'web' ? 'bg-teal-500 text-slate-900 scale-105 shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Control de Tienda Web"
            >
              <Globe size={26} strokeWidth={2.5} />
            </button>
          )}

          {(hasPermission('ventas:historial') || hasPermission('web:configurar')) && (
            <button 
              onClick={() => setVistaActiva('dashboard')}
              className={`p-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${vistaActiva === 'dashboard' ? 'bg-blue-500 text-slate-900 scale-105 shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Dashboard"
            >
              <BarChart3 size={26} strokeWidth={2.5} />
            </button>
          )}
        </div>
        
        {/* Botón de Sincronización en la Nube */}
        <div className="mt-auto flex flex-col items-center gap-4">
          <button 
            onClick={handleManualSync}
            disabled={!online || pendingCount === 0 || isSyncing}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative group ${
              !online || pendingCount === 0 || isSyncing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:scale-110 shadow-lg'
            } ${
              !online 
                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                : isSyncing 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-blue-500/30'
                  : pendingCount > 0 
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/40 hover:bg-amber-500/20 shadow-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
            title={
              !online 
                ? "Sin conexión a Internet (Modo Local)" 
                : isSyncing
                  ? "Sincronizando..."
                  : pendingCount > 0 
                    ? `Sincronizar ${pendingCount} pendientes con la nube` 
                    : "Base de datos en la nube sincronizada"
            }
          >
            {!online ? (
              <CloudOff size={20} />
            ) : isSyncing ? (
              <RefreshCw size={20} className="animate-spin text-blue-400" />
            ) : pendingCount > 0 ? (
              <Cloud size={20} className="text-amber-500 animate-pulse" />
            ) : (
              <Cloud size={20} />
            )}
            
            {/* Tooltip personalizado */}
            <div className="absolute left-16 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 whitespace-nowrap z-50">
              {!online ? (
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Offline: Solo datos locales</span>
              ) : isSyncing ? (
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Sincronizando...</span>
              ) : pendingCount > 0 ? (
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Clic para sincronizar ({pendingCount} pend.)</span>
              ) : (
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Todo sincronizado</span>
              )}
            </div>
          </button>

          {/* Logout */}
          <button 
            onClick={logout}
            className="p-3.5 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={`Cerrar Sesión (${user.username})`}
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'pos' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'pos' && hasPermission('ventas:cobrar') && <CajaRegistradora />}
        </div>

        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'ventas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'ventas' && hasPermission('ventas:historial') && <HistorialVentas />}
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'inventario' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'inventario' && hasPermission('inventario:modificar') && <Inventario />}
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'usuarios' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'usuarios' && hasPermission('usuarios:gestionar') && <GestionUsuarios />}
        </div>
        
        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'web' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'web' && hasPermission('web:configurar') && <WebAdmin />}
        </div>

        <div className={`absolute inset-0 transition-opacity duration-300 ${vistaActiva === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {vistaActiva === 'dashboard' && (hasPermission('ventas:historial') || hasPermission('web:configurar')) && <Dashboard />}
        </div>
      </div>

      {/* Global Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 z-50 ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-red-600 text-white shadow-red-500/20'
        }`}>
          {toastMessage.type === 'success' ? <Check size={20} /> : <X size={20} />}
          <span className="font-medium text-sm">{toastMessage.msg}</span>
        </div>
      )}

    </div>
  );
}

export default App;
