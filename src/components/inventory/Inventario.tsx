import React, { useState, useEffect, useRef } from 'react';
import type { Producto } from '../../store/usePosStore';
import { Edit2, Trash2, Image as ImageIcon, Check, X, Search } from 'lucide-react';
import ListaCompras from './ListaCompras';

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
  const [isLoading, setIsLoading] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);
  const [mensaje, setMensaje] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargarProductos = async () => {
    try {
      const prods = await (window as any).electron.obtenerTodosProductos();
      setProductos(prods || []);
    } catch (e) {
      console.error(e);
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
    setMensaje('');
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
    setForm({...prod, etiquetas: parsedEtiquetas});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      const res = await (window as any).electron.eliminarProducto(id);
      if (res.success) {
        setMensaje('Producto eliminado exitosamente');
        cargarProductos();
      } else {
        if (confirm('No se puede eliminar de la base de datos porque este producto ya tiene un historial de ventas asociado (eliminarlo arruinaría tus reportes contables).\n\n¿Deseas OCULTARLO (desactivarlo) automáticamente para que ya no aparezca en caja ni en la tienda web?')) {
          const prodToHide = productos.find(p => p.id === id);
          if (prodToHide) {
            const hideRes = await (window as any).electron.actualizarProducto({...prodToHide, disponible: false});
            if (hideRes.success) {
              setMensaje('Producto ocultado (desactivado) exitosamente.');
              cargarProductos();
            } else {
              setMensaje('Error al ocultar producto: ' + hideRes.error);
            }
          }
        }
      }
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      setIsLoading(true);
      setMensaje('Optimizando y subiendo imagen...');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await (window as any).electron.procesarImagenLocal(arrayBuffer, file.name, 'producto');
        if (res.success) {
          setForm({ ...form, imagenLocal: res.base64, imagenUrl: undefined });
          setMensaje('Imagen optimizada y guardada localmente');
        } else {
          setMensaje('Error subiendo imagen: ' + res.error);
        }
      } catch (err) {
        setMensaje('Error del sistema al subir imagen');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(isEditing ? '¿Estás seguro de que deseas actualizar este producto?' : '¿Estás seguro de que deseas agregar este nuevo producto?')) {
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
        setMensaje('Producto guardado correctamente');
        cargarProductos();
        resetForm();
      } else {
        setMensaje('Error al guardar: ' + res.error);
      }
    } catch (err) {
      setMensaje('Error del sistema al guardar');
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

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Header with Tabs */}
      <div className="p-6 pb-0 flex gap-6 border-b border-slate-700 flex-shrink-0 bg-slate-800">
        <h1 className="text-3xl font-black text-white mr-4">Inventario</h1>
        <button 
          onClick={() => setActiveTab('gestion')}
          className={`pb-4 px-4 font-semibold transition-colors border-b-2 ${activeTab === 'gestion' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Gestión de Productos
        </button>
        <button 
          onClick={() => setActiveTab('compras')}
          className={`pb-4 px-4 font-semibold transition-colors border-b-2 ${activeTab === 'compras' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Lista de Compras
        </button>
      </div>

      {activeTab === 'gestion' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Panel Izquierdo: Formulario */}
          <div className="w-[450px] flex flex-col border-r border-slate-700 bg-slate-800/50 p-6 overflow-y-auto custom-scrollbar flex-shrink-0">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-emerald-400">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          {isEditing && (
            <button onClick={resetForm} className="text-slate-400 hover:text-white transition">
              <X size={24} />
            </button>
          )}
        </div>

        {mensaje && (
          <div className="mb-4 p-3 bg-slate-800 rounded border border-slate-600 text-amber-400 text-sm">
            {mensaje}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div className="text-right">
            <span className="text-xs text-rose-400 font-medium">* Campos obligatorios</span>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre <span className="text-rose-500 font-bold">*</span></label>
            <input required type="text" value={form.nombre || ''} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none" />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">Descripción</label>
            <textarea rows={2} value={form.descripcion || ''} onChange={e => setForm({...form, descripcion: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none custom-scrollbar" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Código Barras</label>
              <input type="text" value={form.codigoBarras || ''} onChange={e => setForm({...form, codigoBarras: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Categoría <span className="text-rose-500 font-bold">*</span></label>
              <select value={form.categoria || 'Abarrotes'} onChange={e => setForm({...form, categoria: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Precio (S/) <span className="text-rose-500 font-bold">*</span></label>
              <input required type="number" step="0.10" value={form.precio === undefined ? '' : form.precio} onChange={e => setForm({...form, precio: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} onBlur={() => typeof form.precio === 'number' && setForm({...form, precio: Math.round(form.precio * 10) / 10})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Costo (S/)</label>
              <input type="number" step="0.10" value={form.costo === undefined ? '' : form.costo} onChange={e => setForm({...form, costo: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} onBlur={() => typeof form.costo === 'number' && setForm({...form, costo: Math.round(form.costo * 10) / 10})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Stock <span className="text-rose-500 font-bold">*</span></label>
              <input required type="number" step="1" value={form.stock === undefined ? '' : form.stock} onChange={e => setForm({...form, stock: e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Medida <span className="text-rose-500 font-bold">*</span></label>
              <select value={form.unidadMedida || 'unidad'} onChange={e => setForm({...form, unidadMedida: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none">
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="litro">Litro (L)</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Imagen (Se optimizará a WEBP)</label>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleImageChange} 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-slate-900 hover:file:bg-emerald-400 transition" 
            />
            {form.imagenLocal || form.imagenUrl ? (
              <div className="mt-2 flex flex-col gap-2">
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check size={12} /> Imagen vinculada
                </div>
                <img src={form.imagenLocal || form.imagenUrl || ''} alt="Preview" className="h-16 w-16 object-cover rounded border border-emerald-500/30" />
                <button type="button" onClick={() => setForm({...form, imagenLocal: undefined, imagenUrl: undefined})} className="text-xs text-rose-500 hover:text-rose-400 font-semibold text-left">
                  Eliminar imagen
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 py-4 border-y border-slate-700 my-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.disponible ?? true)} onChange={e => setForm({...form, disponible: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
              <span className="text-slate-300">Disponible (Mostrar en Catálogo Web)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.destacado ?? false)} onChange={e => setForm({...form, destacado: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
              <span className="text-slate-300">Producto Destacado</span>
            </label>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Etiquetas (separadas por coma)</label>
              <input type="text" placeholder="Ej: nuevo, oferta, destacado" value={Array.isArray(form.etiquetas) ? form.etiquetas.join(', ') : (form.etiquetas || '')} onChange={e => setForm({...form, etiquetas: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-emerald-500 outline-none" />
            </div>
          </div>

          <button 
            disabled={isLoading || successSaved} 
            type="submit" 
            className={`w-full font-bold py-4 rounded-lg mt-6 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
              successSaved 
                ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
                : isLoading 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {successSaved ? (
              <>
                <Check size={20} className="animate-bounce" />
                <span>¡Guardado con éxito!</span>
              </>
            ) : isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                <span>Procesando...</span>
              </>
            ) : (
              isEditing ? 'Actualizar Producto' : 'Crear Producto'
            )}
          </button>
        </form>
      </div>

      {/* Panel Derecho: Grilla de Productos */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex justify-end items-center mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-full pl-10 pr-4 py-2 text-white focus:border-emerald-500 outline-none transition" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-800 rounded-xl border border-slate-700">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/50 sticky top-0 backdrop-blur-md">
              <tr>
                <th className="p-4 text-slate-400 font-medium">Producto</th>
                <th className="p-4 text-slate-400 font-medium">Categoría</th>
                <th className="p-4 text-slate-400 font-medium">Precio</th>
                <th className="p-4 text-slate-400 font-medium">Stock</th>
                <th className="p-4 text-slate-400 font-medium">Sincronización</th>
                <th className="p-4 text-slate-400 font-medium">Web</th>
                <th className="p-4 text-right text-slate-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.map((prod) => (
                <tr key={prod.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {prod.imagenLocal || prod.imagenUrl ? (
                        <img src={prod.imagenUrl} alt={prod.nombre} className="w-10 h-10 rounded object-cover bg-slate-900" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-slate-500"><ImageIcon size={20}/></div>
                      )}
                      <div>
                        <div className="font-semibold">{prod.nombre}</div>
                        <div className="text-xs text-slate-400">{prod.codigoBarras || 'S/C'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">{prod.categoria}</td>
                  <td className="p-4 font-semibold text-emerald-400">S/ {prod.precio.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${prod.stock < 10 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                      {prod.stock} {prod.unidadMedida}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px] w-fit font-semibold border border-emerald-400/20">
                        ✓ Local
                      </span>
                      {(prod as any).pendienteSync > 0 ? (
                        <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-[10px] w-fit font-semibold border border-amber-400/20 animate-pulse">
                          ☁ Pendiente
                        </span>
                      ) : (
                        <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-[10px] w-fit font-semibold border border-blue-400/20">
                          ☁ Nube (Sinc)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {prod.disponible 
                      ? <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs">Visible</span>
                      : <span className="text-slate-500 bg-slate-800 px-2 py-1 rounded text-xs">Oculto</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleEdit(prod)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition mr-2">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(prod.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProductos.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic">No se encontraron productos.</div>
          )}
        </div>
      </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-slate-900">
          <ListaCompras productos={productos} />
        </div>
      )}
    </div>
  );
}
