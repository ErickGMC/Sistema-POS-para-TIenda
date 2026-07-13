import React, { useState, useEffect, useRef } from 'react';
import type { Producto } from '../../store/usePosStore';
import { Edit2, Trash2, Image as ImageIcon, Check, X, Search, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'gestion' | 'compras'>('gestion');
  
  // Estado del Formulario
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Producto>>({
    id: window.crypto.randomUUID(),
    categoria: 'Abarrotes',
    unidadMedida: 'unidad',
    disponible: true,
    destacado: false,
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
      precio: 0,
      costo: 0,
      stock: 0,
      etiquetas: []
    });
    setOriginalForm(null);
    setMensaje(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (prod: Producto) => {
    setIsEditing(true);
    let parsedEtiquetas: string[] = [];
    if (typeof prod.etiquetas === 'string') {
      try { parsedEtiquetas = JSON.parse(prod.etiquetas); } catch{}
    } else if (Array.isArray(prod.etiquetas)) {
      parsedEtiquetas = prod.etiquetas;
    }
    const editForm = {...prod, etiquetas: parsedEtiquetas};
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

  const filteredProductos = productos.filter(p => 
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.codigoBarras?.includes(busqueda)
  );

  const isValid = Boolean(
    form.nombre && form.nombre.trim() !== '' && 
    form.precio !== undefined && form.precio !== null && typeof form.precio === 'number' && form.precio >= 0 &&
    form.stock !== undefined && form.stock !== null && typeof form.stock === 'number' && form.stock >= 0
  );

  const isModified = !isEditing || JSON.stringify(form) !== JSON.stringify(originalForm);
  const canSubmit = isValid && isModified && !isLoading && !successSaved;

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 overflow-hidden">
      {/* Header with Tabs */}
      <div className="px-5 py-3 flex items-center gap-6 border-b border-slate-300 flex-shrink-0 bg-slate-100">
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

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.disponible ?? true)} onChange={e => setForm({...form, disponible: e.target.checked})} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-slate-700 text-xs font-semibold">Disponible en Tienda Web</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.destacado ?? false)} onChange={e => setForm({...form, destacado: e.target.checked})} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-slate-700 text-xs font-semibold">Producto Destacado</span>
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
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <div className="flex justify-end items-center mb-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 text-slate-600" size={18} />
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full bg-white border border-slate-350 hover:border-slate-400 shadow-sm rounded-full pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-emerald-500 outline-none transition" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar-light-light-light bg-slate-100 rounded-xl border border-slate-300">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-200 sticky top-0 backdrop-blur-md border-b-2 border-slate-350 z-10">
              <tr>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Producto</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Categoría</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Precio</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Stock</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Sincronización</th>
                <th className="py-2.5 px-3 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Web</th>
                <th className="py-2.5 px-3 text-right text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.map((prod) => (
                <tr key={prod.id} className="border-b border-slate-300 hover:bg-slate-100 transition group even:bg-white odd:bg-slate-50/70">
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-2.5">
                      {prod.imagenLocal || prod.imagenUrl ? (
                        <img src={prod.imagenLocal || prod.imagenUrl} alt={prod.nombre} className="w-8 h-8 rounded object-cover bg-white border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-200"><ImageIcon size={16}/></div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-800 text-sm leading-tight">{prod.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{prod.codigoBarras || 'S/C'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-slate-600 text-sm font-medium">{prod.categoria}</td>
                  <td className="py-1.5 px-3 font-semibold text-emerald-600 text-sm">S/ {prod.precio.toFixed(2)}</td>
                  <td className="py-1.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      prod.stock < 10 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      {prod.stock} {prod.unidadMedida}
                    </span>
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-bold border border-emerald-200 flex items-center gap-1 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Local
                      </span>
                      {(prod as any).pendienteSync > 0 ? (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] font-bold border border-amber-200 animate-pulse flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pendiente
                        </span>
                      ) : (
                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px] font-bold border border-blue-200 flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Nube
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-3">
                    {prod.disponible 
                      ? <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold border border-emerald-200">Visible</span>
                      : <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full text-xs font-semibold border border-slate-200">Oculto</span>}
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(prod)} 
                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 active:bg-blue-200 rounded-lg transition-colors border border-blue-200 flex items-center justify-center cursor-pointer shadow-sm"
                        title="Editar producto"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(prod.id)} 
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 active:bg-rose-200 rounded-lg transition-colors border border-rose-200 flex items-center justify-center cursor-pointer shadow-sm"
                        title="Eliminar producto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProductos.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic text-sm">No se encontraron productos.</div>
          )}
        </div>
      </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white">
          <ListaCompras productos={productos} />
        </div>
      )}
    </div>
  );
}
