import { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { BarChart3, Users as UsersIcon, MessageCircle, ShoppingBag, DollarSign, TrendingUp, RefreshCw, ShoppingCart, Globe, CreditCard, AlertTriangle, CloudOff, Activity } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'pos' | 'web'>('pos');
  const [loading, setLoading] = useState(false);
  const { setLoading: setGlobalLoading } = useUIStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Data
  const [ventas, setVentas] = useState<any[]>([]);
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([]);
  const [productosBajoStock, setProductosBajoStock] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Fechas
      const hoy = new Date();
      let fechaInicio = new Date();
      if (dateFilter === 'week') fechaInicio.setDate(hoy.getDate() - 7);
      else if (dateFilter === 'month') fechaInicio.setDate(hoy.getDate() - 30);
      else fechaInicio.setHours(0, 0, 0, 0);

      const tsInicio = { seconds: Math.floor(fechaInicio.getTime() / 1000), nanoseconds: 0 };
      const strInicio = fechaInicio.toISOString().replace('T', ' ').substring(0, 19);

      const res = await (window as any).electron.obtenerDashboardData(tsInicio, strInicio);
      
      if (res.success) {
        setVentas(res.ventas || []);
        setVentasRecientes(res.ventas ? res.ventas.slice(0, 5) : []);
        setProductosBajoStock(res.stock || []);
        setAnalyticsData(res.analytics || []);
        setErrorMsg(null);
      } else {
        console.error('Error del backend cargando dashboard:', res.error);
        setErrorMsg(res.error);
      }
    } catch (err) {
      console.error('Error de comunicación IPC para dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);



  // Cálculos POS
  const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
  const totalTransacciones = ventas.length;
  const ticketPromedio = totalTransacciones > 0 ? (totalVentas / totalTransacciones) : 0;
  
  // Productos más vendidos
  const productosMap: Record<string, { cantidad: number; total: number; nombre: string }> = {};
  ventas.forEach(v => {
    if (v.detalles && Array.isArray(v.detalles)) {
      v.detalles.forEach((d: any) => {
        const id = d.producto_id || d.producto_nombre;
        if (!productosMap[id]) {
          productosMap[id] = { cantidad: 0, total: 0, nombre: d.producto_nombre };
        }
        productosMap[id].cantidad += d.cantidad || 0;
        productosMap[id].total += d.subtotal || 0;
      });
    }
  });

  const topProductos = Object.values(productosMap)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
      {/* Header Fijo */}
      <div className="flex-none p-5 pb-0">
        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle size={20} />
            <div>
              <p className="font-bold">Error al cargar datos desde la nube:</p>
              <p className="text-sm">{errorMsg}</p>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BarChart3 className="text-blue-500" /> Cloud Dashboard
          <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-1 rounded-full border border-blue-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span> En Vivo
          </span>
        </h1>
        <button 
          onClick={async () => {
            setGlobalLoading(true, "Actualizando métricas desde la nube...");
            try {
               await (window as any).electron.forzarSincronizacion();
               await cargarDatos();
            } catch(e) {
               console.error(e);
            } finally {
               setGlobalLoading(false);
            }
          }}
          disabled={loading || !isOnline}
          className="bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 px-4 py-2 rounded-lg transition flex items-center gap-2 font-bold text-sm cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {(!isOnline) ? <CloudOff size={18} /> : <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />} 
          {(!isOnline) ? 'Offline' : 'Actualizar Nube'}
        </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6 relative">
        {/* Pestañas (Tabs) */}
        <div className="flex justify-between items-center">
          <div className="flex bg-white rounded-lg p-1 w-fit border border-slate-300 shadow-sm">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-6 py-2.5 text-sm font-bold rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'pos' ? 'bg-blue-650 text-white shadow-md' : 'text-slate-650 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart size={16} /> Tienda Física (POS)
            </button>
            <button
              onClick={() => setActiveTab('web')}
              className={`px-6 py-2.5 text-sm font-bold rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'web' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-650 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Globe size={16} /> Tienda Web
            </button>
          </div>
          
          <div className="flex bg-slate-200 border border-slate-300 rounded-lg p-1">
            <button onClick={() => setDateFilter('today')} className={`px-4 py-2 text-xs font-bold rounded transition-colors cursor-pointer ${dateFilter === 'today' ? 'bg-white text-slate-900 border border-slate-250 shadow-sm' : 'text-slate-650 hover:text-slate-900'}`}>Hoy</button>
            <button onClick={() => setDateFilter('week')} className={`px-4 py-2 text-xs font-bold rounded transition-colors cursor-pointer ${dateFilter === 'week' ? 'bg-white text-slate-900 border border-slate-250 shadow-sm' : 'text-slate-650 hover:text-slate-900'}`}>Últimos 7 días</button>
            <button onClick={() => setDateFilter('month')} className={`px-4 py-2 text-xs font-bold rounded transition-colors cursor-pointer ${dateFilter === 'month' ? 'bg-white text-slate-900 border border-slate-250 shadow-sm' : 'text-slate-650 hover:text-slate-900'}`}>Últimos 30 días</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar-light-light-light">
          {loading ? (
             <div className="flex items-center justify-center h-64">
               <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
             </div>
          ) : activeTab === 'pos' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-lg hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                      <DollarSign size={24} />
                    </div>
                    <span className="text-slate-600 font-medium">Ingresos Totales</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">S/ {totalVentas.toFixed(2)}</span>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-lg hover:border-purple-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                      <CreditCard size={24} />
                    </div>
                    <span className="text-slate-600 font-medium">Transacciones</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">{totalTransacciones}</span>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-lg hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                      <TrendingUp size={24} />
                    </div>
                    <span className="text-slate-600 font-medium">Ticket Promedio</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">S/ {ticketPromedio.toFixed(2)}</span>
                </div>
              </div>

              {/* Lower Section Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Transacciones Recientes (NEW) */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
                  <h3 className="font-semibold text-slate-700 mb-6 flex items-center gap-2">
                    <Activity size={18} className="text-indigo-600" /> Flujo de Caja (Últimas Ventas)
                  </h3>
                  {ventasRecientes.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center my-auto">No hay ventas recientes.</p>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {ventasRecientes.map((v) => (
                        <div key={v.id} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 hover:bg-slate-100/50 transition-colors">
                           <div className="flex flex-col">
                             <span className="font-bold text-slate-800">{v.id}</span>
                             <span className="text-xs text-slate-500">{v.clienteNombre || 'Cliente Público'} • {v.metodoPago}</span>
                           </div>
                           <div className="text-right">
                             <span className="font-black text-emerald-600">S/ {Number(v.total).toFixed(2)}</span>
                             <div className="text-xs text-slate-500">
                               {new Date(v.fecha?.seconds ? v.fecha.seconds * 1000 : v.fecha || Date.now()).toLocaleTimeString()}
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6 flex flex-col">
                  
                  {/* Alertas de Stock Bajo (NEW) */}
                  <div className="bg-white border border-red-500/20 rounded-2xl p-6 flex-1 shadow-lg shadow-red-500/5">
                    <h3 className="font-semibold text-red-400 mb-4 flex items-center gap-2">
                      <AlertTriangle size={18} /> Alertas de Stock Bajo
                    </h3>
                    {productosBajoStock.length === 0 ? (
                       <p className="text-sm text-emerald-600/70 py-4 text-center">¡Inventario saludable!</p>
                    ) : (
                      <div className="space-y-3">
                        {productosBajoStock.map((prod) => (
                          <div key={prod.id} className="flex justify-between items-center bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                            <span className="text-sm font-medium text-slate-700 truncate pr-2">{prod.nombre}</span>
                            <span className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded-lg whitespace-nowrap">
                              {prod.stock} und
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Productos */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 flex-1">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <ShoppingBag size={18} className="text-orange-400" /> Top Ventas
                    </h3>
                    {topProductos.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">Sin datos</p>
                    ) : (
                      <div className="space-y-3">
                        {topProductos.slice(0,4).map((prod, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="text-xs font-bold text-slate-500 w-4">{i + 1}.</div>
                              <span className="text-sm text-slate-700 truncate">{prod.nombre}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-600">{prod.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          )}

          {!loading && activeTab === 'web' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-700">Rendimiento Tienda Web</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-lg hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                      <UsersIcon size={24} />
                    </div>
                    <span className="text-slate-600 font-medium">Visitas Totales</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">
                    {analyticsData.filter(e => e.type === 'pageview').length}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-lg hover:border-green-500/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
                      <MessageCircle size={24} />
                    </div>
                    <span className="text-slate-600 font-medium">Consultas a WhatsApp</span>
                  </div>
                  <span className="text-3xl font-black text-slate-900">
                    {analyticsData.filter(e => e.type === 'whatsapp_click').length}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-300 pb-2">Actividad Web Reciente (Cloud)</h3>
                {analyticsData.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No hay datos registrados aún.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar-light-light-light pr-2">
                    {analyticsData.slice(0, 50).map(event => (
                      <div key={event.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {event.type === 'whatsapp_click' ? (
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><MessageCircle size={14} className="text-green-400" /></div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Globe size={14} className="text-blue-600" /></div>
                          )}
                          <span className="text-sm text-slate-700 font-medium">
                            {event.type === 'whatsapp_click' ? 'Consulta WhatsApp' : 'Visita a la página principal'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                          {event.timestamp ? new Date(event.timestamp.seconds ? event.timestamp.seconds * 1000 : event.timestamp).toLocaleString() : 'Reciente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
