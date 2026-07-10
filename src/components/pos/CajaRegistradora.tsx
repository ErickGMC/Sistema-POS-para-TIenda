import React, { useState, useEffect, useRef } from 'react';
import { usePosStore } from '../../store/usePosStore';
import { Search, ShoppingCart, CreditCard, Banknote, Trash2, X, MessageCircle, CheckCircle2, Phone, Image as ImageIcon, List, LayoutGrid } from 'lucide-react';

export default function CajaRegistradora() {
  const { carrito, total, agregarProducto, removerProducto, actualizarCantidad, limpiarCarrito } = usePosStore();
  const [codigoTerm, setCodigoTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [mensaje, setMensaje] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cargandoCobro, setCargandoCobro] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estados del modal de cobro
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'yape' | 'plin'>('efectivo');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDocumento, setClienteDocumento] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  
  // Estado para la pantalla de éxito post-venta
  const [ventaCompletada, setVentaCompletada] = useState<any | null>(null);
  const [waPhone, setWaPhone] = useState('');
  



  // Buscar sugerencias en tiempo real
  useEffect(() => {
    const fetchSuggestions = async () => {
      let term = codigoTerm;
      if (codigoTerm.includes('*')) {
        term = codigoTerm.split('*')[1] || '';
      }
      
      if (term.trim().length >= 2) {
        try {
          const results = await (window as any).electron.buscarProductosPorNombre(term);
          setSuggestions(results || []);
          setSelectedIndex(0);
        } catch (err) {
          console.error(err);
        }
      } else {
        try {
          const results = await (window as any).electron.obtenerTodosProductos();
          const destacados = results.filter((p: any) => p.destacado);
          setSuggestions(destacados || []);
          setSelectedIndex(0);
        } catch (err) {
          setSuggestions([]);
        }
      }
    };

    fetchSuggestions();
  }, [codigoTerm]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  // Auto-focus en el input principal siempre que sea posible
  useEffect(() => {
    inputRef.current?.focus();
    
    // Atajos de teclado globales
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCodigoTerm('');
        setModalCobroOpen(false);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        abrirPanelCobro();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito, total]);

  const buscarYAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoTerm.trim()) return;

    // Detectar si es peso ej: "0.5*770200400"
    let term = codigoTerm;
    let cantidad = 1;
    
    if (codigoTerm.includes('*')) {
      const parts = codigoTerm.split('*');
      cantidad = parseFloat(parts[0]) || 1;
      term = parts[1];
    }

    try {
      // Intentar primero búsqueda exacta de código de barras
      let producto = await (window as any).electron.buscarProductoPorCodigo(term);
      
      // Si no hay código coincidente directo pero hay sugerencias, tomar la sugerencia seleccionada
      if (!producto && suggestions.length > 0) {
        producto = suggestions[selectedIndex];
      }
      
      if (producto) {
        if (producto.stock <= 0) {
          setMensaje(`Advertencia: ${producto.nombre} no cuenta con stock (Stk: 0).`);
          setTimeout(() => setMensaje(''), 4000);
        }
        agregarProducto(producto, cantidad);
        setMensaje('');
        setCodigoTerm('');
        setSuggestions([]);
      } else {
        setMensaje('Producto no encontrado: ' + term);
      }
    } catch (err) {
      console.error(err);
      setMensaje('Error al buscar producto');
    }
    
    inputRef.current?.focus();
  };

  const abrirPanelCobro = () => {
    if (carrito.length === 0) return;
    setMetodoPago('efectivo');
    setClienteNombre('');
    setClienteDocumento('');
    setMontoRecibido('');
    setVentaCompletada(null);
    setWaPhone('');
    setModalCobroOpen(true);
  };

  const confirmarCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargandoCobro) return;
    
    setCargandoCobro(true);
    setMensaje('');

    const ventaId = window.crypto.randomUUID();
    
    const venta = {
      id: ventaId,
      total: total,
      metodoPago: metodoPago,
      clienteNombre: clienteNombre.trim() || 'PÚBLICO GENERAL',
      clienteDocumento: clienteDocumento.trim() || undefined
    };
    
    const detalle = carrito.map(item => ({
      id: window.crypto.randomUUID(),
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      precio_unitario: item.producto.precio,
      subtotal: item.subtotal
    }));

    try {
      const res = await (window as any).electron.guardarVenta(venta, detalle);
      if (res.success) {
        // Formatear datos para WhatsApp
        const ventaObj = {
          id: res.ventaId,
          fecha: new Date().toISOString(),
          total: total,
          detalles: carrito.map(item => ({
            cantidad: item.cantidad,
            producto_nombre: item.producto.nombre,
            subtotal: item.subtotal,
            precio_unitario: item.producto.precio
          }))
        };

        // Mostrar pantalla de éxito
        setVentaCompletada(ventaObj);
        limpiarCarrito();
      } else {
        alert('Error al guardar venta: ' + res.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error crítico de sistema al procesar venta');
    } finally {
      setCargandoCobro(false);
      inputRef.current?.focus();
    }
  };

  // Cálculo del Vuelto en tiempo real
  const vuelto = montoRecibido ? parseFloat(montoRecibido) - total : 0;

  const enviarWhatsApp = () => {
    if (!waPhone || waPhone.length < 8) {
      alert("Por favor ingresa un número de teléfono válido (ej. 51999999999)");
      return;
    }

    const formatearFecha = (fecha: string) => {
      return new Date(fecha).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    let texto = `*SISTEMA POS - TICKET DE VENTA*%0A`;
    texto += `Ticket ID: ${ventaCompletada.id.toUpperCase()}%0A`;
    texto += `Fecha: ${formatearFecha(ventaCompletada.fecha)}%0A`;
    texto += `--------------------------------%0A`;
    
    ventaCompletada.detalles.forEach((d: any) => {
      texto += `${d.cantidad}x ${d.producto_nombre || 'Producto'}%0A`;
      texto += `Subtotal: S/ ${d.subtotal.toFixed(2)}%0A`;
    });
    
    texto += `--------------------------------%0A`;
    texto += `*TOTAL: S/ ${ventaCompletada.total.toFixed(2)}*%0A`;
    texto += `Gracias por tu compra.`;

    (window as any).electron.openExternal(`https://wa.me/${waPhone}?text=${texto}`);
    setModalCobroOpen(false);
    setVentaCompletada(null);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      
      {/* Panel Izquierdo: Buscador y Grilla rápida */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-700">
        
        {/* Topbar Buscador */}
        <div className="p-4 bg-slate-800 shadow-md">
          <form onSubmit={buscarYAgregar} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              className="block w-full pl-12 pr-16 py-4 border-2 border-slate-600 rounded-lg leading-5 bg-slate-900 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-2xl transition-colors"
              placeholder="Buscar por nombre o escanea código... (F2)"
              value={codigoTerm}
              onChange={(e) => setCodigoTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-3">
              <div className="flex bg-slate-950 border border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Vista de Lista"
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  title="Vista de Cuadrícula"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </form>
          {mensaje && (
            <div className="mt-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5">
              <span>{mensaje}</span>
            </div>
          )}
        </div>

        {/* Sugerencias de Búsqueda */}
        <div className={`flex-1 overflow-y-auto bg-slate-900 custom-scrollbar ${viewMode === 'grid' ? 'p-4' : ''}`}>
          {suggestions.length > 0 ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-3 lg:grid-cols-4 gap-2' : 'flex flex-col divide-y divide-slate-800'}>
              {suggestions.map((prod, idx) => {
                const isSelected = idx === selectedIndex;
                return viewMode === 'list' ? (
                  <div
                    key={prod.id}
                    onClick={() => {
                      let cantidad = 1;
                      if (codigoTerm.includes('*')) {
                        cantidad = parseFloat(codigoTerm.split('*')[0]) || 1;
                      }
                      agregarProducto(prod, cantidad);
                      setCodigoTerm('');
                      setSuggestions([]);
                      inputRef.current?.focus();
                    }}
                    className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-600/20 hover:bg-emerald-600/30' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className={`font-semibold text-sm truncate ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {prod.nombre}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 min-w-0">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0 font-mono">{prod.codigoBarras || 'S/C'}</span>
                        <span className="truncate">{prod.descripcion || 'Sin descripción'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-4">
                      <div className={`text-xs font-medium ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`}>
                        Stk: {prod.stock}
                      </div>
                      <div className={`font-bold text-base w-20 ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                        S/ {prod.precio.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={prod.id}
                    onClick={() => {
                      let cantidad = 1;
                      if (codigoTerm.includes('*')) {
                        cantidad = parseFloat(codigoTerm.split('*')[0]) || 1;
                      }
                      agregarProducto(prod, cantidad);
                      setCodigoTerm('');
                      setSuggestions([]);
                      inputRef.current?.focus();
                    }}
                    className={`flex flex-col bg-slate-800 rounded-xl overflow-hidden cursor-pointer border transition-all ${
                      isSelected ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.02]' : 'border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="h-24 w-full bg-slate-900 relative">
                      {prod.imagenUrl ? (
                        <img src={prod.imagenUrl} alt={prod.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                          <ImageIcon size={32} className="mb-2 opacity-50" />
                          <span className="text-xs font-medium">Sin Imagen</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm text-slate-300 text-xs px-2 py-1 rounded-md font-mono border border-slate-700/50">
                        {prod.codigoBarras || 'S/C'}
                      </div>
                    </div>
                    
                    <div className="p-3 flex flex-col flex-1">
                      <div className={`font-bold text-sm mb-1 line-clamp-2 ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {prod.nombre}
                      </div>
                      <div className="mt-auto pt-2 flex justify-between items-end border-t border-slate-700/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Precio</span>
                          <span className="font-black text-md text-emerald-400">S/ {prod.precio.toFixed(2)}</span>
                        </div>
                        <div className={`text-xs font-medium px-2 py-1 rounded bg-slate-900 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                          Stk: {prod.stock}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic p-4 text-center">
              {codigoTerm.trim().length >= 2 
                ? "No se encontraron productos" 
                : "Escanea un código de barras o escribe el nombre del producto..."}
            </div>
          )}
        </div>
        
        {/* Atajos de teclado Info */}
        <div className="mt-auto p-4 bg-slate-800/50 text-slate-400 text-sm flex gap-6 border-t border-slate-700/50 justify-center">
          <span className="flex items-center gap-1"><kbd className="bg-slate-700 px-2 py-0.5 rounded text-slate-200 text-xs">F2</kbd> Buscar</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-700 px-2 py-0.5 rounded text-slate-200 text-xs">Ctrl+Enter</kbd> Cobrar</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-700 px-2 py-0.5 rounded text-slate-200 text-xs">Esc</kbd> Cancelar</span>
        </div>
      </div>

      {/* Panel Derecho: Ticket de Venta */}
      <div className="w-[450px] flex-shrink-0 flex flex-col bg-slate-900 shadow-2xl z-10 relative">
        <div className="p-5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-emerald-400"/>
            Cesta de Compra
          </h2>
          {carrito.length > 0 && (
            <button 
              onClick={() => confirm('¿Seguro que deseas limpiar la cesta actual?') && limpiarCarrito()}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold uppercase tracking-wider"
            >
              Vaciar
            </button>
          )}
        </div>
        
        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {carrito.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-center">
              Añade productos para iniciar la venta
            </div>
          ) : (
            carrito.map((item) => (
              <div key={item.idTicket} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition">
                <div className="flex-1 flex gap-3">
                  {item.producto.imagenLocal || item.producto.imagenUrl ? (
                    <img src={item.producto.imagenUrl} alt={item.producto.nombre} className="w-12 h-12 rounded object-contain bg-slate-900 border border-slate-700/50 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700/50 flex-shrink-0">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-200 truncate pr-2">{item.producto.nombre}</div>
                    <div className="text-sm text-slate-400 flex items-center gap-2 mt-2">
                    <div className="flex items-center bg-slate-900 border border-slate-650 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => {
                          const newCant = Math.max(0, item.cantidad - 1);
                          if (newCant === 0) {
                            if (confirm('¿Deseas quitar este producto?')) {
                              removerProducto(item.idTicket);
                            }
                          } else {
                            actualizarCantidad(item.idTicket, newCant);
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold transition-colors"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        min="0"
                        step={item.producto.unidadMedida === 'unidad' ? '1' : '0.01'}
                        value={item.cantidad}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            actualizarCantidad(item.idTicket, val);
                          }
                        }}
                        onBlur={() => {
                          if (item.cantidad <= 0) {
                            removerProducto(item.idTicket);
                          }
                        }}
                        className="w-14 h-8 text-center bg-transparent text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      /> 
                      <button 
                        onClick={() => actualizarCantidad(item.idTicket, item.cantidad + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="ml-1 text-xs">{item.producto.unidadMedida} x S/ {(item.producto.precio).toFixed(2)}</span>
                  </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className="font-bold text-lg">S/ {item.subtotal.toFixed(2)}</div>
                  <button 
                    onClick={() => {
                      if (confirm('¿Quitar del ticket?')) {
                        removerProducto(item.idTicket);
                      }
                    }} 
                    className="text-red-400 hover:text-red-300 p-2 hover:bg-red-400/10 rounded-full transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Total y Cobro */}
        <div className="bg-slate-800 p-6 border-t border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <div className="flex justify-between items-end mb-6">
            <span className="text-slate-400 text-lg uppercase tracking-wider">Total a Cobrar</span>
            <span className="text-5xl font-black text-emerald-400">S/ {total.toFixed(2)}</span>
          </div>
          
          <button 
            onClick={abrirPanelCobro}
            disabled={carrito.length === 0 || cargandoCobro}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-5 rounded-xl text-2xl transition transform active:scale-[0.98] flex justify-center items-center gap-3 shadow-lg shadow-emerald-500/20"
          >
            <CreditCard size={28} />
            COBRAR (Ctrl+Enter)
          </button>

          <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-500 border-t border-slate-700/50 pt-4">
             <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">F2</kbd> Buscar Producto</span>
             <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Esc</kbd> Limpiar / Cancelar</span>
             <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">Ctrl+Enter</kbd> Cobrar</span>
          </div>
        </div>
      </div>

      {/* MODAL DE COBRO PROFESIONAL (SUNAT COMPLIANT) */}
      {modalCobroOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-[500px] bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
            
            <button 
              onClick={() => { setModalCobroOpen(false); setVentaCompletada(null); }}
              className="absolute right-5 top-5 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition z-10"
            >
              <X size={18} />
            </button>

            {ventaCompletada ? (
              <div className="flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">¡Venta Exitosa!</h3>
                <p className="text-slate-400 mb-6">El ticket <strong className="text-emerald-400">{ventaCompletada.id}</strong> se ha guardado correctamente.</p>
                
                <div className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-6 mb-6">
                  <span className="block text-sm text-slate-400 mb-2">Monto Cobrado</span>
                  <span className="text-4xl font-black text-emerald-400">S/ {ventaCompletada.total.toFixed(2)}</span>
                </div>

                <div className="w-full mb-6 text-left">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                    <Phone size={14}/> Enviar Ticket por WhatsApp
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-3.5 text-slate-400 text-sm font-semibold">+</span>
                      <input 
                        type="text" 
                        placeholder="Ej: 51999999999" 
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-8 text-white focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={enviarWhatsApp}
                      className="bg-[#25D366] hover:bg-[#20b858] text-slate-950 font-bold px-4 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-[#25D366]/20"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 ml-1">Incluye código de país (Ej: 51 para Perú)</p>
                </div>

                <button
                  onClick={() => { setModalCobroOpen(false); setVentaCompletada(null); }}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg rounded-xl transition flex items-center justify-center gap-2"
                >
                  Continuar (Nueva Venta)
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <Banknote className="text-emerald-400" />
                  Finalizar Transacción
                </h3>
                <p className="text-slate-400 text-xs mb-6">Completa el método de pago y la información opcional para el ticket SUNAT.</p>

                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">TOTAL A PAGAR</span>
                  <span className="text-3xl font-black text-emerald-400">S/ {total.toFixed(2)}</span>
                </div>

                <form onSubmit={confirmarCobro} className="space-y-4">
              
              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Método de Pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['efectivo', 'tarjeta', 'yape', 'plin'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPago(m)}
                      className={`py-3.5 px-2 rounded-xl text-xs font-bold text-center border capitalize transition-all ${
                        metodoPago === m
                          ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Si es Efectivo, mostrar cálculo de vuelto */}
              {metodoPago === 'efectivo' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 ml-1">Monto Recibido</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400 text-sm font-semibold">S/</span>
                      <input
                        required
                        type="number"
                        min={total}
                        step="0.1"
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder="Ej: 50.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 pl-8 text-white text-lg font-bold focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 mb-1">Vuelto a entregar</span>
                    <div className={`text-2xl font-black p-2 bg-slate-900 border border-slate-750 rounded-xl text-center ${
                      vuelto > 0 ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      S/ {vuelto >= 0 ? vuelto.toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              )}

              {/* Datos de Cliente para Ticket Electrónico */}
              <div className="border-t border-slate-800 pt-4">
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Datos del Cliente (Opcional - SUNAT)</span>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <input
                      type="text"
                      placeholder="DNI / RUC"
                      maxLength={11}
                      value={clienteDocumento}
                      onChange={(e) => setClienteDocumento(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Nombre o Razón Social"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Confirmar y Finalizar */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={cargandoCobro}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 size={20} />
                  {cargandoCobro ? 'PROCESANDO VENTA...' : 'CONFIRMAR VENTA'}
                </button>
              </div>

            </form>
          </>
          )}
          </div>
        </div>
      )}



    </div>
  );
}
