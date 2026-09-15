import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Trash2, 
  Share2, 
  Save, 
  AlertTriangle, 
  History, 
  Check, 
  X, 
  PackagePlus, 
  RefreshCw,
  Copy
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

export interface ShoppingItem {
  id: string;
  producto_id?: string;
  nombre: string;
  categoria: string;
  cantidad_pedir: number;
  costo_unitario: number;
  unidadMedida: string;
  stock_actual?: number;
  esManual?: boolean;
}

export interface SavedList {
  id: string;
  nombre: string;
  fecha: string;
  total_estimado: number;
  detalles?: any[];
}

export default function ListaCompras() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [nombreLista, setNombreLista] = useState<string>('Lista de Reabastecimiento');
  const [guardando, setGuardando] = useState(false);
  
  // Modales
  const [modalInventarioAbierto, setModalInventarioAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);

  // Productos de inventario
  const [productosInventario, setProductosInventario] = useState<any[]>([]);
  const [busquedaInventario, setBusquedaInventario] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todas');
  const [cargandoInventario, setCargandoInventario] = useState(false);

  // Formulario manual
  const [manualForm, setManualForm] = useState({
    nombre: '',
    categoria: 'Abarrotes',
    cantidad_pedir: 1,
    costo_unitario: 0,
    unidadMedida: 'UND'
  });

  // Historial
  const [listasGuardadas, setListasGuardadas] = useState<SavedList[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Copiado a portapapeles
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    cargarInventario();
  }, []);

  const cargarInventario = async () => {
    setCargandoInventario(true);
    try {
      if ((window as any).electron?.obtenerTodosProductos) {
        const prods = await (window as any).electron.obtenerTodosProductos();
        setProductosInventario(prods || []);
      }
    } catch (err) {
      console.error('Error cargando inventario para compras:', err);
    } finally {
      setCargandoInventario(false);
    }
  };

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      if ((window as any).electron?.obtenerListasCompras) {
        const res = await (window as any).electron.obtenerListasCompras();
        if (res.success) {
          setListasGuardadas(res.listas || []);
        }
      }
    } catch (err) {
      console.error('Error cargando historial de compras:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Cargar productos con stock bajo (stock <= 5)
  const cargarBajoStock = async () => {
    if (productosInventario.length === 0) await cargarInventario();
    const prodsBajoStock = productosInventario.filter(p => Number(p.stock ?? 0) <= 5 && !p.productoPadreId);

    if (prodsBajoStock.length === 0) {
      alert('¡Excelente! No hay productos con stock crítico (menor o igual a 5).');
      return;
    }

    const nuevos: ShoppingItem[] = [];
    for (const p of prodsBajoStock) {
      const yaExiste = items.find(it => it.producto_id === p.id);
      if (!yaExiste) {
        const sugerido = Math.max(6, 12 - Number(p.stock ?? 0));
        nuevos.push({
          id: window.crypto.randomUUID(),
          producto_id: p.id,
          nombre: p.nombre,
          categoria: p.categoria || 'General',
          cantidad_pedir: sugerido,
          costo_unitario: Number(p.costo ?? p.precio ?? 0),
          unidadMedida: p.unidadMedida || 'UND',
          stock_actual: Number(p.stock ?? 0),
          esManual: false
        });
      }
    }

    if (nuevos.length > 0) {
      setItems(prev => [...prev, ...nuevos]);
      alert(`Se añadieron ${nuevos.length} producto(s) con stock bajo a la lista.`);
    } else {
      alert('Todos los productos con bajo stock ya están incluidos en tu lista.');
    }
  };

  const agregarDeInventario = (prod: any) => {
    const yaExiste = items.find(it => it.producto_id === prod.id);
    if (yaExiste) {
      setItems(prev => prev.map(it => it.producto_id === prod.id ? { ...it, cantidad_pedir: it.cantidad_pedir + 1 } : it));
      return;
    }

    setItems(prev => [
      ...prev,
      {
        id: window.crypto.randomUUID(),
        producto_id: prod.id,
        nombre: prod.nombre,
        categoria: prod.categoria || 'General',
        cantidad_pedir: 1,
        costo_unitario: Number(prod.costo ?? prod.precio ?? 0),
        unidadMedida: prod.unidadMedida || 'UND',
        stock_actual: Number(prod.stock ?? 0),
        esManual: false
      }
    ]);
  };

  const agregarManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.nombre.trim()) return;

    setItems(prev => [
      ...prev,
      {
        id: window.crypto.randomUUID(),
        producto_id: `manual-${window.crypto.randomUUID()}`,
        nombre: manualForm.nombre.trim(),
        categoria: manualForm.categoria,
        cantidad_pedir: Math.max(1, Number(manualForm.cantidad_pedir)),
        costo_unitario: Math.max(0, Number(manualForm.costo_unitario)),
        unidadMedida: manualForm.unidadMedida,
        esManual: true
      }
    ]);

    setManualForm({
      nombre: '',
      categoria: 'Abarrotes',
      cantidad_pedir: 1,
      costo_unitario: 0,
      unidadMedida: 'UND'
    });
    setModalManualAbierto(false);
  };

  const actualizarCantidad = (id: string, delta: number) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        const nueva = Math.max(1, it.cantidad_pedir + delta);
        return { ...it, cantidad_pedir: nueva };
      }
      return it;
    }));
  };

  const setearCantidad = (id: string, valor: number) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        return { ...it, cantidad_pedir: Math.max(0.1, valor) };
      }
      return it;
    }));
  };

  const setearCosto = (id: string, costo: number) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        return { ...it, costo_unitario: Math.max(0, costo) };
      }
      return it;
    }));
  };

  const eliminarItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const limpiarLista = async () => {
    if (items.length === 0) return;
    const ok = await useUIStore.getState().showConfirm('¿Estás seguro de que deseas limpiar toda la lista?', 'Limpiar Lista');
    if (ok) {
      setItems([]);
    }
  };

  const totalEstimado = items.reduce((acc, it) => acc + (it.cantidad_pedir * it.costo_unitario), 0);
  const totalUnidades = items.reduce((acc, it) => acc + it.cantidad_pedir, 0);

  // Formato para compartir por WhatsApp
  const generarTextoWhatsApp = (): string => {
    const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let txt = `🛒 *LISTA DE COMPRAS - MINIMARKET* 🛒\n`;
    txt += `📋 *${nombreLista}*\n`;
    txt += `📅 Fecha: ${fecha}\n`;
    txt += `📦 Total Ítems: ${items.length} (${totalUnidades} unidades)\n`;
    txt += `💰 Estimado Total: S/ ${totalEstimado.toFixed(2)}\n`;
    txt += `─────────────────────────\n`;

    items.forEach((it, idx) => {
      const costoTxt = it.costo_unitario > 0 ? ` (~S/ ${(it.cantidad_pedir * it.costo_unitario).toFixed(2)})` : '';
      txt += `${idx + 1}. *${it.nombre}* [${it.categoria}]\n   • Cantidad: *${it.cantidad_pedir} ${it.unidadMedida}*${costoTxt}\n`;
    });

    txt += `─────────────────────────\n`;
    txt += `_Generado automáticamente desde Minimarket POS_`;
    return txt;
  };

  const compartirWhatsApp = () => {
    if (items.length === 0) return;
    const text = generarTextoWhatsApp();
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    
    // Si el entorno tiene openExternal, usarlo; de lo contrario copiar al portapapeles
    if ((window as any).electron?.openExternal) {
      (window as any).electron.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const copiarAlPortapapeles = async () => {
    if (items.length === 0) return;
    const text = generarTextoWhatsApp();
    await navigator.clipboard.writeText(text);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const guardarLista = async () => {
    if (items.length === 0) return;
    setGuardando(true);
    try {
      const listaId = window.crypto.randomUUID();
      const listaPayload = {
        id: listaId,
        nombre: nombreLista.trim() || 'Lista de Reabastecimiento',
        fecha: new Date().toISOString(),
        total_estimado: totalEstimado,
        estado: 'pendiente'
      };

      const detallesPayload = items.map(it => ({
        id: window.crypto.randomUUID(),
        lista_id: listaId,
        producto_id: it.producto_id || it.id,
        cantidad_pedir: it.cantidad_pedir,
        costo_unitario: it.costo_unitario
      }));

      const res = await (window as any).electron.guardarListaCompra(listaPayload, detallesPayload);
      if (res.success) {
        alert('¡Lista de compras guardada exitosamente y sincronizada!');
      } else {
        alert(`Error al guardar: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarListaGuardada = (lista: SavedList) => {
    if (lista.detalles && lista.detalles.length > 0) {
      const nuevos: ShoppingItem[] = lista.detalles.map(d => ({
        id: window.crypto.randomUUID(),
        producto_id: d.producto_id,
        nombre: d.nombre || 'Producto',
        categoria: d.categoria || 'General',
        cantidad_pedir: Number(d.cantidad_pedir ?? 1),
        costo_unitario: Number(d.costo_unitario ?? 0),
        unidadMedida: d.unidadMedida || 'UND',
        stock_actual: d.stock !== undefined ? Number(d.stock) : undefined
      }));
      setItems(nuevos);
      setNombreLista(lista.nombre);
      setModalHistorialAbierto(false);
    }
  };

  const eliminarListaGuardada = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await useUIStore.getState().showConfirm('¿Deseas eliminar esta lista guardada?', 'Eliminar Lista');
    if (ok) {
      const res = await (window as any).electron.eliminarListaCompra(id);
      if (res.success) {
        setListasGuardadas(prev => prev.filter(l => l.id !== id));
      }
    }
  };

  // Filtro de inventario para modal
  const categoriasInventario = ['Todas', ...Array.from(new Set(productosInventario.map(p => p.categoria || 'General')))];
  const productosFiltrados = productosInventario.filter(p => {
    if (p.productoPadreId) return false;
    const matchCat = categoriaSeleccionada === 'Todas' || (p.categoria || 'General') === categoriaSeleccionada;
    const matchBusq = !busquedaInventario.trim() || 
      p.nombre?.toLowerCase().includes(busquedaInventario.toLowerCase()) ||
      p.codigoBarras?.toLowerCase().includes(busquedaInventario.toLowerCase());
    return matchCat && matchBusq;
  });

  return (
    <div className="h-full w-full bg-slate-50 p-5 flex flex-col gap-4 overflow-hidden">
      
      {/* Header y Acciones Principales */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <ClipboardList size={26} strokeWidth={2.5} />
          </div>
          <div>
            <input 
              type="text"
              value={nombreLista}
              onChange={e => setNombreLista(e.target.value)}
              className="text-xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition"
              placeholder="Nombre de la Lista..."
            />
            <p className="text-slate-500 text-xs">Planifica compras, detecta bajo stock y envía por WhatsApp</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={cargarBajoStock}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-bold transition shadow-sm cursor-pointer"
            title="Añadir automáticamente productos con stock crítico"
          >
            <AlertTriangle size={15} />
            Cargar Bajo Stock (&le; 5)
          </button>

          <button
            onClick={() => setModalInventarioAbierto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            Desde Catálogo
          </button>

          <button
            onClick={() => setModalManualAbierto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <PackagePlus size={15} />
            Ítem Externo
          </button>

          <button
            onClick={() => {
              cargarHistorial();
              setModalHistorialAbierto(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <History size={15} />
            Historial
          </button>
        </div>
      </div>

      {/* Contenido: Tabla de Items y Resumen */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {/* Tabla / Lista de Ítems */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
              Productos a Pedir ({items.length})
            </span>
            {items.length > 0 && (
              <button 
                onClick={limpiarLista}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={14} /> Limpiar todo
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <ClipboardList size={48} className="text-slate-300 mb-3" />
                <p className="font-bold text-slate-700 text-base">Tu lista está vacía</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Usa "Cargar Bajo Stock" para detectar automáticamente productos agotados o "Desde Catálogo" para seleccionarlos.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between gap-4 transition shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                          {item.nombre}
                          {item.esManual && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-medium">
                              Externo
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium">{item.categoria}</span>
                          {item.stock_actual !== undefined && (
                            <span className={`text-[11px] font-semibold ${item.stock_actual <= 5 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                              Stock actual: {item.stock_actual}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controles de Cantidad y Costo */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Cantidad ({item.unidadMedida})</span>
                        <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50">
                          <button 
                            onClick={() => actualizarCantidad(item.id, -1)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-l-lg font-bold text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            step="any"
                            min="0.1"
                            value={item.cantidad_pedir}
                            onChange={e => setearCantidad(item.id, parseFloat(e.target.value) || 1)}
                            className="w-14 text-center bg-transparent text-sm font-bold text-slate-900 outline-none"
                          />
                          <button 
                            onClick={() => actualizarCantidad(item.id, 1)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-r-lg font-bold text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Costo Unit. (S/)</span>
                        <input 
                          type="number"
                          step="0.1"
                          min="0"
                          value={item.costo_unitario}
                          onChange={e => setearCosto(item.id, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right font-medium text-slate-900 outline-none focus:border-blue-500 bg-slate-50"
                        />
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Subtotal</span>
                        <span className="text-sm font-bold text-emerald-700">
                          S/ {(item.cantidad_pedir * item.costo_unitario).toFixed(2)}
                        </span>
                      </div>

                      <button 
                        onClick={() => eliminarItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Eliminar de la lista"
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

        {/* Panel Lateral: Resumen y Acciones */}
        <div className="w-80 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Resumen del Pedido
            </h3>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Variedad de Ítems:</span>
                <span className="font-bold text-slate-900">{items.length}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total de Unidades:</span>
                <span className="font-bold text-slate-900">{totalUnidades}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-800">Costo Estimado:</span>
                <span className="text-xl font-extrabold text-emerald-600">
                  S/ {totalEstimado.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4">
              💡 <strong>Consejo:</strong> Puedes compartir directamente esta lista con tus proveedores por WhatsApp o guardarla para consultarla luego.
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={compartirWhatsApp}
              disabled={items.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wide transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 size={16} />
              Enviar por WhatsApp
            </button>

            <button
              onClick={copiarAlPortapapeles}
              disabled={items.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs uppercase tracking-wide transition border border-slate-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiado ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              {copiado ? '¡Copiado al Portapapeles!' : 'Copiar Texto'}
            </button>

            <button
              onClick={guardarLista}
              disabled={items.length === 0 || guardando}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wide transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {guardando ? 'Guardando...' : 'Guardar en Sistema'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Catálogo de Inventario */}
      {modalInventarioAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Search size={18} className="text-blue-600" /> Seleccionar desde Catálogo
              </h3>
              <button 
                onClick={() => setModalInventarioAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 flex gap-3 bg-slate-50">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text"
                  value={busquedaInventario}
                  onChange={e => setBusquedaInventario(e.target.value)}
                  placeholder="Buscar por nombre o código de barras..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>

              <select 
                value={categoriaSeleccionada}
                onChange={e => setCategoriaSeleccionada(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
              >
                {categoriasInventario.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cargandoInventario ? (
                <p className="text-center text-slate-400 py-6 text-sm">Cargando catálogo...</p>
              ) : productosFiltrados.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">No se encontraron productos.</p>
              ) : (
                productosFiltrados.map(prod => {
                  const yaEnLista = items.some(it => it.producto_id === prod.id);
                  return (
                    <div 
                      key={prod.id}
                      className="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{prod.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {prod.categoria || 'General'} • Stock: <span className={`font-bold ${Number(prod.stock ?? 0) <= 5 ? 'text-rose-600' : 'text-slate-700'}`}>{prod.stock ?? 0} {prod.unidadMedida || 'UND'}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => agregarDeInventario(prod)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          yaEnLista 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                        }`}
                      >
                        {yaEnLista ? <Check size={14} /> : <Plus size={14} />}
                        {yaEnLista ? 'Añadido' : 'Añadir'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setModalInventarioAbierto(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar Ítem Externo / Manual */}
      {modalManualAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <PackagePlus size={18} className="text-emerald-600" /> Añadir Ítem Externo
              </h3>
              <button 
                onClick={() => setModalManualAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={agregarManual} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre del Producto *</label>
                <input 
                  required
                  type="text"
                  value={manualForm.nombre}
                  onChange={e => setManualForm({...manualForm, nombre: e.target.value})}
                  placeholder="ej: Bolsas biodegradables o Limones"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Categoría</label>
                  <input 
                    type="text"
                    value={manualForm.categoria}
                    onChange={e => setManualForm({...manualForm, categoria: e.target.value})}
                    placeholder="Abarrotes"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Unidad</label>
                  <select
                    value={manualForm.unidadMedida}
                    onChange={e => setManualForm({...manualForm, unidadMedida: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="UND">Unidad (UND)</option>
                    <option value="KG">Kilogramos (KG)</option>
                    <option value="PQTE">Paquete (PQTE)</option>
                    <option value="L">Litros (L)</option>
                    <option value="CAJA">Caja (CAJA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Cantidad a Pedir *</label>
                  <input 
                    required
                    type="number"
                    step="any"
                    min="0.1"
                    value={manualForm.cantidad_pedir}
                    onChange={e => setManualForm({...manualForm, cantidad_pedir: parseFloat(e.target.value) || 1})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Costo Estimado (S/)</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualForm.costo_unitario}
                    onChange={e => setManualForm({...manualForm, costo_unitario: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setModalManualAbierto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer"
                >
                  Agregar a Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial de Listas Guardadas */}
      {modalHistorialAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <History size={18} className="text-slate-600" /> Historial de Listas Guardadas
              </h3>
              <button 
                onClick={() => setModalHistorialAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cargandoHistorial ? (
                <p className="text-center text-slate-400 py-6 text-sm">Cargando historial...</p>
              ) : listasGuardadas.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">No hay listas guardadas aún.</p>
              ) : (
                listasGuardadas.map(lista => (
                  <div 
                    key={lista.id}
                    onClick={() => cargarListaGuardada(lista)}
                    className="p-3.5 bg-white border border-slate-200 hover:border-blue-400 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition shadow-xs"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{lista.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(lista.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • {lista.detalles?.length || 0} ítems
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-emerald-700">
                        S/ {Number(lista.total_estimado ?? 0).toFixed(2)}
                      </span>
                      <button
                        onClick={(e) => eliminarListaGuardada(lista.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setModalHistorialAbierto(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
