import React, { useState, useEffect } from 'react';
import type { Usuario } from '../../store/useAuthStore';
import { Users, Plus, Shield, User, Trash2, Edit2, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

const PERMISOS_DISPONIBLES = [
  { id: 'ventas:cobrar', label: 'Cobrar en caja' },
  { id: 'ventas:historial', label: 'Ver historial de ventas' },
  { id: 'ventas:anular', label: 'Anular ventas' },
  { id: 'inventario:modificar', label: 'Modificar productos / stock' },
  { id: 'usuarios:gestionar', label: 'Gestionar colaboradores' },
  { id: 'web:configurar', label: 'Configurar tienda web' }
];

export default function GestionUsuarios() {

  // Traduce errores crudos del backend a mensajes amigables
  const traducirError = (error: string): string => {
    if (!error) return 'Error desconocido';
    if (error.includes('auth/email-already-in-use') || error.includes('UNIQUE constraint failed: usuarios.username')) {
      return 'Este nombre de usuario ya está registrado en el sistema. Elige otro.';
    }
    if (error.includes('auth/weak-password')) {
      return 'La contraseña es demasiado débil. Usa al menos 6 caracteres.';
    }
    if (error.includes('auth/invalid-email')) {
      return 'El formato del nombre de usuario no es válido.';
    }
    if (error.includes('Datos inválidos')) {
      return 'Algunos datos del formulario no son válidos. El nombre debe tener al menos 3 caracteres y la contraseña al menos 6.';
    }
    if (error.includes('auth/network-request-failed') || error.includes('network') || error.includes('fetch')) {
      return 'Error de conexión con el servidor. Verifica tu internet e intenta nuevamente.';
    }
    if (error.includes('NOT NULL') || error.includes('FOREIGN KEY')) {
      return 'Error interno de la base de datos. Contacta al administrador del sistema.';
    }
    return error;
  };
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);
  
  const [form, setForm] = useState({
    id: '',
    username: '',
    password: '',
    role: 'colaborador' as 'admin' | 'colaborador',
    permisos: [] as string[],
    activo: true
  });
  const [editMode, setEditMode] = useState(false);
  const [originalForm, setOriginalForm] = useState<any>(null);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [verContra, setVerContra] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const data = await (window as any).electron.obtenerUsuarios();
      setUsuarios(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permId: string, checked: boolean) => {
    if (checked) {
      setForm(prev => ({ ...prev, permisos: [...prev.permisos, permId] }));
    } else {
      setForm(prev => ({ ...prev, permisos: prev.permisos.filter(p => p !== permId) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(editMode ? '¿Estás seguro de que deseas actualizar este usuario?' : '¿Estás seguro de que deseas agregar este nuevo usuario?')) {
      return;
    }
    
    setMensaje({ tipo: '', texto: '' });
    setSubmitting(true);
    
    try {
      let isSuccess = false;
      
      const payloadUser = {
        id: editMode ? form.id : window.crypto.randomUUID(),
        username: form.username,
        role: form.role,
        permisos: form.role === 'admin' ? PERMISOS_DISPONIBLES.map(p => p.id) : form.permisos,
        activo: form.activo
      };

      if (editMode) {
        const res = await (window as any).electron.actualizarUsuario(payloadUser, form.password);
        if (res.success) {
          setMensaje({ tipo: 'success', texto: 'Usuario actualizado correctamente' });
          isSuccess = true;
        } else {
          setMensaje({ tipo: 'error', texto: traducirError(res.error) });
        }
      } else {
        const res = await (window as any).electron.crearUsuario(payloadUser, form.password);
        if (res.success) {
          setMensaje({ tipo: 'success', texto: 'Usuario creado correctamente' });
          isSuccess = true;
        } else {
          setMensaje({ tipo: 'error', texto: traducirError(res.error) });
        }
      }
      
      if (isSuccess) {
        setSuccessSaved(true);
        setTimeout(() => setSuccessSaved(false), 2000);
        resetForm();
        cargarUsuarios();
      }
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: traducirError(err.message || 'Error inesperado') });
    } finally {
      setSubmitting(false);
    }
  };

  const eliminarUsuario = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar a este usuario?')) return;
    
    const res = await (window as any).electron.eliminarUsuario(id);
    if (res.success) {
      cargarUsuarios();
    } else {
      setMensaje({ tipo: 'error', texto: traducirError(res.error) });
    }
  };

  const editUser = (u: Usuario) => {
    setEditMode(true);
    const newForm = {
      id: u.id,
      username: u.username,
      password: '',
      role: u.role,
      permisos: u.permisos || [],
      activo: u.activo !== false
    };
    setForm(newForm);
    setOriginalForm(newForm);
    setMensaje({ tipo: '', texto: '' });
  };

  const resetForm = () => {
    setEditMode(false);
    setForm({ 
      id: '', 
      username: '', 
      password: '', 
      role: 'colaborador', 
      permisos: [], 
      activo: true 
    });
    setOriginalForm(null);
  };

  const isModified = !editMode || JSON.stringify(form) !== JSON.stringify(originalForm);
  const isValid = form.username.length >= 3 && (!editMode ? form.password.length >= 6 : true);
  const canSubmit = isModified && isValid && !submitting && !successSaved;

  return (
    <div className="h-full w-full bg-slate-950 p-4 flex gap-4 overflow-hidden">
      
      {/* Lista de Usuarios */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Colaboradores</h2>
            <p className="text-slate-400 text-xs">Gestiona accesos, roles y permisos de tu equipo</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <p className="text-slate-500">Cargando usuarios...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {usuarios.map(u => (
                <div key={u.id} className={`bg-slate-800/50 border rounded-2xl p-4 flex flex-col justify-between hover:border-slate-600 transition-colors ${
                  u.activo === false ? 'opacity-50 border-slate-900' : 'border-slate-700/50'
                }`}>
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${
                          u.activo === false 
                            ? 'bg-slate-700 text-slate-500' 
                            : u.role === 'admin' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {u.role === 'admin' ? <Shield size={20} /> : <User size={20} />}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            {u.username}
                          </h3>
                          
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              u.activo === false
                                ? 'bg-slate-800 text-slate-500 border border-slate-700'
                                : u.role === 'admin' 
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {u.role.toUpperCase()}
                            </span>

                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              u.activo === false 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 font-bold' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold'
                            }`}>
                              {u.activo === false ? 'DESACTIVADO' : 'ACTIVO'}
                            </span>
                            
                            <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full border border-slate-800">
                              {(u as any).pendienteSync > 0 ? '☁ Pendiente' : '☁ Nube (Sinc)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mapear permisos en badges pequeños */}
                    <div className="mb-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Permisos asignados:</p>
                      {u.role === 'admin' ? (
                        <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-md font-medium">
                          Acceso Total de Administrador
                        </span>
                      ) : u.permisos && u.permisos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.permisos.map(p => {
                            const label = PERMISOS_DISPONIBLES.find(d => d.id === p)?.label || p;
                            return (
                              <span key={p} className="text-[9px] text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded" title={label}>
                                {p.split(':')[1]}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">Sin permisos adicionales asignados</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50 mt-2">
                    <button onClick={() => editUser(u)} className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg py-2 flex items-center justify-center gap-2 text-sm transition-colors border border-slate-700">
                      <Edit2 size={14} /> Editar
                    </button>
                    <button onClick={() => eliminarUsuario(u.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg p-2 transition-colors border border-red-500/20" title="Eliminar definitivamente">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formulario de Colaborador */}
      <div className="w-[400px] min-w-[350px] max-w-[450px] bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar">
        <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-3">
          {editMode ? 'Editar Colaborador' : 'Nuevo Colaborador'}
        </h3>

        {mensaje.texto && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            mensaje.tipo === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            <AlertCircle size={16} />
            <span>{mensaje.texto}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Nombre de Usuario *</label>
            <input 
              required 
              type="text" 
              value={form.username} 
              onChange={e => setForm({...form, username: e.target.value})} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none transition-colors" 
              placeholder="ej: cajero1"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">
              Contraseña {!editMode && '*'} {editMode && <span className="text-xs text-slate-500">(En blanco para mantener)</span>}
            </label>
            <div className="relative">
              <input 
                required={!editMode}
                minLength={6}
                type={verContra ? 'text' : 'password'} 
                value={form.password} 
                onChange={e => setForm({...form, password: e.target.value})} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pr-10 text-sm text-white focus:border-blue-500 outline-none transition-colors" 
                placeholder="••••••••"
              />
              <button 
                type="button" 
                onClick={() => setVerContra(!verContra)} 
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-350"
              >
                {verContra ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1 ml-1">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Nivel de Acceso (Rol) *</label>
            <select 
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value as 'admin'|'colaborador'})} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
            >
              <option value="colaborador">Colaborador (Permisos personalizados)</option>
              <option value="admin">Administrador (Control Total)</option>
            </select>
          </div>

          {/* Toggle Activo/Inactivo */}
          <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl my-1">
            <div>
              <span className="text-slate-300 text-sm font-medium block">Estado del Usuario</span>
              <span className="text-[10px] text-slate-500">{form.activo ? 'Permitido iniciar sesión' : 'Acceso bloqueado'}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.activo} 
                onChange={e => setForm({...form, activo: e.target.checked})} 
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
            </label>
          </div>

          {/* Listado de checkboxes de Permisos (Solo si rol === colaborador) */}
          {form.role === 'colaborador' && (
            <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 mt-2">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Permisos de Acceso</span>
              
              <div className="space-y-3">
                {PERMISOS_DISPONIBLES.map(p => {
                  const hasPerm = form.permisos.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-3 cursor-pointer select-none text-slate-300 hover:text-white transition">
                      <input 
                        type="checkbox" 
                        checked={hasPerm} 
                        onChange={e => handlePermissionChange(p.id, e.target.checked)} 
                        className="w-4.5 h-4.5 accent-blue-500 rounded border-slate-700 bg-slate-900"
                      />
                      <span className="text-sm font-medium">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto pt-6 flex flex-col gap-3">
            <button 
              disabled={!canSubmit}
              type="submit" 
              className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                successSaved 
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : !canSubmit 
                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed shadow-none border border-slate-700'
                    : 'bg-blue-500 hover:bg-blue-400 text-slate-950 shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {successSaved ? (
                <>
                  <Check size={20} className="animate-bounce" />
                  <span>¡Usuario guardado!</span>
                </>
              ) : submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  {editMode ? <Check size={20} /> : <Plus size={20} />}
                  <span>{editMode ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                </>
              )}
            </button>
            {editMode && (
              <button type="button" onClick={resetForm} className="w-full bg-slate-800 hover:bg-slate-750 text-white font-medium py-3 rounded-xl transition-all border border-slate-700">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}
