import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, MessageCircle, ChevronDown, ChevronUp, Receipt, Phone, Printer, AlertCircle, DollarSign, CreditCard, Hash, RefreshCw, X } from 'lucide-react';
import { imprimirTicket } from '../../utils/ticketPrinter';
import { useAuthStore } from '../../store/useAuthStore';
// Componentes de UI
import { useUIStore } from '../../store/useUIStore';

export default function HistorialVentas() {
  const { user } = useAuthStore();
  const isWhatsAppOpen = useUIStore((state) => state.isWhatsAppOpen);
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    ticketId: '',
    minMonto: '',
    maxMonto: '',
    metodoPago: 'todos',
    estado: 'todos'
  });
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<Record<string, string>>({});
  const [waPromptId, setWaPromptId] = useState<string | null>(null);

  // Configuraciones de empresa cargadas de SQLite
  const [empresaConfig, setEmpresaConfig] = useState<any>({});
  const [generalConfig, setGeneralConfig] = useState<any>({});

  const cargarConfiguraciones = async () => {
    try {
      const res = await (window as any).electron.obtenerWebConfig();
      if (res.success && res.config) {
        setEmpresaConfig(res.config.empresa || {});
        setGeneralConfig(res.config.general || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const res = await (window as any).electron.obtenerVentas(filtros);
      if (res.success) {
        setVentas(res.ventas);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVentas();
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const aplicarPresetFecha = (preset: 'hoy' | 'ayer' | 'mes' | 'limpiar') => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    
    if (preset === 'hoy') {
      setFiltros(prev => ({ ...prev, fechaInicio: hoyStr, fechaFin: hoyStr }));
    } else if (preset === 'ayer') {
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      const ayerStr = ayer.toISOString().split('T')[0];
      setFiltros(prev => ({ ...prev, fechaInicio: ayerStr, fechaFin: ayerStr }));
    } else if (preset === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const tzOffset = primerDiaMes.getTimezoneOffset() * 60000;
      const primerDiaStr = new Date(primerDiaMes.getTime() - tzOffset).toISOString().split('T')[0];
      setFiltros(prev => ({ ...prev, fechaInicio: primerDiaStr, fechaFin: hoyStr }));
    } else if (preset === 'limpiar') {
      setFiltros(prev => ({ ...prev, fechaInicio: '', fechaFin: '' }));
    }
  };

  const limpiarTodosFiltros = () => {
    setFiltros({
      fechaInicio: '',
      fechaFin: '',
      ticketId: '',
      minMonto: '',
      maxMonto: '',
      metodoPago: 'todos',
      estado: 'todos'
    });
  };

  // Cálculos dinámicos de métricas en base a las ventas cargadas (excluyendo anuladas)
  const stats = useMemo(() => {
    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalDigital = 0;
    let transacciones = 0;

    ventas.forEach((v) => {
      if (v.anulado !== 1) {
        totalVentas += v.total;
        transacciones++;
        const metodo = (v.metodoPago || '').toLowerCase();
        if (metodo === 'efectivo') {
          totalEfectivo += v.total;
        } else {
          totalDigital += v.total;
        }
      }
    });

    return {
      totalVentas,
      totalEfectivo,
      totalDigital,
      transacciones
    };
  }, [ventas]);

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const enviarWhatsApp = async (venta: any) => {
    const phone = waPhone[venta.id];
    if (!phone || phone.length < 8) {
      await useUIStore.getState().showAlert("Por favor ingresa un número de teléfono válido (ej. 51999999999)", "Teléfono Inválido");
      return;
    }

    const isWhatsAppLinked = useUIStore.getState().isWhatsAppLinked;
    if (!isWhatsAppLinked) {
      const confirm = await useUIStore.getState().showConfirm(
        "No has vinculado tu cuenta de WhatsApp Web en este dispositivo. ¿Deseas abrir el panel lateral para escanear el código QR ahora?",
        "WhatsApp No Vinculado"
      );
      if (confirm) {
        useUIStore.getState().openWhatsApp('', '');
      }
      return;
    }

    let texto = `*SISTEMA POS - TICKET DE VENTA*\n`;
    texto += `Ticket ID: ${venta.id.toUpperCase()}\n`;
    texto += `Fecha: ${formatearFecha(venta.fecha)}\n`;
    texto += `--------------------------------\n`;
    
    venta.detalles.forEach((d: any) => {
      texto += `${d.cantidad}x ${d.producto_nombre || 'Producto'}\n`;
      texto += `Subtotal: S/ ${d.subtotal.toFixed(2)}\n`;
    });
    
    texto += `--------------------------------\n`;
    texto += `*TOTAL: S/ ${venta.total.toFixed(2)}*\n`;
    texto += `Gracias por tu compra.`;

    useUIStore.getState().openWhatsApp(phone, texto);
    setWaPromptId(null);
  };

  const canVoid = user?.role === 'admin' || (user?.permisos && user.permisos.includes('ventas:anular'));

  const ejecutarAnulacion = async (ventaId: string) => {
    setLoading(true);
    try {
      const res = await (window as any).electron.anularVenta(ventaId);
      if (res.success) {
        fetchVentas();
      } else {
        await useUIStore.getState().showAlert("Error al anular: " + res.error, "Error de Anulación");
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800">
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold flex items-center gap-2.5">
          <Receipt className="text-emerald-500" size={22} /> Historial de Ventas
        </h1>
        <button 
          onClick={fetchVentas}
          disabled={loading}
          className="bg-white hover:bg-slate-50 disabled:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm px-4 py-2 rounded-xl transition flex items-center gap-2 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-500' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel de Filtros */}
        <div className="w-80 bg-white border-r border-slate-200 p-5 overflow-y-auto custom-scrollbar-light flex flex-col gap-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-slate-500">
              <Filter size={16} /> Filtros de Búsqueda
            </h2>
            <button 
              onClick={limpiarTodosFiltros}
              className="text-[11px] text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-350 rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
              title="Restablecer filtros"
            >
              <X size={11} /> Limpiar
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Código de Ticket</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="ticketId"
                  value={filtros.ticketId}
                  onChange={handleFilterChange}
                  placeholder="Ej: B001-00000001"
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:bg-white rounded-lg pl-3 pr-8 py-2 text-sm text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm"
                />
                {filtros.ticketId && (
                  <button 
                    onClick={() => setFiltros(prev => ({ ...prev, ticketId: '' }))}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Fechas de Emisión</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Desde</span>
                  <input 
                    type="date" 
                    name="fechaInicio"
                    value={filtros.fechaInicio}
                    onChange={handleFilterChange}
                    className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Hasta</span>
                  <input 
                    type="date" 
                    name="fechaFin"
                    value={filtros.fechaFin}
                    onChange={handleFilterChange}
                    className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm"
                  />
                </div>
              </div>
              
              {/* Atajos de Fecha */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <button 
                  onClick={() => aplicarPresetFecha('hoy')}
                  className="text-[10px] font-bold py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition border border-slate-300 cursor-pointer text-center shadow-sm"
                >Hoy</button>
                <button 
                  onClick={() => aplicarPresetFecha('ayer')}
                  className="text-[10px] font-bold py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition border border-slate-300 cursor-pointer text-center shadow-sm"
                >Ayer</button>
                <button 
                  onClick={() => aplicarPresetFecha('mes')}
                  className="text-[10px] font-bold py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition border border-slate-300 cursor-pointer text-center shadow-sm"
                >Mes</button>
                <button 
                  onClick={() => aplicarPresetFecha('limpiar')}
                  className="text-[10px] font-bold py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition border border-rose-350 cursor-pointer text-center"
                >Reset</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Monto Mín.</label>
                <input 
                  type="number" 
                  name="minMonto"
                  value={filtros.minMonto}
                  onChange={handleFilterChange}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:bg-white rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Monto Máx.</label>
                <input 
                  type="number" 
                  name="maxMonto"
                  value={filtros.maxMonto}
                  onChange={handleFilterChange}
                  placeholder="999.00"
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:bg-white rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
              <select 
                name="metodoPago"
                value={filtros.metodoPago}
                onChange={handleFilterChange}
                className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm cursor-pointer"
              >
                <option value="todos">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Estado de Ticket</label>
              <select 
                name="estado"
                value={filtros.estado}
                onChange={handleFilterChange}
                className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 outline-none transition shadow-sm cursor-pointer"
              >
                <option value="todos">Todos los tickets</option>
                <option value="completadas">Válidos (Completados)</option>
                <option value="anuladas">Anulados (Cancelados)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Resultados y Métricas */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar-light flex flex-col gap-5">
          {/* Tarjetas de Resumen KPI (Business Intelligence) */}
          <div className={`grid gap-3.5 flex-shrink-0 transition-all duration-300 ${
            isWhatsAppOpen 
              ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2' 
              : 'grid-cols-2 lg:grid-cols-4'
          }`}>
            <div className={`bg-white border border-slate-300 rounded-2xl flex items-center shadow-md transition-all ${
              isWhatsAppOpen ? 'p-3 gap-2.5' : 'p-4 gap-3.5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 border border-emerald-100">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ventas Totales</div>
                <div className="text-lg font-black text-slate-800 truncate">S/ {stats.totalVentas.toFixed(2)}</div>
              </div>
            </div>

            <div className={`bg-white border border-slate-300 rounded-2xl flex items-center shadow-md transition-all ${
              isWhatsAppOpen ? 'p-3 gap-2.5' : 'p-4 gap-3.5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0 border border-teal-100">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Caja Efectivo</div>
                <div className="text-lg font-black text-slate-800 truncate">S/ {stats.totalEfectivo.toFixed(2)}</div>
              </div>
            </div>

            <div className={`bg-white border border-slate-300 rounded-2xl flex items-center shadow-md transition-all ${
              isWhatsAppOpen ? 'p-3 gap-2.5' : 'p-4 gap-3.5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-100">
                <CreditCard size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tarjeta / Digital</div>
                <div className="text-lg font-black text-slate-800 truncate">S/ {stats.totalDigital.toFixed(2)}</div>
              </div>
            </div>

            <div className={`bg-white border border-slate-300 rounded-2xl flex items-center shadow-md transition-all ${
              isWhatsAppOpen ? 'p-3 gap-2.5' : 'p-4 gap-3.5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0 border border-slate-200">
                <Hash size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transacciones</div>
                <div className="text-lg font-black text-slate-800 truncate">{stats.transacciones}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col justify-center items-center h-60 text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm gap-2">
              <RefreshCw size={36} className="animate-spin text-emerald-500" />
              <span className="text-sm font-semibold">Cargando ventas...</span>
            </div>
          ) : ventas.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-60 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <Receipt size={40} className="mb-3 opacity-20 text-slate-600" />
              <p className="font-semibold text-slate-700">No se encontraron ventas</p>
              <p className="text-xs text-slate-400 mt-1">Prueba a modificar los filtros del panel izquierdo.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(
                ventas.reduce((groups, venta) => {
                  const fecha = new Date(venta.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  if (!groups[fecha]) groups[fecha] = [];
                  groups[fecha].push(venta);
                  return groups;
                }, {} as Record<string, any[]>)
              ).map(([fechaGrupo, ventasDelDia]: [string, any]) => (
                <div key={fechaGrupo} className="space-y-3">
                  <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur pb-1 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider capitalize">
                      {fechaGrupo}
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {ventasDelDia.map((venta: any) => {
                      const isAnulado = venta.anulado === 1;
                      const isExpanded = expandedId === venta.id;
                      const metodo = (venta.metodoPago || 'efectivo').toLowerCase();
                      
                      return (
                        <div key={venta.id} className={`bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-sm hover:border-slate-450 hover:shadow-md transition duration-150 ${isAnulado ? 'opacity-65 border-dashed border-red-300 bg-red-50/10' : ''}`}>
                          <div 
                            className="p-3.5 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                            onClick={() => setExpandedId(isExpanded ? null : venta.id)}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isAnulado ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
                                <Receipt size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-xs font-bold text-slate-800 uppercase">{venta.id}</span>
                                  
                                  {/* Badge de Método de Pago */}
                                  {!isAnulado && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                      metodo === 'efectivo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      metodo === 'tarjeta' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}>
                                      {venta.metodoPago || 'Efectivo'}
                                    </span>
                                  )}
                                  
                                  {isAnulado && (
                                    <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                                      ANULADO
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 mt-1 font-semibold flex items-center gap-1.5">
                                  <Calendar size={12} />
                                  {formatearFecha(venta.fecha)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total</div>
                                <div className={`text-base font-black ${isAnulado ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                  S/ {venta.total.toFixed(2)}
                                </div>
                              </div>
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                            </div>
                          </div>

                          {/* Detalle Expandible */}
                          {isExpanded && (
                            <div className="bg-slate-50/50 p-4 px-5 border-t border-slate-200 flex flex-col gap-4">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalle de Productos</h3>
                                
                                {/* Acciones de Ticket */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button 
                                    onClick={() => {
                                      const ticketItems = venta.detalles.map((d: any) => ({
                                        nombre: d.producto_nombre || 'Producto',
                                        cantidad: d.cantidad,
                                        precio: d.precio_unitario
                                      }));
                                      imprimirTicket(
                                        {
                                          id: venta.id,
                                          total: venta.total,
                                          metodoPago: venta.metodoPago || 'efectivo',
                                          fecha_creacion: venta.fecha,
                                          clienteNombre: venta.clienteNombre || 'PÚBLICO GENERAL',
                                          clienteDocumento: venta.clienteDocumento || undefined
                                        },
                                        ticketItems,
                                        empresaConfig,
                                        generalConfig
                                      );
                                    }}
                                    className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                  >
                                    <Printer size={13} /> Imprimir / PDF
                                  </button>

                                  {canVoid && !isAnulado && (
                                    <button 
                                      onClick={async () => {
                                        if (await useUIStore.getState().showConfirm(
                                          "Esta acción marcará el ticket como anulado y devolverá todos los productos al inventario. No se puede deshacer.",
                                          "¿Estás seguro de anular esta venta?"
                                        )) {
                                          ejecutarAnulacion(venta.id);
                                        }
                                      }}
                                      className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                      <AlertCircle size={13} /> Anular Venta
                                    </button>
                                  )}

                                  {/* Control de WhatsApp */}
                                  <div className="flex items-center gap-1.5 relative">
                                    {waPromptId === venta.id ? (
                                      <div className="flex items-center gap-1.5 bg-white p-1 px-1.5 rounded-lg border border-emerald-500/30 shadow-sm">
                                        <Phone size={13} className="text-slate-400" />
                                        <input 
                                          type="text"
                                          placeholder="Ej: 51987654321"
                                          value={waPhone[venta.id] || ''}
                                          onChange={(e) => setWaPhone({...waPhone, [venta.id]: e.target.value.replace(/\D/g, '')})}
                                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-500 w-32"
                                          autoFocus
                                        />
                                        <button 
                                          onClick={() => enviarWhatsApp(venta)}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded transition-colors cursor-pointer"
                                          title="Enviar Ticket"
                                        >
                                          <MessageCircle size={13} />
                                        </button>
                                        <button 
                                          onClick={() => setWaPromptId(null)}
                                          className="text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setWaPromptId(venta.id)}
                                        className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                      >
                                        <MessageCircle size={13} /> WhatsApp
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {venta.detalles?.map((det: any) => (
                                  <div key={det.id} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex gap-2.5 min-w-0">
                                      <div className="bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-xs font-bold text-slate-600 h-fit">
                                        {det.cantidad}x
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{det.producto_nombre || 'Producto Desconocido'}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">S/ {det.precio_unitario.toFixed(2)} c/u</div>
                                      </div>
                                    </div>
                                    <div className="font-bold text-slate-700 text-xs sm:text-sm flex-shrink-0 ml-2">
                                      S/ {det.subtotal.toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
