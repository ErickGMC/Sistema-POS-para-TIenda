import { useState, useMemo } from 'react';
import type { Producto } from '../../store/usePosStore';
import { Search, FileText, MessageCircle, AlertTriangle, Plus, Trash2, ListPlus, Calculator, PackagePlus, Save, History, X } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ListaComprasProps {
  productos: Producto[];
}

interface ItemCompra {
  producto: Producto;
  cantidadPedir: number;
}

export default function ListaCompras({ productos }: ListaComprasProps) {
  // Filtros del catálogo izquierdo
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  
  // Estado de la Lista Seleccionada
  const [itemsCompra, setItemsCompra] = useState<ItemCompra[]>([]);
  const [mostrarCantidad, setMostrarCantidad] = useState(false);
  const [notificacion, setNotificacion] = useState<{ texto: string; tipo: 'success' | 'error' | 'info' } | null>(null);

  // Estados del Historial y Guardado
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [listasGuardadas, setListasGuardadas] = useState<any[]>([]);

  const mostrarNotificacion = (texto: string, tipo: 'success' | 'error' | 'info' = 'info', duracion = 4000) => {
    setNotificacion({ texto, tipo });
    setTimeout(() => setNotificacion(null), duracion);
  };

  // Categorías únicas
  const categories = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [productos]);

  // Productos filtrados en el catálogo
  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.codigoBarras && p.codigoBarras.includes(searchTerm));
      const matchesCategory = categoryFilter === 'todas' || p.categoria === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, categoryFilter]);

  // Manejo de la lista
  const agregarItem = (producto: Producto, cantidad = 1) => {
    setItemsCompra(prev => {
      const existe = prev.find(i => i.producto.id === producto.id);
      if (existe) {
        return prev.map(i => i.producto.id === producto.id 
          ? { ...i, cantidadPedir: i.cantidadPedir + cantidad }
          : i
        );
      }
      return [...prev, { producto, cantidadPedir: Math.max(1, cantidad) }];
    });
  };

  const removerItem = (id: string) => {
    setItemsCompra(prev => prev.filter(i => i.producto.id !== id));
  };

  const actualizarCantidad = (id: string, cantidad: number) => {
    if (cantidad <= 0) return;
    setItemsCompra(prev => prev.map(i => 
      i.producto.id === id ? { ...i, cantidadPedir: cantidad } : i
    ));
  };

  const vaciarLista = async () => {
    if (await useUIStore.getState().showConfirm('¿Estás seguro de vaciar la lista de compras actual?', 'Vaciar Lista')) {
      setItemsCompra([]);
    }
  };

  const agregarFaltantes = () => {
    const faltantes = productos.filter(p => p.stock <= 5);
    let agregados = 0;
    
    setItemsCompra(prev => {
      const nuevos = [...prev];
      faltantes.forEach(prod => {
        if (!nuevos.find(i => i.producto.id === prod.id)) {
          nuevos.push({ producto: prod, cantidadPedir: 10 });
          agregados++;
        }
      });
      return nuevos;
    });

    if (agregados > 0) {
      mostrarNotificacion(`Se agregaron ${agregados} productos con stock crítico (≤ 5) a tu lista de compras.`, 'success');
    } else {
      mostrarNotificacion('Todos los productos con bajo stock ya están en tu lista.', 'info');
    }
  };

  const cargarHistorial = async () => {
    try {
      const res = await (window as any).electron.obtenerListasCompras();
      if (res.success) {
        setListasGuardadas(res.listas);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const guardarListaActual = async () => {
    if (itemsCompra.length === 0) return;
    
    const defaultName = `Reabastecimiento - ${new Date().toLocaleDateString()}`;
    const nombre = prompt('Ingresa un nombre para esta lista de compras:', defaultName);
    if (!nombre) return; // Canceló

    const lista = {
      id: window.crypto.randomUUID(),
      nombre,
      fecha: new Date().toISOString(),
      total_estimado: costoTotalEstimado
    };

    const detalles = itemsCompra.map(item => ({
      id: window.crypto.randomUUID(),
      producto_id: item.producto.id,
      cantidad_pedir: item.cantidadPedir,
      costo_unitario: item.producto.costo || 0
    }));

    try {
      const res = await (window as any).electron.guardarListaCompra(lista, detalles);
      if (res.success) {
        mostrarNotificacion('Lista guardada correctamente. Se sincronizará con Firebase.', 'success');
      } else {
        mostrarNotificacion('Error al guardar: ' + (res.error || 'Error desconocido'), 'error');
      }
    } catch {
      mostrarNotificacion('Error de sistema al guardar la lista. Intenta nuevamente.', 'error');
    }
  };

  const eliminarListaGuardada = async (id: string) => {
    if (await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar esta lista guardada?', 'Eliminar Lista')) {
      await (window as any).electron.eliminarListaCompra(id);
      cargarHistorial();
    }
  };

  const cargarListaEnEditor = async (listaGuardada: any) => {
    if (itemsCompra.length > 0) {
      if (!(await useUIStore.getState().showConfirm('Tu lista actual se reemplazará por la guardada. ¿Deseas continuar?', 'Cargar Lista'))) return;
    }
    
    const itemsRestaurados: ItemCompra[] = [];
    listaGuardada.detalles.forEach((det: any) => {
      // Buscar el producto original del catálogo por si cambió
      const prodEnCatalogo = productos.find(p => p.id === det.producto_id);
      if (prodEnCatalogo) {
        itemsRestaurados.push({
          producto: prodEnCatalogo,
          cantidadPedir: det.cantidad_pedir
        });
      }
    });
    
    setItemsCompra(itemsRestaurados);
    setShowHistoryModal(false);
  };

  // Cálculos
  const costoTotalEstimado = useMemo(() => {
    return itemsCompra.reduce((acc, item) => {
      const costo = item.producto.costo || 0;
      return acc + (costo * item.cantidadPedir);
    }, 0);
  }, [itemsCompra]);

  // Agrupación de items seleccionados por categoría (Para exportación)
  const itemsPorCategoria = useMemo(() => {
    const groups: Record<string, ItemCompra[]> = {};
    itemsCompra.forEach(item => {
      const cat = item.producto.categoria || 'Sin Categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [itemsCompra]);

  // Exportación
  const generateWhatsAppMessage = async () => {
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

    let message = "🛒 *ORDEN DE COMPRA - MINIMARKET FLOR*\n\n";
    
    Object.keys(itemsPorCategoria).sort().forEach(cat => {
      message += `📦 *${cat.toUpperCase()}*\n`;
      itemsPorCategoria[cat].forEach(item => {
        message += `- ${item.producto.nombre}\n`;
        if (mostrarCantidad) {
          message += `  Cantidad a pedir: *${item.cantidadPedir} ${item.producto.unidadMedida}*\n`;
        }
      });
      message += `\n`;
    });

    useUIStore.getState().openWhatsApp('', message);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    
    doc.setFontSize(20);
    doc.text('Orden de Compra - Minimarket Flor', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha de generación: ${date}`, 14, 30);
    if (mostrarCantidad) {
      doc.text(`Costo Estimado: S/ ${costoTotalEstimado.toFixed(2)}`, 14, 36);
    }

    let startY = 45;

    Object.keys(itemsPorCategoria).sort().forEach(cat => {
      doc.setFontSize(14);
      doc.text(cat.toUpperCase(), 14, startY);
      
      let tableData;
      let headFields;

      if (mostrarCantidad) {
        headFields = [['Código', 'Producto', 'Stock Actual', 'Cant. Pedir', 'U.M.']];
        tableData = itemsPorCategoria[cat].map(item => [
          item.producto.codigoBarras || 'S/C',
          item.producto.nombre,
          item.producto.stock.toString(),
          item.cantidadPedir.toString(),
          item.producto.unidadMedida
        ]);
      } else {
        headFields = [['Código', 'Producto', 'Stock Actual', 'U.M.']];
        tableData = itemsPorCategoria[cat].map(item => [
          item.producto.codigoBarras || 'S/C',
          item.producto.nombre,
          item.producto.stock.toString(),
          item.producto.unidadMedida
        ]);
      }

      autoTable(doc, {
        startY: startY + 5,
        head: headFields,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
        margin: { top: 10 },
      });

      startY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Guardar el archivo usando método estándar
    const fileName = `Orden_Compra_${date.replace(/\//g, '-')}.pdf`;
    
    // El save de jsPDF debería funcionar con HTML5 a:download link de fondo en Electron si no hay bloqueos.
    try {
      doc.save(fileName);
    } catch (err) {
      // Si falla, como fallback generamos el ArrayBuffer e invocamos un link temporal
      console.warn("Fallo en doc.save, usando fallback", err);
      const output = doc.output('blob');
      const url = URL.createObjectURL(output);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full flex flex-row bg-white overflow-hidden relative">
      
      {/* MODAL DEL HISTORIAL */}
      {showHistoryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm p-4">
          <div className="bg-slate-100 border border-slate-300 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-300 flex justify-between items-center bg-slate-100/80">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="text-emerald-600" />
                Historial de Listas Guardadas
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-600 hover:text-slate-900 p-1 rounded transition">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar-light-light-light">
              {listasGuardadas.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic">
                  No tienes listas guardadas en el historial.
                </div>
              ) : (
                <div className="grid gap-3">
                  {listasGuardadas.map(lista => (
                    <div key={lista.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition shadow-sm">
                      <div>
                        <div className="font-bold text-base text-slate-800">{lista.nombre}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 font-medium">
                          <span>{new Date(lista.fecha).toLocaleDateString()} {new Date(lista.fecha).toLocaleTimeString()}</span>
                          <span className="bg-slate-50 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 text-slate-600">{lista.detalles.length} productos</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-amber-600 mr-1 text-base">S/ {lista.total_estimado.toFixed(2)}</span>
                        <button 
                          onClick={() => cargarListaEnEditor(lista)} 
                          className="bg-blue-50 hover:bg-blue-100 hover:text-blue-700 text-blue-600 px-3.5 py-1.5 rounded-lg font-bold text-xs transition border border-blue-200 cursor-pointer shadow-sm"
                        >
                          Cargar
                        </button>
                        <button 
                          onClick={() => eliminarListaGuardada(lista.id)} 
                          className="bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 p-1.5 rounded-lg transition border border-rose-200 cursor-pointer shadow-sm"
                          title="Eliminar del historial"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL IZQUIERDO: CATÁLOGO Y BUSCADOR */}
      <div className="w-1/2 flex flex-col border-r border-slate-300">
        
        {/* Cabecera del Buscador */}
        <div className="p-4 bg-slate-100 shadow-md z-10 flex flex-col gap-2.5 border-b border-slate-300">
          {notificacion && (
            <div className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
              notificacion.tipo === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
              notificacion.tipo === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-600'
            }`}>
              <span>{notificacion.texto}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PackagePlus className="text-emerald-600" />
              Catálogo de Productos
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => { cargarHistorial(); setShowHistoryModal(true); }}
                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg transition font-bold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <History size={14} /> Historial
              </button>
              <button 
                onClick={agregarFaltantes}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-350 px-3 py-1.5 rounded-lg transition font-bold shadow-sm cursor-pointer"
                title="Añadir automáticamente todos los productos con stock 5 o menos"
              >
                + Sugerir Faltantes
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-650" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o código..." 
                className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg pl-9 pr-4 py-2 text-slate-900 focus:border-emerald-500 outline-none transition text-sm shadow-sm" 
              />
            </div>
            <select 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-40 bg-white border border-slate-350 hover:border-slate-400 rounded-lg px-3 py-2 text-slate-900 focus:border-emerald-500 outline-none transition appearance-none text-sm shadow-sm cursor-pointer"
            >
              <option value="todas">Todas las categorías</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Lista del Catálogo */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar-light-light-light">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center px-4">
              <AlertTriangle size={32} className="mb-2 opacity-50" />
              No se encontraron productos.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredProducts.map(prod => (
                <div key={prod.id} className="bg-slate-50 border border-slate-200 hover:border-emerald-500/30 hover:bg-white hover:shadow-sm rounded-xl p-2.5 flex items-center gap-2.5 transition duration-150 group">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{prod.nombre}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-medium">
                      <span className="text-slate-500 font-mono">{prod.codigoBarras || 'S/C'}</span>
                      <span className={prod.stock <= 5 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                        Stock: {prod.stock}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => agregarItem(prod, 1)}
                    className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-200 text-emerald-600 flex items-center justify-center transition flex-shrink-0 cursor-pointer shadow-sm"
                    title="Añadir a la lista"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO: ORDEN DE COMPRA */}
      <div className="w-1/2 flex flex-col bg-white relative">
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2.5 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ListPlus className="text-emerald-600" size={20} />
              Mi Lista
            </h2>
            <div className="flex gap-2">
              {itemsCompra.length > 0 && (
                <>
                  <button 
                    onClick={guardarListaActual}
                    className="text-xs text-blue-750 hover:text-blue-900 font-bold uppercase tracking-wider bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-300 transition flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Save size={13} /> Guardar
                  </button>
                  <button 
                    onClick={vaciarLista}
                    className="text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-300 transition font-bold uppercase tracking-wider cursor-pointer shadow-sm"
                  >
                    Vaciar
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
              <input 
                type="checkbox" 
                checked={mostrarCantidad}
                onChange={(e) => setMostrarCantidad(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer border-slate-300"
              />
              Incluir "Cantidad a pedir"
            </label>
          </div>
        </div>
        
        {/* Items Seleccionados */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-light-light-light">
          {itemsCompra.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center px-8">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mb-3">
                <ListPlus size={28} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Tu lista está vacía.</p>
              <p className="text-xs mt-1 text-slate-500">Busca productos en el catálogo de la izquierda y presiona el botón "+" para agregarlos aquí.</p>
            </div>
          ) : (
            itemsCompra.map((item) => (
              <div key={item.producto.id} className="flex items-center justify-between bg-slate-50 p-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-sm gap-3">
                {/* Left Side: Product Name & Code */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-xs sm:text-sm truncate" title={item.producto.nombre}>
                    {item.producto.nombre}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {item.producto.codigoBarras || 'S/C'}
                  </div>
                </div>

                {/* Right Side: Quantity selector/Category, Stock info and Trash button */}
                <div className="flex items-center gap-3.5 flex-shrink-0">
                  {mostrarCantidad ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-slate-350 rounded-md overflow-hidden shadow-sm h-7">
                        <button 
                          onClick={() => actualizarCantidad(item.producto.id, item.cantidadPedir - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border-r border-slate-200 active:scale-95 transition cursor-pointer"
                        >-</button>
                        <input 
                          type="number" 
                          min="1"
                          step={item.producto.unidadMedida === 'unidad' ? '1' : '0.1'}
                          value={item.cantidadPedir}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) actualizarCantidad(item.producto.id, val);
                          }}
                          className="w-10 h-7 text-center bg-transparent text-emerald-600 font-bold text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        /> 
                        <button 
                          onClick={() => actualizarCantidad(item.producto.id, item.cantidadPedir + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border-l border-slate-200 active:scale-95 transition cursor-pointer"
                        >+</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 border border-slate-200 rounded font-medium">
                      {item.producto.categoria}
                    </div>
                  )}

                  {/* Stock Actual & Costo info */}
                  <div className="text-right text-xs min-w-[70px]">
                    <div className="text-[10px] text-slate-500">Stk: <strong className={item.producto.stock <= 5 ? 'text-rose-600' : 'text-slate-700'}>{item.producto.stock}</strong></div>
                    {mostrarCantidad && (
                      <div className="text-[11px] text-slate-650 font-semibold mt-0.5">
                        S/ {((item.producto.costo || 0) * item.cantidadPedir).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Trash button */}
                  <button 
                    onClick={() => removerItem(item.producto.id)} 
                    className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 p-1.5 rounded-lg transition flex-shrink-0 cursor-pointer shadow-sm"
                    title="Remover de la lista"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer (Totales y Exportación) */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 shadow-inner">
          {mostrarCantidad && (
            <div className="flex justify-between items-center mb-3 px-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Calculator size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Inversión Estimada</span>
              </div>
              <span className="text-2xl font-black text-amber-600">S/ {costoTotalEstimado.toFixed(2)}</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={generateWhatsAppMessage}
              disabled={itemsCompra.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition flex justify-center items-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer text-sm"
            >
              <MessageCircle size={18} />
              Enviar WhatsApp
            </button>
            <button 
              onClick={generatePDF}
              disabled={itemsCompra.length === 0}
              className="w-full bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition flex justify-center items-center gap-2 shadow-md shadow-rose-500/10 cursor-pointer text-sm"
            >
              <FileText size={18} />
              Generar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
