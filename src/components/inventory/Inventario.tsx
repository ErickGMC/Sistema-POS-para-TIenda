import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Producto } from '../../store/usePosStore';
import { 
  Edit2, Trash2, Image as ImageIcon, Check, X, Search, AlertCircle, CheckCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Package, AlertTriangle, Layers, DollarSign, RotateCcw,
  Plus, Sparkles
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import ListaCompras from './ListaCompras';

// Traduce errores crudos del backend a mensajes amigables
function traducirError(error: string): string {
  if (!error) return 'Error desconocido';
  if (error.includes('UNIQUE constraint failed: productos.codigoBarras')) {
    return 'Ya existe un producto con ese código de barras. Usa uno diferente o déjalo vacío.';
  }
  if (error.includes('Datos inválidos')) {
    return 'Algunos datos del formulario no son válidos. Revisa los campos obligatorios (nombre, precio, stock).';
  }
  if (error.includes('NOT NULL constraint')) {
    return 'Faltan campos obligatorios. Asegúrate de llenar nombre, precio y stock.';
  }
  if (error.includes('FOREIGN KEY') || error.includes('foreign key')) {
    return 'No se puede completar la operación porque hay datos relacionados en otras tablas.';
  }
  return error;
}

export default function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');
  const [stockFiltro, setStockFiltro] = useState<'TODOS' | 'EN_STOCK' | 'BAJO' | 'SIN_STOCK'>('TODOS');
  const [visibilidadFiltro, setVisibilidadFiltro] = useState<'TODOS' | 'VISIBLE' | 'OCULTO'>('TODOS');
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'VENDIBLES' | 'FAMILIAS'>('TODOS');
  const [ordenarPor, setOrdenarPor] = useState<
    'nombre_asc' | 'nombre_desc' | 'categoria_asc' | 'categoria_desc' | 'precio_asc' | 'precio_desc' | 'stock_asc' | 'stock_desc'
  >('nombre_asc');
  const [activeTab, setActiveTab] = useState<'gestion' | 'compras'>('gestion');
  
  // Estado del Formulario de Producto Individual
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Producto>>({
    id: window.crypto.randomUUID(),
    categoria: 'Abarrotes',
    unidadMedida: 'unidad',
    disponible: true,
    destacado: false,
    esPrincipalWeb: false,
    productoPadreId: '',
    etiquetaVariante: '',
    mostrarPrecioWeb: true,
    precio: 0,
    costo: 0,
    stock: 0,
    etiquetas: []
  });
  const [originalForm, setOriginalForm] = useState<Partial<Producto> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | 'info' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── ESTADO DEL GESTOR / MODAL DE FAMILIA WEB ──
  const [modalFamiliaOpen, setModalFamiliaOpen] = useState(false);
  const [familiaForm, setFamiliaForm] = useState<{
    id?: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    imagenLocal?: string;
    imagenUrl?: string;
    disponible: boolean;
    destacado: boolean;
    mostrarPrecioWeb: boolean;
    etiquetas?: string[];
  }>({
    nombre: '',
    descripcion: '',
    categoria: 'Abarrotes',
    disponible: true,
    destacado: false,
    mostrarPrecioWeb: true,
    etiquetas: []
  });
  const [familiaPresentaciones, setFamiliaPresentaciones] = useState<
    Array<{ id: string; nombre: string; etiquetaVariante: string; precio: number; stock: number; unidadMedida?: string }>
  >([]);
  const [busquedaPresentacion, setBusquedaPresentacion] = useState('');
  const [guardandoFamilia, setGuardandoFamilia] = useState(false);
  const familiaFileInputRef = useRef<HTMLInputElement>(null);

  const mostrarMensaje = (texto: string, tipo: 'success' | 'error' | 'info' = 'info', duracion = 5000) => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), duracion);
  };

  const cargarProductos = async () => {
    try {
      const prods = await (window as any).electron.obtenerTodosProductos();
      setProductos(prods || []);
    } catch (e) {
      console.error(e);
      mostrarMensaje('Error al cargar productos. Verifica que la base de datos esté accesible.', 'error');
    }
  };

  useEffect(() => {
    cargarProductos();
    
    // Escuchar cuando la sincronización en segundo plano termine para actualizar las etiquetas de Nube
    const unsubscribeSync = (window as any).electron.onSyncCompleted((count: number) => {
      if (count > 0) {
        cargarProductos();
      }
    });
    
    return () => {
      if (typeof unsubscribeSync === 'function') unsubscribeSync();
    };
  }, []);

  const resetForm = () => {
    setIsEditing(false);
    setForm({
      id: window.crypto.randomUUID(),
      categoria: 'Abarrotes',
      unidadMedida: 'unidad',
      disponible: true,
      destacado: false,
      esPrincipalWeb: false,
      productoPadreId: '',
      etiquetaVariante: '',
      mostrarPrecioWeb: true,
      precio: 0,
      costo: 0,
      stock: 0,
      etiquetas: []
    });
    setOriginalForm(null);
    setMensaje(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const abrirCrearFamilia = () => {
    setFamiliaForm({
      id: window.crypto.randomUUID(),
      nombre: '',
      descripcion: '',
      categoria: 'Abarrotes',
      disponible: true,
      destacado: false,
      mostrarPrecioWeb: true,
      etiquetas: []
    });
    setFamiliaPresentaciones([]);
    setBusquedaPresentacion('');
    setModalFamiliaOpen(true);
  };

  const abrirEditarFamilia = async (fam: Producto) => {
    let presList: any[] = [];
    if (typeof (window as any).electron?.obtenerPresentacionesDeFamilia === 'function') {
      presList = await (window as any).electron.obtenerPresentacionesDeFamilia(fam.id);
    } else {
      presList = productos.filter(p => p.productoPadreId === fam.id);
    }

    setFamiliaForm({
      id: fam.id,
      nombre: fam.nombre || '',
      descripcion: fam.descripcion || '',
      categoria: fam.categoria || 'Abarrotes',
      imagenLocal: fam.imagenLocal,
      imagenUrl: fam.imagenUrl,
      disponible: fam.disponible !== false,
      destacado: Boolean(fam.destacado),
      mostrarPrecioWeb: Boolean(fam.mostrarPrecioWeb),
      etiquetas: Array.isArray(fam.etiquetas) ? fam.etiquetas : []
    });

    setFamiliaPresentaciones(
      (presList || []).map((p: any) => ({
        id: p.id,
        nombre: p.nombre,
        etiquetaVariante: p.etiquetaVariante || p.nombre,
        precio: p.precio || 0,
        stock: p.stock || 0,
        unidadMedida: p.unidadMedida || 'unidad'
      }))
    );

    setBusquedaPresentacion('');
    setModalFamiliaOpen(true);
  };

  const handleEdit = (prod: Producto) => {
    if (prod.esPrincipalWeb) {
      abrirEditarFamilia(prod);
      return;
    }

    setIsEditing(true);
    let parsedEtiquetas: string[] = [];
    if (typeof prod.etiquetas === 'string') {
      try { parsedEtiquetas = JSON.parse(prod.etiquetas); } catch{}
    } else if (Array.isArray(prod.etiquetas)) {
      parsedEtiquetas = prod.etiquetas;
    }
    const editForm = {
      ...prod, 
      etiquetas: parsedEtiquetas,
      esPrincipalWeb: Boolean(prod.esPrincipalWeb),
      productoPadreId: prod.productoPadreId || '',
      etiquetaVariante: prod.etiquetaVariante || '',
      mostrarPrecioWeb: Boolean(prod.mostrarPrecioWeb)
    };
    setForm(editForm);
    setOriginalForm(editForm);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id: string) => {
    if (!(await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar este producto?', 'Eliminar Producto'))) return;

    const res = await (window as any).electron.eliminarProducto(id);
    if (res.success) {
      mostrarMensaje('Producto eliminado exitosamente', 'success');
      cargarProductos();
      if (form.id === id) resetForm();
    } else if (res.error === 'TIENE_VENTAS') {
      // Error diferenciado: tiene ventas asociadas
      if (await useUIStore.getState().showConfirm(`Este producto tiene ${res.ventasCount || ''} venta(s) asociada(s) en el historial. Eliminarlo arruinaría tus reportes contables.\n\n¿Deseas OCULTARLO (desactivarlo) para que ya no aparezca en caja ni en la tienda web?`, 'Ocultar Producto')) {
        const prodToHide = productos.find(p => p.id === id);
        if (prodToHide) {
          const hideRes = await (window as any).electron.actualizarProducto({...prodToHide, disponible: false});
          if (hideRes.success) {
            mostrarMensaje('Producto ocultado (desactivado) exitosamente.', 'success');
            cargarProductos();
            if (form.id === id) resetForm();
          } else {
            mostrarMensaje('Error al ocultar producto: ' + traducirError(hideRes.error), 'error');
          }
        }
      }
    } else {
      // Error genérico de la base de datos
      mostrarMensaje('Error al eliminar: ' + traducirError(res.error), 'error');
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      setIsLoading(true);
      mostrarMensaje('Optimizando y procesando imagen...', 'info');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await (window as any).electron.procesarImagenLocal(arrayBuffer, file.name, 'producto');
        if (res.success) {
          setForm({ ...form, imagenLocal: res.base64, imagenUrl: undefined });
          mostrarMensaje('Imagen optimizada y guardada localmente', 'success');
        } else {
          mostrarMensaje('Error procesando imagen: ' + res.error, 'error');
        }
      } catch (err) {
        mostrarMensaje('Error del sistema al procesar la imagen. Intenta con otra imagen o un formato diferente.', 'error');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleImageFamiliaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setGuardandoFamilia(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await (window as any).electron.procesarImagenLocal(arrayBuffer, file.name, 'producto');
        if (res.success) {
          setFamiliaForm(prev => ({ ...prev, imagenLocal: res.base64, imagenUrl: undefined }));
          mostrarMensaje('Imagen de la familia web guardada localmente', 'success');
        } else {
          mostrarMensaje('Error procesando imagen: ' + res.error, 'error');
        }
      } catch (err) {
        mostrarMensaje('Error al procesar la imagen.', 'error');
      } finally {
        setGuardandoFamilia(false);
      }
    }
  };

  const handleGuardarFamilia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familiaForm.nombre.trim()) {
      mostrarMensaje('El nombre de la familia web es obligatorio', 'error');
      return;
    }

    setGuardandoFamilia(true);
    try {
      const res = await (window as any).electron.guardarFamiliaConPresentaciones(
        familiaForm,
        familiaPresentaciones
      );
      if (res.success) {
        mostrarMensaje('Familia web guardada exitosamente', 'success');
        setModalFamiliaOpen(false);
        await cargarProductos();
      } else {
        mostrarMensaje(traducirError(res.error || 'Error al guardar familia'), 'error');
      }
    } catch (err: any) {
      mostrarMensaje('Error guardando familia: ' + err.message, 'error');
    } finally {
      setGuardandoFamilia(false);
    }
  };

  const agregarPresentacionAFamilia = (prod: Producto) => {
    if (familiaPresentaciones.some(p => p.id === prod.id)) return;
    
    const nombreFamilia = familiaForm.nombre.trim();
    let etiquetaSugerida = prod.nombre;
    if (nombreFamilia) {
      const regex = new RegExp(`^${nombreFamilia}\\s*[-–:]?\\s*`, 'i');
      const limpia = prod.nombre.replace(regex, '').trim();
      if (limpia) etiquetaSugerida = limpia;
    }

    setFamiliaPresentaciones(prev => [
      ...prev,
      {
        id: prod.id,
        nombre: prod.nombre,
        etiquetaVariante: etiquetaSugerida,
        precio: prod.precio || 0,
        stock: prod.stock || 0,
        unidadMedida: prod.unidadMedida || 'unidad'
      }
    ]);
  };

  const removerPresentacionDeFamilia = (id: string) => {
    setFamiliaPresentaciones(prev => prev.filter(p => p.id !== id));
  };

  const actualizarEtiquetaPresentacion = (id: string, nuevaEtiqueta: string) => {
    setFamiliaPresentaciones(prev => prev.map(p => p.id === id ? { ...p, etiquetaVariante: nuevaEtiqueta } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación frontend
    if (!form.nombre || form.nombre.trim() === '') {
      mostrarMensaje('El nombre del producto es obligatorio.', 'error');
      return;
    }
    if (form.precio === undefined || form.precio === null || (typeof form.precio === 'number' && form.precio < 0)) {
      mostrarMensaje('El precio debe ser un número válido mayor o igual a 0.', 'error');
      return;
    }

    if (!(await useUIStore.getState().showConfirm(isEditing ? '¿Estás seguro de que deseas actualizar este producto?' : '¿Estás seguro de que deseas agregar este nuevo producto?', 'Guardar Producto'))) {
      return;
    }
    
    setIsLoading(true);
    try {
      let res;
      if (isEditing) {
        res = await (window as any).electron.actualizarProducto(form);
      } else {
        res = await (window as any).electron.crearProducto(form);
      }
      
      if (res.success) {
        setSuccessSaved(true);
        setTimeout(() => setSuccessSaved(false), 2000);
        mostrarMensaje('Producto guardado correctamente', 'success');
        cargarProductos();
        resetForm();
      } else {
        mostrarMensaje(traducirError(res.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      mostrarMensaje('Error de comunicación con la base de datos. Verifica que el sistema esté funcionando correctamente.', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const categoriasDisponibles = useMemo(() => {
    return ['TODAS', ...Array.from(new Set(productos.map(p => p.categoria).filter(Boolean))).sort()];
  }, [productos]);

  const totalRegistrados = productos.length;
  const totalStockBajo = useMemo(() => productos.filter(p => !p.esPrincipalWeb && (p.stock || 0) < 10 && (p.stock || 0) > 0).length, [productos]);
  const totalSinStock = useMemo(() => productos.filter(p => !p.esPrincipalWeb && (p.stock || 0) <= 0).length, [productos]);
  const valorTotalInventario = useMemo(() => productos.filter(p => !p.esPrincipalWeb).reduce((acc, p) => acc + ((p.precio || 0) * (p.stock || 0)), 0), [productos]);
  const totalFamilias = useMemo(() => productos.filter(p => Boolean(p.esPrincipalWeb)).length, [productos]);

  const filteredProductos = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const list = productos.filter(p => {
      const matchText = !term || (
        (p.nombre || '').toLowerCase().includes(term) || 
        (p.descripcion || '').toLowerCase().includes(term) || 
        (p.codigoBarras || '').toLowerCase().includes(term)
      );
      const matchCat = categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
      const matchStock = 
        stockFiltro === 'TODOS' ? true :
        stockFiltro === 'BAJO' ? (p.stock || 0) < 10 && (p.stock || 0) > 0 :
        stockFiltro === 'SIN_STOCK' ? (p.stock || 0) <= 0 :
        (p.stock || 0) >= 10;
      
      const matchVisibilidad = 
        visibilidadFiltro === 'TODOS' ? true :
        visibilidadFiltro === 'VISIBLE' ? Boolean(p.disponible) :
        !Boolean(p.disponible);
      
      const matchTipo = 
        tipoFiltro === 'TODOS' ? true :
        tipoFiltro === 'VENDIBLES' ? !p.esPrincipalWeb :
        Boolean(p.esPrincipalWeb);
      
      return matchText && matchCat && matchStock && matchVisibilidad && matchTipo;
    });

    list.sort((a, b) => {
      switch (ordenarPor) {
        case 'nombre_asc':
          return (a.nombre || '').localeCompare(b.nombre || '');
        case 'nombre_desc':
          return (b.nombre || '').localeCompare(a.nombre || '');
        case 'categoria_asc':
          return (a.categoria || '').localeCompare(b.categoria || '') || (a.nombre || '').localeCompare(b.nombre || '');
        case 'categoria_desc':
          return (b.categoria || '').localeCompare(a.categoria || '') || (a.nombre || '').localeCompare(b.nombre || '');
        case 'precio_asc':
          return (a.precio || 0) - (b.precio || 0);
        case 'precio_desc':
          return (b.precio || 0) - (a.precio || 0);
        case 'stock_asc':
          return (a.stock || 0) - (b.stock || 0);
        case 'stock_desc':
          return (b.stock || 0) - (a.stock || 0);
        default:
          return (a.nombre || '').localeCompare(b.nombre || '');
      }
    });

    return list;
  }, [productos, busqueda, categoriaFiltro, stockFiltro, visibilidadFiltro, tipoFiltro, ordenarPor]);

  const handleSortColumn = (col: 'nombre' | 'categoria' | 'precio' | 'stock') => {
    if (col === 'nombre') {
      setOrdenarPor(prev => prev === 'nombre_asc' ? 'nombre_desc' : 'nombre_asc');
    } else if (col === 'categoria') {
      setOrdenarPor(prev => prev === 'categoria_asc' ? 'categoria_desc' : 'categoria_asc');
    } else if (col === 'precio') {
      setOrdenarPor(prev => prev === 'precio_asc' ? 'precio_desc' : 'precio_asc');
    } else if (col === 'stock') {
      setOrdenarPor(prev => prev === 'stock_asc' ? 'stock_desc' : 'stock_asc');
    }
  };

  const resetFilters = () => {
    setBusqueda('');
    setCategoriaFiltro('TODAS');
    setStockFiltro('TODOS');
    setVisibilidadFiltro('TODOS');
    setOrdenarPor('nombre_asc');
  };

  const isFilterActive = busqueda !== '' || categoriaFiltro !== 'TODAS' || stockFiltro !== 'TODOS' || visibilidadFiltro !== 'TODOS' || ordenarPor !== 'nombre_asc';

  const isValid = Boolean(
    form.nombre && form.nombre.trim() !== '' && 
    form.precio !== undefined && form.precio !== null && typeof form.precio === 'number' && form.precio >= 0 &&
    form.stock !== undefined && form.stock !== null && typeof form.stock === 'number' && form.stock >= 0
  );

  const isModified = !isEditing || JSON.stringify(form) !== JSON.stringify(originalForm);
  const canSubmit = isValid && isModified && !isLoading && !successSaved;

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 overflow-hidden">
      {/* Header with Tabs & Actions */}
      <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-300 flex-shrink-0 bg-slate-100">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-slate-900 mr-2">Inventario</h1>
          <button 
            onClick={() => setActiveTab('gestion')}
            className={`pb-2 px-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'gestion' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
          >
            Gestión de Productos
          </button>
          <button 
            onClick={() => setActiveTab('compras')}
            className={`pb-2 px-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'compras' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
          >
            Lista de Compras
          </button>
        </div>

        {activeTab === 'gestion' && (
          <button
            type="button"
            onClick={abrirCrearFamilia}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
            title="Crear un ente que agrupa presentaciones con imagen única para la tienda online"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Nueva Familia Web</span>
          </button>
        )}
      </div>

      {activeTab === 'gestion' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Panel Izquierdo: Formulario */}
          <div className={`w-[400px] min-w-[350px] max-w-[450px] flex flex-col border-r border-slate-300 p-5 overflow-y-auto custom-scrollbar-light-light-light flex-shrink-0 transition-colors duration-300 ${isEditing ? 'bg-blue-900/10 border-r-blue-500/30' : 'bg-slate-100/50'}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-bold ${isEditing ? 'text-blue-600' : 'text-emerald-600'}`}>
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          {isEditing && (
            <button onClick={resetForm} className="text-slate-600 hover:text-slate-900 transition">
              <X size={22} />
            </button>
          )}
        </div>

        {mensaje && (
          <div className={`mb-3 p-2.5 rounded-lg border text-xs font-medium flex items-start gap-2 ${
            mensaje.tipo === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
            mensaje.tipo === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-blue-500/10 border-blue-500/20 text-blue-600'
          }`}>
            {mensaje.tipo === 'success' ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> :
             mensaje.tipo === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> :
             <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 flex-1">
          <div className="text-right">
            <span className="text-xs text-rose-600 font-medium">* Campos obligatorios</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre <span className="text-rose-500 font-bold">*</span></label>
            <input required type="text" value={form.nombre || ''} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
            <textarea rows={2} value={form.descripcion || ''} onChange={e => setForm({...form, descripcion: e.target.value})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all custom-scrollbar-light-light-light resize-none" />
          </div>
          
          {/* Grupo 1: Datos de Clasificación */}
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-3 shadow-sm">
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Clasificación</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Código Barras</label>
                <input type="text" value={form.codigoBarras || ''} onChange={e => setForm({...form, codigoBarras: e.target.value})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Categoría <span className="text-rose-500 font-bold">*</span></label>
                <select value={form.categoria || 'Abarrotes'} onChange={e => setForm({...form, categoria: e.target.value})} className="w-full bg-white border border-slate-350 hover:border-slate-400 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer">
                  <option value="Abarrotes">Abarrotes</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Golosinas">Golosinas</option>
                  <option value="Verduras">Verduras</option>
                  <option value="Frutas">Frutas</option>
                  <option value="Aseo y limpieza">Aseo y limpieza</option>
                  <option value="Ferreteria y electricidad">Ferreteria y electricidad</option>
                  <option value="Bazar">Bazar</option>
                  <option value="Medicina">Medicina</option>
                  <option value="Libreria">Libreria</option>
                  <option value="Ocasión y Otros">Ocasión y Otros</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grupo 2: Precios e Inventario */}
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-3 shadow-sm">
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Costos y Stock</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Precio (S/) <span className="text-rose-500 font-bold">*</span></label>
                <input required type="number" step="0.10" value={form.precio === undefined ? '' : form.precio} onChange={e => setForm({...form, precio: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} onBlur={() => typeof form.precio === 'number' && setForm({...form, precio: Math.round(form.precio * 10) / 10})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Costo (S/)</label>
                <input type="number" step="0.10" value={form.costo === undefined ? '' : form.costo} onChange={e => setForm({...form, costo: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} onBlur={() => typeof form.costo === 'number' && setForm({...form, costo: Math.round(form.costo * 10) / 10})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Stock <span className="text-rose-500 font-bold">*</span></label>
                <input required type="number" step="1" value={form.stock === undefined ? '' : form.stock} onChange={e => setForm({...form, stock: e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10)})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Medida <span className="text-rose-500 font-bold">*</span></label>
                <select value={form.unidadMedida || 'unidad'} onChange={e => setForm({...form, unidadMedida: e.target.value})} className="w-full bg-white border border-slate-350 hover:border-slate-400 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer">
                  <option value="unidad">Unidad</option>
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="litro">Litro (L)</option>
                  <option value="servicio">Servicio</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grupo 3: Multimedia y Configuración */}
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-3 shadow-sm">
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Catálogo y Visuales</span>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Imagen del Producto</label>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleImageChange} 
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 transition cursor-pointer" 
              />
              {form.imagenLocal || form.imagenUrl ? (
                <div className="mt-2 flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                    <Check size={12} /> Imagen vinculada
                  </div>
                  <img src={form.imagenLocal || form.imagenUrl || ''} alt="Preview" className="h-14 w-14 object-cover rounded border border-emerald-500/30" />
                  <button type="button" onClick={() => setForm({...form, imagenLocal: undefined, imagenUrl: undefined})} className="text-xs text-rose-600 hover:text-rose-700 font-bold text-left cursor-pointer">
                    Eliminar imagen
                  </button>
                </div>
              ) : null}
            </div>

            {/* Opciones de Inventario y Etiquetas */}

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.disponible ?? true)} onChange={e => setForm({...form, disponible: e.target.checked})} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-slate-700 text-xs font-semibold">Disponible en Tienda Web</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.destacado ?? false)} onChange={e => setForm({...form, destacado: e.target.checked})} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-slate-700 text-xs font-semibold">Producto Destacado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.mostrarPrecioWeb ?? true)} onChange={e => setForm({...form, mostrarPrecioWeb: e.target.checked})} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-slate-700 text-xs font-semibold">Mostrar Precio en la Web</span>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Etiquetas (separadas por coma)</label>
              <input type="text" placeholder="Ej: nuevo, oferta, destacado" value={Array.isArray(form.etiquetas) ? form.etiquetas.join(', ') : (form.etiquetas || '')} onChange={e => setForm({...form, etiquetas: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full bg-white border border-slate-350 shadow-sm rounded-lg p-2 text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
            </div>
          </div>

          <button 
            disabled={!canSubmit} 
            type="submit" 
            className={`w-full font-bold py-3 rounded-lg mt-4 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg text-sm cursor-pointer ${
              successSaved 
                ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
                : !canSubmit 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-250 shadow-none' 
                  : isEditing
                    ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {successSaved ? (
              <>
                <Check size={18} className="animate-bounce" />
                <span>¡Guardado con éxito!</span>
              </>
            ) : isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                <span>Procesando...</span>
              </>
            ) : (
              isEditing ? 'Actualizar Producto' : 'Crear Producto'
            )}
          </button>
        </form>
      </div>

      {/* Panel Derecho: Grilla de Productos */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden bg-slate-50">
        {/* Barra Superior: Métricas y Contadores */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-250 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Total Productos</div>
              <div className="text-lg font-black text-slate-900 leading-tight">
                {totalRegistrados} <span className="text-xs font-normal text-slate-500">items</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-250 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={20} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Valorización Total</div>
              <div className="text-lg font-black text-emerald-600 leading-tight">
                S/ {valorTotalInventario.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-250 shadow-xs flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${totalStockBajo + totalSinStock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Stock Crítico</div>
              <div className={`text-lg font-black leading-tight ${totalStockBajo + totalSinStock > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {totalStockBajo + totalSinStock} <span className="text-xs font-normal text-slate-500">({totalSinStock} agotados)</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-250 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <Layers size={20} />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Mostrando</div>
              <div className="text-lg font-black text-slate-900 leading-tight">
                {filteredProductos.length} <span className="text-xs font-normal text-slate-500">de {totalRegistrados}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Ordenamiento Profesional */}
        <div className="bg-white p-3 rounded-xl border border-slate-250 shadow-xs mb-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Buscador reactivo */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, código o descripción..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:bg-white rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:border-emerald-500 outline-none transition" 
            />
            {busqueda && (
              <button 
                onClick={() => setBusqueda('')} 
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtros Dropdowns y Selects */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Tipo */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Tipo:</span>
              <select
                value={tipoFiltro}
                onChange={e => setTipoFiltro(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Items ({totalRegistrados})</option>
                <option value="VENDIBLES">🛒 Solo Vendibles POS ({totalRegistrados - totalFamilias})</option>
                <option value="FAMILIAS">⭐ Familias Web ({totalFamilias})</option>
              </select>
            </div>

            {/* Filtro Categoría */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Cat:</span>
              <select
                value={categoriaFiltro}
                onChange={e => setCategoriaFiltro(e.target.value)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="TODAS">Todas las Categorías ({totalRegistrados})</option>
                {categoriasDisponibles.filter(c => c !== 'TODAS').map(cat => (
                  <option key={cat} value={cat}>
                    {cat} ({productos.filter(p => p.categoria === cat).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Stock */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Stock:</span>
              <select
                value={stockFiltro}
                onChange={e => setStockFiltro(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Stocks</option>
                <option value="EN_STOCK">Stock Normal (≥10)</option>
                <option value="BAJO">Stock Bajo (&lt;10)</option>
                <option value="SIN_STOCK">Agotados (0)</option>
              </select>
            </div>

            {/* Filtro Visibilidad Web */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Web:</span>
              <select
                value={visibilidadFiltro}
                onChange={e => setVisibilidadFiltro(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="TODOS">Todos (Visibles y Ocultos)</option>
                <option value="VISIBLE">🟢 Visibles en Web ({productos.filter(p => Boolean(p.disponible)).length})</option>
                <option value="OCULTO">⚪ Ocultos ({productos.filter(p => !Boolean(p.disponible)).length})</option>
              </select>
            </div>

            {/* Selector de Ordenamiento */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Ordenar:</span>
              <select
                value={ordenarPor}
                onChange={e => setOrdenarPor(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="nombre_asc">Nombre (A - Z)</option>
                <option value="nombre_desc">Nombre (Z - A)</option>
                <option value="categoria_asc">Categoría (A - Z)</option>
                <option value="stock_asc">Stock: Menor a Mayor</option>
                <option value="stock_desc">Stock: Mayor a Menor</option>
                <option value="precio_asc">Precio: Menor a Mayor</option>
                <option value="precio_desc">Precio: Mayor a Menor</option>
              </select>
            </div>

            {/* Botón Reset */}
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Restablecer todos los filtros"
              >
                <RotateCcw size={12} />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Productos con Cabeceras Clickeables */}
        <div className="flex-1 overflow-auto custom-scrollbar-light-light-light bg-white rounded-xl border border-slate-300 shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-150 sticky top-0 backdrop-blur-md border-b-2 border-slate-300 z-10">
              <tr>
                {/* Columna Producto Clickeable */}
                <th 
                  onClick={() => handleSortColumn('nombre')}
                  className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition select-none"
                  title="Clic para ordenar por Producto"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Producto</span>
                    {ordenarPor === 'nombre_asc' && <ArrowUp size={13} className="text-emerald-600" />}
                    {ordenarPor === 'nombre_desc' && <ArrowDown size={13} className="text-emerald-600" />}
                    {ordenarPor !== 'nombre_asc' && ordenarPor !== 'nombre_desc' && <ArrowUpDown size={12} className="text-slate-400 opacity-60" />}
                  </div>
                </th>

                {/* Columna Categoría Clickeable */}
                <th 
                  onClick={() => handleSortColumn('categoria')}
                  className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition select-none"
                  title="Clic para ordenar por Categoría"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoría</span>
                    {ordenarPor === 'categoria_asc' && <ArrowUp size={13} className="text-emerald-600" />}
                    {ordenarPor === 'categoria_desc' && <ArrowDown size={13} className="text-emerald-600" />}
                    {ordenarPor !== 'categoria_asc' && ordenarPor !== 'categoria_desc' && <ArrowUpDown size={12} className="text-slate-400 opacity-60" />}
                  </div>
                </th>

                {/* Columna Precio Clickeable */}
                <th 
                  onClick={() => handleSortColumn('precio')}
                  className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition select-none"
                  title="Clic para ordenar por Precio"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Precio</span>
                    {ordenarPor === 'precio_asc' && <ArrowUp size={13} className="text-emerald-600" />}
                    {ordenarPor === 'precio_desc' && <ArrowDown size={13} className="text-emerald-600" />}
                    {ordenarPor !== 'precio_asc' && ordenarPor !== 'precio_desc' && <ArrowUpDown size={12} className="text-slate-400 opacity-60" />}
                  </div>
                </th>

                {/* Columna Stock Clickeable */}
                <th 
                  onClick={() => handleSortColumn('stock')}
                  className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition select-none"
                  title="Clic para ordenar por Stock"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Stock</span>
                    {ordenarPor === 'stock_asc' && <ArrowUp size={13} className="text-emerald-600" />}
                    {ordenarPor === 'stock_desc' && <ArrowDown size={13} className="text-emerald-600" />}
                    {ordenarPor !== 'stock_asc' && ordenarPor !== 'stock_desc' && <ArrowUpDown size={12} className="text-slate-400 opacity-60" />}
                  </div>
                </th>

                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Sincronización</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Web</th>
                <th className="py-2.5 px-3 text-right text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.map((prod) => {
                const esFamilia = Boolean(prod.esPrincipalWeb);
                const presentacionesAsignadas = productos.filter(p => p.productoPadreId === prod.id);

                return (
                  <tr 
                    key={prod.id} 
                    className={`border-b border-slate-200 hover:bg-slate-50 transition group ${
                      esFamilia ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'even:bg-white odd:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-white border p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-2xs ${
                          esFamilia ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-250'
                        }`}>
                          {prod.imagenLocal || prod.imagenUrl ? (
                            <img src={prod.imagenLocal || prod.imagenUrl} alt={prod.nombre} className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon size={18} className="text-slate-400 opacity-60" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-850 text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                            <span>{prod.nombre}</span>
                            {esFamilia && (
                              <span className="text-[10px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <Sparkles size={10} /> Familia ({presentacionesAsignadas.length})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {esFamilia ? (
                              <span className="text-amber-800 font-semibold">Ente Agrupador (No vendible en POS)</span>
                            ) : (
                              prod.codigoBarras || 'S/C'
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-semibold border border-slate-200">
                        {prod.categoria}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {esFamilia ? (
                        <span className="text-[11px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                          Catálogo Web
                        </span>
                      ) : (
                        <span className="font-black text-emerald-600 text-sm">
                          S/ {prod.precio.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {esFamilia ? (
                        <span className="text-[11px] text-slate-400 font-semibold italic">
                          Virtual
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                          prod.stock <= 0 
                            ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold'
                            : prod.stock < 10 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          {prod.stock <= 0 && <AlertCircle size={11} />}
                          {prod.stock} {prod.unidadMedida}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-200 flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Local
                        </span>
                        {(prod as any).pendienteSync > 0 ? (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200 animate-pulse flex items-center gap-1 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pendiente
                          </span>
                        ) : (
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-200 flex items-center gap-1 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Nube
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-col gap-0.5 items-start">
                        {esFamilia ? (
                          <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-extrabold border border-amber-300 flex items-center gap-1">
                            <Sparkles size={10} /> Familia Web
                          </span>
                        ) : prod.productoPadreId ? (
                          <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-purple-200">
                            🔗 {prod.etiquetaVariante || 'Presentación'}
                          </span>
                        ) : null}
                        {prod.disponible 
                          ? <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200">Visible</span>
                          : <span className="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-slate-200">Oculto</span>}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(prod)} 
                          className={`p-1.5 rounded-lg transition-colors border flex items-center justify-center cursor-pointer shadow-2xs ${
                            esFamilia 
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300' 
                              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 active:bg-blue-200 border-blue-200'
                          }`}
                          title={esFamilia ? 'Editar Familia y Presentaciones' : 'Editar producto'}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(prod.id)} 
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 active:bg-rose-200 rounded-lg transition-colors border border-rose-200 flex items-center justify-center cursor-pointer shadow-2xs"
                          title="Eliminar producto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProductos.length === 0 && (
            <div className="p-10 text-center text-slate-500 italic text-sm flex flex-col items-center justify-center">
              <Package size={36} className="opacity-25 mb-2 text-slate-400" />
              <span>No se encontraron productos con los filtros seleccionados.</span>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="mt-3 text-xs text-emerald-600 font-bold hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white">
          <ListaCompras productos={productos} />
        </div>
      )}

      {/* ── MODAL GESTOR DE FAMILIA WEB ── */}
      {modalFamiliaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {familiaForm.id && productos.some(p => p.id === familiaForm.id) ? 'Editar Familia Web' : 'Nueva Familia Web (Ente Agrupador)'}
                  </h2>
                  <p className="text-xs text-amber-100 font-medium">
                    Agrupa múltiples presentaciones bajo una sola imagen representativa para la tienda online. (No vendible en caja).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalFamiliaOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columnas */}
            <form onSubmit={handleGuardarFamilia} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto custom-scrollbar-light-light-light">
                
                {/* Columna Izquierda: Datos y Foto Representativa (5 cols) */}
                <div className="md:col-span-5 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <span className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Datos de la Familia Web
                    </span>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nombre de la Línea / Familia <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Ej: Inca Kola Sabor Original, Arroz Extra Costeño"
                        value={familiaForm.nombre}
                        onChange={e => setFamiliaForm({ ...familiaForm, nombre: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 font-semibold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                      <select
                        value={familiaForm.categoria}
                        onChange={e => setFamiliaForm({ ...familiaForm, categoria: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 font-medium focus:border-amber-500 outline-none cursor-pointer"
                      >
                        <option value="Abarrotes">Abarrotes</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Golosinas">Golosinas</option>
                        <option value="Verduras">Verduras</option>
                        <option value="Frutas">Frutas</option>
                        <option value="Aseo y limpieza">Aseo y limpieza</option>
                        <option value="Ferreteria y electricidad">Ferreteria y electricidad</option>
                        <option value="Bazar">Bazar</option>
                        <option value="Medicina">Medicina</option>
                        <option value="Libreria">Libreria</option>
                        <option value="Ocasión y Otros">Ocasión y Otros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Descripción (para la Web e IA Semántica)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe el producto general y sus usos (ej: Gaseosa dorada tradicional para acompañar almuerzos familiares)..."
                        value={familiaForm.descripcion}
                        onChange={e => setFamiliaForm({ ...familiaForm, descripcion: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:border-amber-500 outline-none resize-none"
                      />
                    </div>
                  </div>

                  {/* Imagen Representativa Única */}
                  <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
                    <span className="block text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-amber-600" />
                      Imagen Representativa Web
                    </span>
                    <p className="text-[11px] text-amber-800 leading-tight">
                      Esta es la foto principal que se mostrará en el catálogo web para representar a todas las presentaciones de esta familia.
                    </p>

                    <input
                      type="file"
                      accept="image/*"
                      ref={familiaFileInputRef}
                      onChange={handleImageFamiliaChange}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs text-slate-700 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
                    />

                    {familiaForm.imagenLocal || familiaForm.imagenUrl ? (
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-amber-200">
                        <img
                          src={familiaForm.imagenLocal || familiaForm.imagenUrl || ''}
                          alt="Preview Familia"
                          className="w-16 h-16 object-cover rounded-lg border border-amber-300"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Imagen configurada
                          </span>
                          <button
                            type="button"
                            onClick={() => setFamiliaForm({ ...familiaForm, imagenLocal: undefined, imagenUrl: undefined })}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold mt-1 cursor-pointer block"
                          >
                            Eliminar imagen
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Opciones Web */}
                    <div className="pt-2 border-t border-amber-200/80 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={familiaForm.mostrarPrecioWeb}
                          onChange={e => setFamiliaForm({ ...familiaForm, mostrarPrecioWeb: e.target.checked })}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Mostrar precios de las presentaciones en la web
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={familiaForm.destacado}
                          onChange={e => setFamiliaForm({ ...familiaForm, destacado: e.target.checked })}
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          Destacar en la página de inicio
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Selector y Gestor de Presentaciones (7 cols) */}
                <div className="md:col-span-7 flex flex-col space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                          Presentaciones del Producto ({familiaPresentaciones.length})
                        </span>
                        <span className="text-xs text-slate-500">
                          Selecciona los productos del POS que son variantes de esta familia y define su etiqueta visible en la web.
                        </span>
                      </div>
                    </div>

                    {/* Buscador de productos del inventario para añadir */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Buscar producto existente para añadir (ej: 500ml, 1.5L, 3L, 1kg)..."
                        value={busquedaPresentacion}
                        onChange={e => setBusquedaPresentacion(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-amber-500 outline-none"
                      />
                    </div>

                    {/* Resultados de sugerencias para añadir */}
                    {busquedaPresentacion.trim() && (
                      <div className="mb-3 max-h-36 overflow-y-auto bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 shadow-xs">
                        {productos
                          .filter(p => 
                            !p.esPrincipalWeb &&
                            p.id !== familiaForm.id &&
                            !familiaPresentaciones.some(fp => fp.id === p.id) &&
                            (p.nombre.toLowerCase().includes(busquedaPresentacion.toLowerCase()) || (p.codigoBarras && p.codigoBarras.includes(busquedaPresentacion)))
                          )
                          .slice(0, 5)
                          .map(p => (
                            <div key={p.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                              <div>
                                <div className="font-bold text-slate-800">{p.nombre}</div>
                                <div className="text-[11px] text-slate-500">S/ {p.precio.toFixed(2)} • Stk: {p.stock} {p.unidadMedida}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => agregarPresentacionAFamilia(p)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-md text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Añadir
                              </button>
                            </div>
                          ))}
                        {productos.filter(p => !p.esPrincipalWeb && !familiaPresentaciones.some(fp => fp.id === p.id) && p.nombre.toLowerCase().includes(busquedaPresentacion.toLowerCase())).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400 italic">No se encontraron productos disponibles</div>
                        )}
                      </div>
                    )}

                    {/* Lista de Presentaciones Asignadas */}
                    <div className="flex-1 max-h-80 overflow-y-auto space-y-2.5 pr-1">
                      {familiaPresentaciones.length > 0 ? (
                        familiaPresentaciones.map((pres, idx) => (
                          <div key={pres.id} className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {idx + 1}. {pres.nombre}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-semibold text-emerald-600">S/ {pres.precio.toFixed(2)}</span>
                                <span>•</span>
                                <span>Stk: {pres.stock} {pres.unidadMedida}</span>
                              </div>
                            </div>

                            {/* Input Etiqueta Web */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="flex-1 sm:w-44">
                                <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Etiqueta en Web
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ej: 500ml, 1.5L, 3L"
                                  value={pres.etiquetaVariante}
                                  onChange={e => actualizarEtiquetaPresentacion(pres.id, e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-md px-2 py-1 text-xs text-slate-900 font-semibold focus:border-amber-500 outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removerPresentacionDeFamilia(pres.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mt-3"
                                title="Quitar de la familia"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <Layers className="w-8 h-8 opacity-40 mb-2 text-amber-500" />
                          <p className="text-xs font-semibold text-slate-600">Aún no has añadido presentaciones</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Usa el buscador arriba para agregar las variantes (ej. 500ml, 1L, 3L) que pertenecen a esta familia.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-slate-500 font-medium">
                  {familiaPresentaciones.length} presentación{familiaPresentaciones.length !== 1 ? 'es' : ''} asignada{familiaPresentaciones.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalFamiliaOpen(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoFamilia || !familiaForm.nombre.trim()}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {guardandoFamilia ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Guardar Familia Web</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
