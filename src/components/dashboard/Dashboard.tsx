import { useState, useEffect } from 'react';
import { BarChart3, Users as UsersIcon, MessageCircle, ShoppingBag, DollarSign, TrendingUp, RefreshCw, ShoppingCart, Globe, CreditCard } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'pos' | 'web'>('pos');
  const [loading, setLoading] = useState(false);
  
  // POS Data
  const [ventas, setVentas] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Cargar Datos Web
      try {
        const analyticsRes = await (window as any).electron.obtenerAnalytics();
        if (analyticsRes && analyticsRes.success) {
          setAnalyticsData(analyticsRes.events || []);
        }
      } catch (err) {
        console.warn('Analytics no disponibles aún:', err);
      }

      // 2. Cargar Datos POS
      // Determinar fechas según filtro
      const hoy = new Date();
      let fechaInicio = new Date();
      
      if (dateFilter === 'week') {
        fechaInicio.setDate(hoy.getDate() - 7);
      } else if (dateFilter === 'month') {
        fechaInicio.setDate(hoy.getDate() - 30);
      } else {
        // Today
        fechaInicio.setHours(0, 0, 0, 0);
      }

      const inicioStr = fechaInicio.toISOString().split('T')[0];
      // Para fin, usamos hasta el final de hoy
      const hoyParaFin = new Date();
      hoyParaFin.setDate(hoyParaFin.getDate() + 1); // Para incluir todo hoy
      const finStr = hoyParaFin.toISOString().split('T')[0];

      try {
        const ventasRes = await (window as any).electron.obtenerVentas({
          fechaInicio: inicioStr,
          fechaFin: finStr
        });
        if (ventasRes && ventasRes.success) {
          setVentas(ventasRes.ventas || []);
        }
      } catch (err) {
        console.warn('Ventas no disponibles:', err);
      }

    } catch (err) {
      console.error('Error cargando dashboard:', err);
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
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BarChart3 className="text-blue-500" /> Dashboard Analytics
        </h1>
        <button 
          onClick={cargarDatos}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6">
        {/* Pestañas (Tabs) */}
        <div className="flex bg-slate-900 rounded-lg p-1 w-fit border border-slate-800 shadow-sm">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'pos' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingCart size={16} /> Tienda Física (POS)
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'web' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe size={16} /> Tienda Web
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'pos' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-300">Métricas de Ventas POS</h2>
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button onClick={() => setDateFilter('today')} className={`px-3 py-1.5 text-xs font-medium rounded ${dateFilter === 'today' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Hoy</button>
                  <button onClick={() => setDateFilter('week')} className={`px-3 py-1.5 text-xs font-medium rounded ${dateFilter === 'week' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Últimos 7 días</button>
                  <button onClick={() => setDateFilter('month')} className={`px-3 py-1.5 text-xs font-medium rounded ${dateFilter === 'month' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Últimos 30 días</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center shadow-lg shadow-blue-500/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                      <DollarSign size={24} />
                    </div>
                    <span className="text-slate-400 font-medium">Ingresos Totales</span>
                  </div>
                  <span className="text-3xl font-black text-white">S/ {totalVentas.toFixed(2)}</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center shadow-lg shadow-purple-500/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                      <CreditCard size={24} />
                    </div>
                    <span className="text-slate-400 font-medium">Transacciones</span>
                  </div>
                  <span className="text-3xl font-black text-white">{totalTransacciones}</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center shadow-lg shadow-emerald-500/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                      <TrendingUp size={24} />
                    </div>
                    <span className="text-slate-400 font-medium">Ticket Promedio</span>
                  </div>
                  <span className="text-3xl font-black text-white">S/ {ticketPromedio.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-300 mb-6 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-orange-400" /> Productos Más Vendidos
                </h3>
                {topProductos.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No hay datos suficientes para el rango seleccionado.</p>
                ) : (
                  <div className="space-y-4">
                    {topProductos.map((prod, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs">
                            #{i + 1}
                          </div>
                          <span className="font-medium text-slate-200">{prod.nombre}</span>
                        </div>
                        <div className="flex items-center gap-8 text-right">
                          <div>
                            <div className="text-xs text-slate-500">Cantidad</div>
                            <div className="font-bold text-slate-300">{prod.cantidad} und</div>
                          </div>
                          <div className="w-24">
                            <div className="text-xs text-slate-500">Subtotal</div>
                            <div className="font-bold text-emerald-400">S/ {prod.total.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'web' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-300">Rendimiento Tienda Web</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center shadow-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                      <UsersIcon size={24} />
                    </div>
                    <span className="text-slate-400 font-medium">Visitas Totales</span>
                  </div>
                  <span className="text-3xl font-black text-white">
                    {analyticsData.filter(e => e.type === 'pageview').length}
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-center shadow-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
                      <MessageCircle size={24} />
                    </div>
                    <span className="text-slate-400 font-medium">Consultas a WhatsApp</span>
                  </div>
                  <span className="text-3xl font-black text-white">
                    {analyticsData.filter(e => e.type === 'whatsapp_click').length}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 border-b border-slate-700 pb-2">Actividad Web Reciente</h3>
                {analyticsData.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">No hay datos registrados aún.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    {analyticsData.slice(0, 50).map(event => (
                      <div key={event.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          {event.type === 'whatsapp_click' ? (
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><MessageCircle size={14} className="text-green-400" /></div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Globe size={14} className="text-blue-400" /></div>
                          )}
                          <span className="text-sm text-slate-300 font-medium">
                            {event.type === 'whatsapp_click' ? 'Consulta WhatsApp' : 'Visita a la página principal'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
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
