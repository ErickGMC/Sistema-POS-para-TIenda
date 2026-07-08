import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter, MessageCircle, ChevronDown, ChevronUp, Receipt, Phone, Printer } from 'lucide-react';
import { imprimirTicket } from '../../utils/ticketPrinter';

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    ticketId: '',
    minMonto: '',
    maxMonto: ''
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const enviarWhatsApp = (venta: any) => {
    const phone = waPhone[venta.id];
    if (!phone || phone.length < 8) {
      alert("Por favor ingresa un número de teléfono válido (ej. 51999999999)");
      return;
    }

    let texto = `*FLOR POS - TICKET DE VENTA*%0A`;
    texto += `Ticket ID: ${venta.id.toUpperCase()}%0A`;
    texto += `Fecha: ${formatearFecha(venta.fecha)}%0A`;
    texto += `--------------------------------%0A`;
    
    venta.detalles.forEach((d: any) => {
      texto += `${d.cantidad}x ${d.producto_nombre || 'Producto'}%0A`;
      texto += `Subtotal: S/ ${d.subtotal.toFixed(2)}%0A`;
    });
    
    texto += `--------------------------------%0A`;
    texto += `*TOTAL: S/ ${venta.total.toFixed(2)}*%0A`;
    texto += `Gracias por tu compra.`;

    (window as any).electron.openExternal(`https://wa.me/${phone}?text=${texto}`);
    setWaPromptId(null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Receipt className="text-emerald-500" /> Historial de Ventas
        </h1>
        <button 
          onClick={fetchVentas}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
        >
          <Search size={18} /> Actualizar
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel de Filtros */}
        <div className="w-80 bg-slate-900/50 border-r border-slate-800 p-6 overflow-y-auto custom-scrollbar">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-300">
            <Filter size={20} /> Filtros de Búsqueda
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Código de Ticket</label>
              <input 
                type="text" 
                name="ticketId"
                value={filtros.ticketId}
                onChange={handleFilterChange}
                placeholder="Ej. w4x9..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Fecha Inicio</label>
                <input 
                  type="date" 
                  name="fechaInicio"
                  value={filtros.fechaInicio}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Fecha Fin</label>
                <input 
                  type="date" 
                  name="fechaFin"
                  value={filtros.fechaFin}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto Mínimo</label>
                <input 
                  type="number" 
                  name="minMonto"
                  value={filtros.minMonto}
                  onChange={handleFilterChange}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto Máximo</label>
                <input 
                  type="number" 
                  name="maxMonto"
                  value={filtros.maxMonto}
                  onChange={handleFilterChange}
                  placeholder="999.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center h-40 text-slate-500">Cargando ventas...</div>
          ) : ventas.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-40 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Receipt size={48} className="mb-4 opacity-20" />
              <p>No se encontraron ventas con estos filtros.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(
                ventas.reduce((groups, venta) => {
                  const fecha = new Date(venta.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  if (!groups[fecha]) groups[fecha] = [];
                  groups[fecha].push(venta);
                  return groups;
                }, {} as Record<string, any[]>)
              ).map(([fechaGrupo, ventasDelDia]: [string, any]) => (
                <div key={fechaGrupo}>
                  <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur pb-2 mb-4">
                    <h3 className="text-lg font-bold text-emerald-500 capitalize flex items-center gap-2">
                      <Calendar size={18} /> {fechaGrupo}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {ventasDelDia.map((venta: any) => (
                      <div key={venta.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div 
                          className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                          onClick={() => setExpandedId(expandedId === venta.id ? null : venta.id)}
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                              <Receipt size={24} />
                            </div>
                            <div>
                              <div className="font-mono text-sm text-slate-400 mb-1">ID: {venta.id.toUpperCase()}</div>
                              <div className="font-semibold text-lg flex items-center gap-2">
                                <Calendar size={16} className="text-slate-500"/>
                                {formatearFecha(venta.fecha)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <div className="text-sm text-slate-400 mb-1">Total</div>
                              <div className="text-2xl font-black text-emerald-400">S/ {venta.total.toFixed(2)}</div>
                            </div>
                            <div className="text-slate-500">
                              {expandedId === venta.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                            </div>
                          </div>
                        </div>

                        {/* Detalle Expandible */}
                        {expandedId === venta.id && (
                          <div className="bg-slate-950 p-6 border-t border-slate-800">
                            <div className="flex justify-between items-start mb-6">
                              <h3 className="font-semibold text-slate-300">Detalle de Productos</h3>
                              
                              {/* Acciones de Ticket */}
                              <div className="flex items-center gap-3">
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
                                  className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                                >
                                  <Printer size={16} /> Imprimir / PDF
                                </button>

                                {/* Control de WhatsApp */}

                                <div className="flex flex-col items-end gap-2 relative">
                                  {waPromptId === venta.id ? (
                                    <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-emerald-500/30">
                                      <Phone size={16} className="text-slate-400" />
                                      <input 
                                        type="text"
                                        placeholder="Ej: 51987654321"
                                        value={waPhone[venta.id] || ''}
                                        onChange={(e) => setWaPhone({...waPhone, [venta.id]: e.target.value.replace(/\D/g, '')})}
                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:border-emerald-500 w-36"
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => enviarWhatsApp(venta)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded transition-colors"
                                        title="Enviar Ticket"
                                      >
                                        <MessageCircle size={16} />
                                      </button>
                                      <button 
                                        onClick={() => setWaPromptId(null)}
                                        className="text-slate-500 hover:text-slate-350 p-1"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => setWaPromptId(venta.id)}
                                      className="flex items-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                    >
                                      <MessageCircle size={16} /> Enviar por WhatsApp
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {venta.detalles?.map((det: any) => (
                                <div key={det.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                                  <div className="flex gap-3">
                                    <div className="bg-slate-800 rounded px-2 py-1 text-sm font-semibold text-slate-300 h-fit">
                                      {det.cantidad}x
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-200">{det.producto_nombre || 'Producto Desconocido'}</div>
                                      <div className="text-xs text-slate-500">S/ {det.precio_unitario.toFixed(2)} c/u</div>
                                    </div>
                                  </div>
                                  <div className="font-bold text-slate-300">
                                    S/ {det.subtotal.toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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
