import React, { useState, useEffect, useRef } from 'react';
import { usePosStore } from '../../store/usePosStore';
import { Search, ShoppingCart, CreditCard, Trash2, AlertCircle, PlusCircle, List, LayoutGrid, Image as ImageIcon, Scale } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { generarHtmlTicket } from '../../utils/ticketPrinter';
import { esProductoPorPeso } from '../../utils/weightHelper';
import ModalCobro from './ModalCobro';
import ModalPesaje from './ModalPesaje';
import ModalItemPersonalizado from './ModalItemPersonalizado';
import ModalVentaExitosa from './ModalVentaExitosa';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

export default function CajaRegistradora() {
  const {
    carrito, total, agregarProducto, agregarItemPersonalizado, removerProducto,
    actualizarCantidad, actualizarPrecioItem, limpiarCarrito, clienteTelefono
  } = usePosStore();
  const [codigoTerm, setCodigoTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [mensaje, setMensaje] = useState('');
  const [errorCobro, setErrorCobro] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cargandoCobro, setCargandoCobro] = useState(false);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const verificarTurno = async () => {
      try {
        const res = await (window as any).electron?.obtenerTurnoActual();
        setCajaAbierta(Boolean(res?.success && res?.turno));
      } catch (_) {
        setCajaAbierta(true);
      }
    };
    verificarTurno();
  }, [cargandoCobro]);

  // Modal Ítem Libre / Servicio
  const [customModalOpen, setCustomModalOpen] = useState(false);

  // Modal de Pesaje (Balanza / Productos a granel)
  const [modalPesajeOpen, setModalPesajeOpen] = useState(false);
  const [productoPesaje, setProductoPesaje] = useState<any | null>(null);
  const [ticketItemEditando, setTicketItemEditando] = useState<string | null>(null);
  const [pesoInput, setPesoInput] = useState<string>('0.500');

  // Estados del modal de cobro
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [clienteNombre] = useState('');
  const [clienteDocumento] = useState('');
  
  // Estado para la pantalla de éxito post-venta
  const [ventaCompletada, setVentaCompletada] = useState<any | null>(null);
  
  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });


  const cargarDestacados = async () => {
    try {
      let results = [];
      if (typeof (window as any).electron?.obtenerProductosParaVenta === 'function') {
        results = await (window as any).electron.obtenerProductosParaVenta();
      } else {
        results = await (window as any).electron.obtenerTodosProductos();
      }
      const vendibles = (results || []).filter((p: any) => !p.esPrincipalWeb && p.disponible !== 0 && p.disponible !== false);
      const ordenados = [...vendibles].sort((a: any, b: any) => {
        const destA = a.destacado ? 1 : 0;
        const destB = b.destacado ? 1 : 0;
        if (destB !== destA) return destB - destA;
        return (a.nombre || '').localeCompare(b.nombre || '');
      });
      setSuggestions(ordenados);
      setSelectedIndex(0);
    } catch {
      setSuggestions([]);
    }
  };

  const buscarProductos = async (termParam?: string) => {
    let term = termParam !== undefined ? termParam : codigoTerm;
    if (term.includes('*')) {
      term = term.split('*')[1] || '';
    }
    
    if (term.trim().length >= 2) {
      try {
        const results = await (window as any).electron.buscarProductosPorNombre(term);
        const vendibles = (results || []).filter((p: any) => !p.esPrincipalWeb);
        setSuggestions(vendibles);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      }
    } else {
      cargarDestacados();
    }
  };

  // Buscar sugerencias en tiempo real
  useEffect(() => {
    buscarProductos();
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

  // Ref para manejar el timeout del mensaje y evitar solapamientos
  const mensajeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarMensaje = (msg: string, duracion = 4000) => {
    setMensaje(msg);
    if (mensajeTimeoutRef.current) {
      clearTimeout(mensajeTimeoutRef.current);
    }
    mensajeTimeoutRef.current = setTimeout(() => {
      setMensaje('');
    }, duracion);
  };

  // Auto-focus en el input principal siempre que sea posible
  useEffect(() => {
    inputRef.current?.focus();
    
    // Atajos de teclado globales
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // No interceptar si el usuario está escribiendo en otro input (ej. WhatsApp, Cliente)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Permitir solo si es nuestro input principal y es un comando especial
        if (e.target !== inputRef.current) return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCodigoTerm('');
        setModalCobroOpen(false);
        setModalPesajeOpen(false);
        setProductoPesaje(null);
        setTicketItemEditando(null);
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        abrirPanelCobro();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito, total]);

  const abrirModalPesaje = (prod: any, idTicketExistente: string | null = null, pesoInicial: number = 0.500) => {
    setProductoPesaje(prod);
    setTicketItemEditando(idTicketExistente);
    setPesoInput(pesoInicial > 0 ? pesoInicial.toFixed(3) : '0.500');
    setModalPesajeOpen(true);
  };

  const intentarAgregarProducto = (prod: any, cantidadPrevia?: number) => {
    if (prod.esPrincipalWeb) {
      mostrarMensaje(`"${prod.nombre}" es una Familia Web y no un ítem vendible en caja.`);
      return;
    }
    if (prod.stock <= 0) {
      mostrarMensaje(`Advertencia: ${prod.nombre} no cuenta con stock (Stk: 0).`);
    }

    // Si ya se especificó multiplicador en la barra ej: "0.5*CODIGO", usarlo directamente
    if (cantidadPrevia !== undefined && cantidadPrevia !== 1) {
      agregarProducto(prod, cantidadPrevia);
      setMensaje('');
      if (codigoTerm === '') {
        cargarDestacados();
      } else {
        setCodigoTerm('');
      }
      inputRef.current?.focus();
      return;
    }

    // Si es producto vendido por peso (kg, granel, etc.), abrir modal de pesaje
    if (esProductoPorPeso(prod.unidadMedida)) {
      abrirModalPesaje(prod, null, 0.500);
      return;
    }

    // Si es por unidad estándar, agregar 1
    agregarProducto(prod, 1);
    setMensaje('');
    if (codigoTerm === '') {
      cargarDestacados();
    } else {
      setCodigoTerm('');
    }
    inputRef.current?.focus();
  };

  const buscarYAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoTerm.trim()) return;

    // Detectar si es peso ej: "0.5*770200400"
    let term = codigoTerm;
    let cantidad = 1;
    let tieneMultiplicador = false;
    
    if (codigoTerm.includes('*')) {
      const parts = codigoTerm.split('*');
      cantidad = parseFloat(parts[0]) || 1;
      term = parts[1];
      tieneMultiplicador = true;
    }

    try {
      // Intentar primero búsqueda exacta de código de barras
      let producto = await (window as any).electron.buscarProductoPorCodigo(term);
      
      // Si no hay código coincidente directo pero hay sugerencias, tomar la sugerencia seleccionada
      if (!producto && suggestions.length > 0) {
        producto = suggestions[selectedIndex];
      }
      
      if (producto) {
        if (tieneMultiplicador) {
          if (producto.esPrincipalWeb) {
            mostrarMensaje(`"${producto.nombre}" es una Familia Web y no un ítem vendible en caja.`);
            return;
          }
          if (producto.stock <= 0) {
            mostrarMensaje(`Advertencia: ${producto.nombre} no cuenta con stock (Stk: 0).`);
          }
          agregarProducto(producto, cantidad);
          setMensaje('');
          setCodigoTerm('');
          inputRef.current?.focus();
        } else {
          intentarAgregarProducto(producto);
        }
      } else {
        mostrarMensaje('Producto no encontrado: ' + term);
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al buscar producto');
    }
    
    inputRef.current?.focus();
  };

  const imprimirTicketPDF4x6 = (ventaData?: any) => {
    const vData = ventaData || ventaCompletada;
    if (!vData) return;

    const ticketVenta = {
      id: vData.id || 'M001',
      total: vData.total || total,
      metodoPago: vData.metodoPago || 'Efectivo',
      clienteNombre: vData.clienteNombre || clienteNombre || 'PÚBLICO GENERAL',
      clienteDocumento: vData.clienteDocumento || clienteDocumento || '',
      fecha_creacion: vData.fecha || new Date().toISOString()
    };

    const ticketDetalle = (vData.detalles || carrito).map((d: any) => ({
      nombre: d.producto_nombre || d.producto?.nombre || 'Producto',
      cantidad: d.cantidad,
      precio: d.precio_unitario || d.producto?.precio || 0
    }));

    const html = generarHtmlTicket(
      ticketVenta,
      ticketDetalle,
      {},
      { nombreTienda: 'MINIMARKET FLOR' }
    );

    const win = window.open('', '_blank', 'width=450,height=650');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 300);
    }
  };

  const abrirPanelCobro = () => {
    if (carrito.length === 0) return;
    setVentaCompletada(null);
    setErrorCobro('');
    setModalCobroOpen(true);
  };

  const buscarYAgregarPorCodigo = async (term: string) => {
    if (!term.trim()) return;
    let barcode = term.trim();
    let cantidad = 1;
    let tieneMultiplicador = false;

    if (barcode.includes('*')) {
      const parts = barcode.split('*');
      cantidad = parseFloat(parts[0]) || 1;
      barcode = parts[1];
      tieneMultiplicador = true;
    }

    try {
      const producto = await (window as any).electron.buscarProductoPorCodigo(barcode);
      if (producto) {
        if (tieneMultiplicador) {
          if (producto.esPrincipalWeb) {
            mostrarMensaje(`"${producto.nombre}" es una Familia Web y no un ítem vendible en caja.`);
            return;
          }
          if (producto.stock <= 0) {
            mostrarMensaje(`Advertencia: ${producto.nombre} no cuenta con stock (Stk: 0).`);
          }
          agregarProducto(producto, cantidad);
          setMensaje('');
          setCodigoTerm('');
        } else {
          intentarAgregarProducto(producto);
        }
      } else {
        mostrarMensaje('Producto no encontrado: ' + barcode);
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al buscar producto');
    }
  };

  // Escaneo global de códigos de barras (pistola USB / Bluetooth HID)
  useBarcodeScanner({
    onScan: (scannedCode) => {
      buscarYAgregarPorCodigo(scannedCode);
    },
    enabled: !modalCobroOpen && !modalPesajeOpen && !customModalOpen && !ventaCompletada,
  });

  // Escucha en tiempo real de actualizaciones de productos desde Firestore (ej. ventas desde AE_POS Android)
  useEffect(() => {
    if ((window as any).electron?.onProductsChanged) {
      const unsub = (window as any).electron.onProductsChanged(() => {
        if (codigoTerm) {
          buscarProductos(codigoTerm);
        } else {
          cargarDestacados();
        }
      });
      return () => unsub();
    }
  }, [codigoTerm]);

  const confirmarCobroConDatos = async (data: {
    metodoPago: 'efectivo' | 'tarjeta' | 'yape' | 'plin';
    montoRecibido: number;
    clienteNombre: string;
    clienteDocumento: string;
    clienteTelefono: string;
  }) => {
    if (cargandoCobro) return;
    setCargandoCobro(true);
    setMensaje('');

    const ventaId = window.crypto.randomUUID();
    const venta = {
      id: ventaId,
      total: total,
      metodoPago: data.metodoPago,
      clienteNombre: data.clienteNombre || 'PÚBLICO GENERAL',
      clienteDocumento: data.clienteDocumento || undefined,
    };

    const detalle = carrito.map((item) => ({
      id: window.crypto.randomUUID(),
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      precio_unitario: item.producto.precio,
      subtotal: item.subtotal,
    }));

    try {
      const res = await (window as any).electron.guardarVenta(venta, detalle);
      if (res.success) {
        setErrorCobro('');
        const ventaObj = {
          id: res.ventaId,
          fecha: new Date().toISOString(),
          total: total,
          detalles: carrito.map((item) => ({
            cantidad: item.cantidad,
            producto_nombre: item.producto.nombre,
            subtotal: item.subtotal,
            precio_unitario: item.producto.precio,
          })),
        };
        setVentaCompletada(ventaObj);
        limpiarCarrito();
      } else {
        setErrorCobro('Error al guardar la venta: ' + (res.error || 'Error desconocido. Intenta nuevamente.'));
      }
    } catch (err: any) {
      console.error(err);
      setErrorCobro('Error de comunicación con la base de datos: ' + (err.message || ''));
    } finally {
      setCargandoCobro(false);
      inputRef.current?.focus();
    }
  };

  const enviarWhatsAppConTelefono = async (phone: string, ventaObj: any) => {
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

    const formatearFecha = (fecha: string) => {
      return new Date(fecha).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    };

    let texto = `*SISTEMA POS - TICKET DE VENTA*\n`;
    texto += `Ticket ID: ${(ventaObj.id || '').toUpperCase()}\n`;
    texto += `Fecha: ${formatearFecha(ventaObj.fecha)}\n`;
    texto += `--------------------------------\n`;

    (ventaObj.detalles || []).forEach((d: any) => {
      texto += `${d.cantidad}x ${d.producto_nombre || 'Producto'}\n`;
      texto += `Subtotal: S/ ${(d.subtotal || 0).toFixed(2)}\n`;
    });

    texto += `--------------------------------\n`;
    texto += `*TOTAL: S/ ${(ventaObj.total || 0).toFixed(2)}*\n`;
    texto += `Gracias por tu compra.`;

    useUIStore.getState().openWhatsApp(phone, texto);
    setModalCobroOpen(false);
    setVentaCompletada(null);
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans">
      
      {/* Panel Izquierdo: Buscador y Grilla rápida */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-300">
        
        {/* Alerta de Caja Cerrada */}
        {cajaAbierta === false && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-amber-950" />
              Atención: La caja registradora está cerrada. Abre un turno en la pestaña "Control de Caja" para un arqueo de efectivo exacto.
            </span>
          </div>
        )}

        {/* Topbar Buscador */}
        <div className="p-4 bg-slate-100 shadow-md">
          <form onSubmit={buscarYAgregar} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-slate-600" />
            </div>
            <input
              id="barcode-search-input"
              data-barcode-input="true"
              ref={inputRef}
              type="text"
              className="block w-full pl-12 pr-16 py-4 border border-slate-350 rounded-xl leading-5 bg-white shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-2xl transition-colors"
              placeholder="Buscar por nombre o escanea código... (F2)"
              value={codigoTerm}
              onChange={(e) => setCodigoTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-3">
              <div className="flex bg-slate-50 border border-slate-300 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-200 text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Vista de Lista"
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-200 text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Vista de Cuadrícula"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </form>
          {mensaje && (
            <div className="mt-2 text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5">
              <span>{mensaje}</span>
            </div>
          )}
        </div>

        {/* Sugerencias de Búsqueda */}
        <div className={`flex-1 overflow-y-auto bg-white custom-scrollbar-light-light-light ${viewMode === 'grid' ? 'p-4' : ''}`}>
          {suggestions.length > 0 ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-3 lg:grid-cols-4 gap-3' : 'flex flex-col divide-y divide-slate-200'}>
              {suggestions.map((prod, idx) => {
                const isSelected = idx === selectedIndex;
                return viewMode === 'list' ? (
                  <div
                    key={prod.id}
                    onClick={() => {
                      let cantidad = 1;
                      let tieneMultiplicador = false;
                      if (codigoTerm.includes('*')) {
                        cantidad = parseFloat(codigoTerm.split('*')[0]) || 1;
                        tieneMultiplicador = true;
                      }
                      if (tieneMultiplicador) {
                        agregarProducto(prod, cantidad);
                        setCodigoTerm('');
                        inputRef.current?.focus();
                      } else {
                        intentarAgregarProducto(prod);
                      }
                    }}
                    className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-600/20 hover:bg-emerald-600/30' : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-250 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                        {prod.imagenLocal || prod.imagenUrl ? (
                          <img src={prod.imagenLocal || prod.imagenUrl} alt={prod.nombre} className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold text-sm truncate flex items-center gap-1.5 ${isSelected ? 'text-emerald-600' : 'text-slate-800'}`}>
                          <span>{prod.nombre}</span>
                          {esProductoPorPeso(prod.unidadMedida) && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Scale size={10} /> Balanza
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 min-w-0">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 flex-shrink-0 font-mono text-[10px]">{prod.codigoBarras || 'S/C'}</span>
                          <span className="bg-emerald-50 text-emerald-700 font-medium px-1.5 py-0.5 rounded text-[10px]">{prod.categoria}</span>
                          <span className="truncate text-slate-400">{prod.descripcion || ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-4">
                      <div className={`text-xs font-semibold px-2 py-1 rounded-md ${prod.stock < 10 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        Stk: {Number.isInteger(prod.stock) ? prod.stock : prod.stock.toFixed(3)} {esProductoPorPeso(prod.unidadMedida) ? 'kg' : ''}
                      </div>
                      <div className={`font-black text-base w-24 text-right ${isSelected ? 'text-emerald-600' : 'text-slate-900'}`}>
                        S/ {prod.precio.toFixed(2)}{esProductoPorPeso(prod.unidadMedida) ? '/kg' : ''}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={prod.id}
                    onClick={() => {
                      let cantidad = 1;
                      let tieneMultiplicador = false;
                      if (codigoTerm.includes('*')) {
                        cantidad = parseFloat(codigoTerm.split('*')[0]) || 1;
                        tieneMultiplicador = true;
                      }
                      if (tieneMultiplicador) {
                        agregarProducto(prod, cantidad);
                        setCodigoTerm('');
                        inputRef.current?.focus();
                      } else {
                        intentarAgregarProducto(prod);
                      }
                    }}
                    className={`flex flex-col bg-white rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 shadow-sm hover:shadow-md ${
                      isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]' : 'border-slate-250 hover:border-slate-400 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="h-28 w-full bg-slate-50 relative flex items-center justify-center p-2 border-b border-slate-200/70">
                      {(prod.imagenLocal || prod.imagenUrl) ? (
                        <img 
                          src={prod.imagenLocal || prod.imagenUrl} 
                          alt={prod.nombre} 
                          className="w-full h-full object-contain transition-transform hover:scale-105" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon size={28} className="mb-1 opacity-60" />
                          <span className="text-[10px] font-medium text-slate-400">Sin Imagen</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] px-1.5 py-0.5 rounded-md font-mono border border-slate-300 shadow-sm">
                        {prod.codigoBarras || 'S/C'}
                      </div>
                      {prod.categoria && (
                        <div className="absolute bottom-1.5 left-2 bg-emerald-50/90 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                          {prod.categoria}
                        </div>
                      )}
                      {esProductoPorPeso(prod.unidadMedida) && (
                        <div className="absolute bottom-1.5 right-2 bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                          <Scale size={10} /> Balanza
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 flex flex-col flex-1 justify-between bg-white">
                      <div className={`font-bold text-xs sm:text-sm line-clamp-2 leading-tight ${isSelected ? 'text-emerald-600' : 'text-slate-800'}`} title={prod.nombre}>
                        {prod.nombre}
                      </div>
                      <div className="pt-2 flex justify-between items-end border-t border-slate-100 mt-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {esProductoPorPeso(prod.unidadMedida) ? 'Precio / Kg' : 'Precio'}
                          </span>
                          <span className="font-black text-sm sm:text-base text-emerald-600">
                            S/ {prod.precio.toFixed(2)}{esProductoPorPeso(prod.unidadMedida) ? '/kg' : ''}
                          </span>
                        </div>
                        <div className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${prod.stock < 10 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          Stk: {Number.isInteger(prod.stock) ? prod.stock : prod.stock.toFixed(3)} {esProductoPorPeso(prod.unidadMedida) ? 'kg' : ''}
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
        <div className="mt-auto p-4 bg-slate-100/50 text-slate-600 text-sm flex gap-6 border-t border-slate-300/50 justify-center">
          <span className="flex items-center gap-1"><kbd className="bg-slate-200 px-2 py-0.5 rounded text-slate-800 text-xs">F2</kbd> Buscar</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-200 px-2 py-0.5 rounded text-slate-800 text-xs">Ctrl+Enter</kbd> Cobrar</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-200 px-2 py-0.5 rounded text-slate-800 text-xs">Esc</kbd> Cancelar</span>
        </div>
      </div>

      {/* Panel Derecho: Ticket de Venta */}
      <div className="w-[380px] min-w-[340px] flex-shrink-0 flex flex-col bg-white shadow-2xl z-10 relative">
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="text-emerald-600" size={20} />
            Cesta de Compra
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCustomModalOpen(true)}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded transition font-bold flex items-center gap-1 shadow-sm"
              title="Agregar producto o servicio no catalogado"
            >
              <PlusCircle size={14} />
              + Ítem Libre
            </button>
            {carrito.length > 0 && (
              <button 
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Vaciar Cesta',
                    message: '¿Estás seguro de que deseas vaciar toda la cesta actual?',
                    onConfirm: () => {
                      limpiarCarrito();
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }
                  });
                }}
                className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition font-semibold uppercase tracking-wider"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>
        
        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/80 border-y border-slate-250 custom-scrollbar-light">
          {carrito.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-center text-xs flex-col gap-3">
              <span>Añade productos para iniciar la venta</span>
              <button 
                onClick={() => setCustomModalOpen(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow"
              >
                <PlusCircle size={14} />
                + Agregar Servicio / Ítem Libre
              </button>
            </div>
          ) : (
            carrito.map((item) => (
              <div key={item.idTicket} className="flex gap-2.5 bg-white border border-slate-300 hover:border-slate-400 p-3 rounded-2xl transition shadow-sm hover:shadow-md duration-150">
                {item.producto.imagenLocal || item.producto.imagenUrl ? (
                  <img src={item.producto.imagenLocal || item.producto.imagenUrl} alt={item.producto.nombre} className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-250 flex-shrink-0 self-center" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-250 flex-shrink-0 self-center">
                    <ImageIcon size={18} />
                  </div>
                )}
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  {/* Fila Superior: Nombre y Subtotal */}
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-slate-850 text-xs sm:text-sm truncate flex-1 leading-tight flex items-center gap-1" title={item.producto.nombre}>
                      {item.producto.nombre}
                      {item.producto.id.startsWith('custom-') && (
                        <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">Libre</span>
                      )}
                      {esProductoPorPeso(item.producto.unidadMedida) && (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Scale size={10} /> Peso
                        </span>
                      )}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm flex-shrink-0 leading-tight">
                      S/ {item.subtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Fila Inferior: Controles de cantidad, precio unitario y eliminar */}
                  <div className="flex justify-between items-center mt-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Control de cantidad compacto */}
                      <div className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm h-7">
                        <button 
                          onClick={() => {
                            const esPeso = esProductoPorPeso(item.producto.unidadMedida);
                            const decremento = esPeso ? 0.100 : 1;
                            const newCant = Math.max(0, Math.round((item.cantidad - decremento) * 1000) / 1000);
                            if (newCant === 0) {
                              setConfirmDialog({
                               isOpen: true,
                               title: 'Quitar Producto',
                               message: `¿Estás seguro de quitar "${item.producto.nombre}" de la cesta?`,
                               onConfirm: () => {
                                 removerProducto(item.idTicket);
                                 setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                 setTimeout(() => inputRef.current?.focus(), 100);
                               }
                              });
                            } else {
                              actualizarCantidad(item.idTicket, newCant);
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors border-r border-slate-200 active:scale-95 cursor-pointer"
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          min="0"
                          step={esProductoPorPeso(item.producto.unidadMedida) ? '0.001' : (item.producto.unidadMedida === 'unidad' ? '1' : '0.01')}
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
                          className={`${esProductoPorPeso(item.producto.unidadMedida) ? 'w-16' : 'w-10'} h-7 text-center bg-transparent text-slate-800 text-xs font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        /> 
                        <button 
                          onClick={() => {
                            const esPeso = esProductoPorPeso(item.producto.unidadMedida);
                            const incremento = esPeso ? 0.100 : 1;
                            const newCant = Math.round((item.cantidad + incremento) * 1000) / 1000;
                            actualizarCantidad(item.idTicket, newCant);
                          }}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors border-l border-slate-200 active:scale-95 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Botón rápido de báscula para reajustar peso si es a granel */}
                      {esProductoPorPeso(item.producto.unidadMedida) && (
                        <button
                          type="button"
                          onClick={() => abrirModalPesaje(item.producto, item.idTicket, item.cantidad)}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-1 rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                          title="Volver a pesar / Ajustar en balanza"
                        >
                          <Scale size={13} className="text-emerald-600" />
                          <span>Pesar</span>
                        </button>
                      )}
                      
                      {/* Campo de edición de precio temporal */}
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs" title="Editar precio del ítem para el ticket (BD intacta)">
                        <span className="text-[10px] text-amber-700 font-bold">S/</span>
                        <input
                          type="number"
                          step="0.10"
                          min="0"
                          value={item.producto.precio}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            actualizarPrecioItem(item.idTicket, isNaN(val) ? 0 : val);
                          }}
                          className="w-14 h-5 text-right bg-transparent text-amber-900 text-xs font-extrabold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Botón de eliminar */}
                    <button 
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Quitar Producto',
                          message: `¿Estás seguro de quitar "${item.producto.nombre}" de la cesta?`,
                          onConfirm: () => {
                            removerProducto(item.idTicket);
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                            setTimeout(() => inputRef.current?.focus(), 100);
                          }
                        });
                      }} 
                      className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                      title="Eliminar de la cesta"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Total y Cobro */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 text-sm uppercase tracking-wider font-semibold">Total a Cobrar</span>
            <span className="text-3xl font-black text-emerald-600">S/ {total.toFixed(2)}</span>
          </div>
          
          <button 
            onClick={abrirPanelCobro}
            disabled={carrito.length === 0 || cargandoCobro}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl text-lg transition transform active:scale-[0.98] flex justify-center items-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer disabled:cursor-not-allowed"
          >
            <CreditCard size={20} />
            COBRAR
          </button>
        </div>
      </div>

      {/* DIÁLOGO DE CONFIRMACIÓN CUSTOM */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-[400px] bg-white border border-slate-200 rounded-2xl p-6 flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Trash2 className="text-rose-500" />
              {confirmDialog.title}
            </h3>
            <p className="text-slate-600 mb-6 text-sm">{confirmDialog.message}</p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-rose-500/20"
              >
                Sí, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COBRO */}
      <ModalCobro
        isOpen={modalCobroOpen && !ventaCompletada}
        total={total}
        cargandoCobro={cargandoCobro}
        errorCobro={errorCobro}
        clienteNombreInicial={clienteNombre}
        clienteDocumentoInicial={clienteDocumento}
        clienteTelefonoInicial={clienteTelefono}
        onClose={() => {
          setModalCobroOpen(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onConfirm={confirmarCobroConDatos}
      />

      {/* MODAL DE VENTA COMPLETADA / ÉXITO */}
      <ModalVentaExitosa
        venta={ventaCompletada}
        clienteTelefono={clienteTelefono}
        onClose={() => {
          setVentaCompletada(null);
          setModalCobroOpen(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onPrintPdf={imprimirTicketPDF4x6}
        onSendWhatsApp={enviarWhatsAppConTelefono}
      />

      {/* MODAL ÍTEM LIBRE / SERVICIO */}
      <ModalItemPersonalizado
        isOpen={customModalOpen}
        onClose={() => {
          setCustomModalOpen(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onAdd={(nom, pre, cant) => {
          agregarItemPersonalizado(nom, pre, cant);
          mostrarMensaje(`✓ "${nom}" agregado a la cesta`);
        }}
      />

      {/* MODAL DE PESAJE / BALANZA */}
      <ModalPesaje
        isOpen={modalPesajeOpen}
        producto={productoPesaje}
        ticketItemId={ticketItemEditando}
        pesoInicial={pesoInput}
        onClose={() => {
          setModalPesajeOpen(false);
          setProductoPesaje(null);
          setTicketItemEditando(null);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onConfirm={(pesoNum) => {
          if (ticketItemEditando) {
            actualizarCantidad(ticketItemEditando, pesoNum);
          } else if (productoPesaje) {
            agregarProducto(productoPesaje, pesoNum);
          }
          if (codigoTerm === '') {
            cargarDestacados();
          } else {
            setCodigoTerm('');
          }
          setTimeout(() => inputRef.current?.focus(), 80);
        }}
      />

    </div>
  );
}
