import React, { useState, useEffect, useRef } from 'react';
import { Globe, Save, Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, Image as ImageIcon, Sparkles, Bot, Zap, Cpu } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  imagenLocal?: string | null;
  badgeText?: string;
  ctaText?: string;
  ctaActionCategory?: string;
  active: boolean;
  priority: number;
  pendienteSync?: number;
}

interface WebConfig {
  whatsapp?: string;
  ubicacion?: string;
  mostrarPrecios?: boolean;
  nombreTienda?: string;
  descripcionTienda?: string;
  mapaIframe?: string;
  horarioAtencion?: string;
  emailContacto?: string;
}

export interface EmpresaConfig {
  ruc?: string;
  razonSocial?: string;
  nombreComercial?: string;
  direccionFiscal?: string;
  telefono?: string;
  leyenda?: string;
}

export interface Anuncio {
  id: string;
  nombre: string;
  descripcion: string;
  telefono: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
}

export interface ComunidadConfig {
  avisoGlobal?: string;
  telefonos?: { id: string; nombre: string; numero: string }[];
  anuncios?: Anuncio[];
  avisos?: Aviso[];
}

export default function WebAdmin() {
  const [activeTab, setActiveTab] = useState<'general' | 'banners' | 'empresa' | 'comunidad' | 'ia'>('general');
  const [iaBusquedaHabilitada, setIaBusquedaHabilitada] = useState<boolean>(false);
  const [iaComboHabilitado, setIaComboHabilitado] = useState<boolean>(false);
  const [config, setConfig] = useState<WebConfig>({
    whatsapp: '',
    ubicacion: '',
    mostrarPrecios: false,
    nombreTienda: '',
    descripcionTienda: '',
    mapaIframe: '',
    horarioAtencion: '',
    emailContacto: ''
  });
  const [empresa, setEmpresa] = useState<EmpresaConfig>({
    ruc: '',
    razonSocial: '',
    nombreComercial: '',
    direccionFiscal: '',
    telefono: '',
    leyenda: 'Representación impresa de la Boleta de Venta Electrónica'
  });
  const [comunidad, setComunidad] = useState<ComunidadConfig>({
    avisoGlobal: '',
    telefonos: [],
    anuncios: [],
    avisos: []
  });
  
  const [originalConfig, setOriginalConfig] = useState<WebConfig | null>(null);
  const [originalEmpresa, setOriginalEmpresa] = useState<EmpresaConfig | null>(null);
  const [originalComunidad, setOriginalComunidad] = useState<ComunidadConfig | null>(null);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [, setAnalyticsData] = useState<any[]>([]);
  
  // Estado del formulario de Banner
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerForm, setBannerForm] = useState<Partial<Banner>>({
    id: '',
    title: '',
    subtitle: '',
    imageUrl: null,
    imagenLocal: null,
    badgeText: '',
    ctaText: 'Ver más',
    ctaActionCategory: 'Todas',
    active: true,
    priority: 0
  });
  const [originalBannerForm, setOriginalBannerForm] = useState<Partial<Banner> | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mostrarMensaje = (texto: string, tipo: 'success' | 'error' = 'success') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  };

  const cargarDatos = async () => {
    try {
      const configRes = await (window as any).electron.obtenerWebConfig();
      if (configRes.success && configRes.config) {
        const loadedConfig = configRes.config.general || { 
          whatsapp: '', 
          ubicacion: '', 
          mostrarPrecios: false,
          nombreTienda: '',
          descripcionTienda: '',
          mapaIframe: '',
          horarioAtencion: '',
          emailContacto: ''
        };
        setConfig(loadedConfig);
        setOriginalConfig(loadedConfig);

        const loadedEmpresa = configRes.config.empresa || {
          ruc: '',
          razonSocial: '',
          nombreComercial: '',
          direccionFiscal: '',
          telefono: '',
          leyenda: 'Representación impresa de la Boleta de Venta Electrónica'
        };
        setEmpresa(loadedEmpresa);
        setOriginalEmpresa(loadedEmpresa);

        const loadedComunidad = configRes.config.comunidad || {
          avisoGlobal: '',
          telefonos: [],
          anuncios: [],
          avisos: []
        };
        setComunidad(loadedComunidad);
        setOriginalComunidad(loadedComunidad);

        const loadedIA = configRes.config.ia || { iaBusquedaHabilitada: false, iaCombosHabilitada: false };
        setIaBusquedaHabilitada(Boolean(loadedIA.iaBusquedaHabilitada));
        setIaComboHabilitado(Boolean(loadedIA.iaCombosHabilitada));
      }

      const bannersRes = await (window as any).electron.obtenerBanners();
      if (bannersRes.success) {
        setBanners(bannersRes.banners || []);
      }
      
      try {
        const analyticsRes = await (window as any).electron.obtenerAnalytics();
        if (analyticsRes && analyticsRes.success) {
          setAnalyticsData(analyticsRes.events || []);
        }
      } catch (err) {
        console.warn('Analytics no disponibles aún:', err);
      }
    } catch (err) {
      console.error('Error cargando datos web:', err);
      mostrarMensaje('Error al conectar con la base de datos local', 'error');
    }
  };

  useEffect(() => {
    cargarDatos();

    // Actualizar si hay eventos de sincronización completados
    const unsubscribeSync = (window as any).electron.onSyncCompleted(() => {
      cargarDatos();
    });

    return () => {
      if (typeof unsubscribeSync === 'function') unsubscribeSync();
    };
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await useUIStore.getState().showConfirm('¿Estás seguro de que deseas actualizar la configuración general de la web?', 'Actualizar Configuración'))) return;
    setIsLoading(true);
    try {
      const res = await (window as any).electron.guardarWebConfig('general', config);
      if (res.success) {
        mostrarMensaje('Configuración web guardada correctamente');
        cargarDatos();
      } else {
        mostrarMensaje('Error al guardar configuración: ' + res.error, 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al guardar configuración general', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await useUIStore.getState().showConfirm('¿Estás seguro de que deseas actualizar los datos de la empresa?', 'Actualizar Datos de Empresa'))) return;
    setIsLoading(true);
    try {
      const res = await (window as any).electron.guardarWebConfig('empresa', empresa);
      if (res.success) {
        mostrarMensaje('Datos de facturación de la empresa guardados correctamente');
        cargarDatos();
      } else {
        mostrarMensaje('Error al guardar datos de la empresa: ' + res.error, 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al guardar datos de la empresa', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveComunidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await useUIStore.getState().showConfirm('¿Estás seguro de que deseas actualizar la información de la comunidad?', 'Actualizar Comunidad'))) return;
    setIsLoading(true);
    try {
      const res = await (window as any).electron.guardarWebConfig('comunidad', comunidad);
      if (res.success) {
        mostrarMensaje('Información comunitaria guardada correctamente');
        cargarDatos();
      } else {
        mostrarMensaje('Error al guardar datos comunitarios: ' + res.error, 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al guardar datos comunitarios', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Guarda la configuración de IA en el POS.
   * @param busquedaEnabled - Estado de la búsqueda IA
   * @param combosEnabled - Estado de los combos IA (solo activo si busquedaEnabled es true)
   */
  const handleSaveIA = async (busquedaEnabled: boolean, combosEnabled: boolean) => {
    setIsLoading(true);
    // Regla de negocio: si se desactiva la búsqueda, los combos también se desactivan
    const finalCombosEnabled = busquedaEnabled ? combosEnabled : false;
    try {
      const res = await (window as any).electron.guardarWebConfig('ia', {
        iaBusquedaHabilitada: busquedaEnabled,
        iaCombosHabilitada: finalCombosEnabled,
      });
      if (res.success) {
        setIaBusquedaHabilitada(busquedaEnabled);
        setIaComboHabilitado(finalCombosEnabled);
        let msg = `Búsqueda IA ${busquedaEnabled ? 'ACTIVADA' : 'DESACTIVADA'} correctamente`;
        if (busquedaEnabled) {
          msg += ` | Combos IA ${finalCombosEnabled ? 'ACTIVADOS' : 'DESACTIVADOS'}`;
        } else {
          msg += ` | Combos IA desactivados automáticamente`;
        }
        mostrarMensaje(msg);
      } else {
        mostrarMensaje('Error al guardar configuración de IA: ' + res.error, 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al guardar configuración de IA', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTelefono = () => {
    setComunidad(prev => ({
      ...prev,
      telefonos: [...(prev.telefonos || []), { id: Date.now().toString(), nombre: '', numero: '' }]
    }));
  };

  const handleUpdateTelefono = (id: string, field: 'nombre' | 'numero', value: string) => {
    setComunidad(prev => ({
      ...prev,
      telefonos: prev.telefonos?.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };

  const handleRemoveTelefono = async (id: string) => {
    if (await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar este teléfono de la comunidad?', 'Eliminar Teléfono')) {
      setComunidad(prev => ({
        ...prev,
        telefonos: prev.telefonos?.filter(t => t.id !== id)
      }));
    }
  };

  const handleAddAnuncio = () => {
    setComunidad(prev => ({
      ...prev,
      anuncios: [...(prev.anuncios || []), { id: Date.now().toString(), nombre: '', descripcion: '', telefono: '' }]
    }));
  };

  const handleUpdateAnuncio = (id: string, field: 'nombre' | 'descripcion' | 'telefono', value: string) => {
    setComunidad(prev => ({
      ...prev,
      anuncios: prev.anuncios?.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const handleRemoveAnuncio = async (id: string) => {
    if (await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar este anuncio de la comunidad?', 'Eliminar Anuncio')) {
      setComunidad(prev => ({
        ...prev,
        anuncios: prev.anuncios?.filter(a => a.id !== id)
      }));
    }
  };

  const handleAddAviso = () => {
    const hoy = new Date();
    const fechaFormat = `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth() + 1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
    
    setComunidad(prev => ({
      ...prev,
      avisos: [...(prev.avisos || []), { id: Date.now().toString(), titulo: '', contenido: '', fecha: fechaFormat }]
    }));
  };

  const handleUpdateAviso = (id: string, field: 'titulo' | 'contenido' | 'fecha', value: string) => {
    setComunidad(prev => ({
      ...prev,
      avisos: prev.avisos?.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const handleRemoveAviso = async (id: string) => {
    if (await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar este aviso de la comunidad?', 'Eliminar Aviso')) {
      setComunidad(prev => ({
        ...prev,
        avisos: prev.avisos?.filter(a => a.id !== id)
      }));
    }
  };

  const handleBannerImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      setIsLoading(true);
      mostrarMensaje('Optimizando y subiendo banner publicitario...');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await (window as any).electron.procesarImagenLocal(arrayBuffer, file.name, 'banner');
        if (res.success) {
          setBannerForm(prev => ({ ...prev, imageUrl: null, imagenLocal: res.base64 }));
          mostrarMensaje('Imagen del banner vinculada y guardada localmente');
        } else {
          mostrarMensaje('Error procesando imagen: ' + res.error, 'error');
          await useUIStore.getState().showAlert('No se pudo procesar la imagen. Detalle del error: ' + res.error, 'Error de Imagen');
        }
      } catch (err) {
        console.error(err);
        mostrarMensaje('Error del sistema al procesar imagen', 'error');
        await useUIStore.getState().showAlert('Error del sistema al procesar imagen. Revisa la consola.', 'Error del Sistema');
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = ''; // Permite seleccionar el mismo archivo de nuevo
      }
    }
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.imageUrl && !bannerForm.imagenLocal) {
      mostrarMensaje('Por favor, selecciona una imagen para el banner.', 'error');
      return;
    }

    const isEditing = !!bannerForm.id;
    const title = isEditing ? 'Actualizar Banner' : 'Crear Banner';
    const msg = isEditing 
      ? '¿Estás seguro de que deseas actualizar este banner?' 
      : '¿Estás seguro de que deseas crear este nuevo banner?';
    if (!(await useUIStore.getState().showConfirm(msg, title))) return;

    setIsLoading(true);
    try {
      let res;
      if (isEditingBanner) {
        res = await (window as any).electron.actualizarBanner(bannerForm);
      } else {
        res = await (window as any).electron.crearBanner(bannerForm);
      }

      if (res.success) {
        mostrarMensaje(isEditingBanner ? 'Banner actualizado con éxito' : 'Banner creado con éxito');
        resetBannerForm();
        cargarDatos();
      } else {
        mostrarMensaje('Error al guardar banner: ' + res.error, 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarMensaje('Error al procesar banner', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditBanner = (banner: Banner) => {
    setBannerForm(banner);
    setOriginalBannerForm(banner);
    setIsEditingBanner(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBanner = async (id: string) => {
    if (await useUIStore.getState().showConfirm('¿Seguro que deseas eliminar este banner? Esta acción se sincronizará con la nube.', 'Eliminar Banner')) {
      setIsLoading(true);
      try {
        const res = await (window as any).electron.eliminarBanner(id);
        if (res.success) {
          mostrarMensaje('Banner eliminado localmente. Sincronizando...');
          cargarDatos();
        } else {
          mostrarMensaje('Error al eliminar: ' + res.error, 'error');
        }
      } catch (err) {
        console.error(err);
        mostrarMensaje('Error del sistema al eliminar', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetBannerForm = () => {
    setIsEditingBanner(false);
    setBannerForm({
      id: '',
      title: '',
      subtitle: '',
      imageUrl: '',
      badgeText: '',
      ctaText: 'Ver más',
      ctaActionCategory: 'Todas',
      active: true,
      priority: 0
    });
    setOriginalBannerForm(null);
    setIsEditingBanner(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isConfigModified = originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);
  const isEmpresaModified = originalEmpresa && JSON.stringify(empresa) !== JSON.stringify(originalEmpresa);
  const isComunidadModified = originalComunidad && JSON.stringify(comunidad) !== JSON.stringify(originalComunidad);
  const isBannerModified = !isEditingBanner || (originalBannerForm && JSON.stringify(bannerForm) !== JSON.stringify(originalBannerForm));

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      
      {/* Panel Izquierdo: Formularios */}
      <div className="w-[480px] flex flex-col border-r border-slate-300 bg-slate-100/50 p-6 overflow-y-auto custom-scrollbar-light-light-light">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="text-emerald-600 w-8 h-8" />
          <h2 className="text-2xl font-bold text-emerald-600">Ajustes & Web</h2>
        </div>

        {/* Mensaje de feedback */}
        {mensaje && (
          <div className={`mb-4 p-4 rounded-xl border flex items-center gap-2 text-sm ${
            mensaje.tipo === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {mensaje.tipo === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Tabs de Control */}
        <div className="flex flex-wrap bg-slate-200 border border-slate-300 rounded-lg p-1 mb-6 gap-1">
          <button
            onClick={() => { setActiveTab('general'); resetBannerForm(); }}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeTab === 'general' ? 'bg-white text-slate-900 shadow-sm border border-slate-250' : 'text-slate-650 hover:text-slate-900'
            }`}
          >
            General Web
          </button>
          <button
            onClick={() => { setActiveTab('empresa'); resetBannerForm(); }}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeTab === 'empresa' ? 'bg-white text-slate-900 shadow-sm border border-slate-250' : 'text-slate-650 hover:text-slate-900'
            }`}
          >
            Ticket
          </button>
          <button
            onClick={() => { setActiveTab('comunidad'); resetBannerForm(); }}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeTab === 'comunidad' ? 'bg-white text-slate-900 shadow-sm border border-slate-250' : 'text-slate-650 hover:text-slate-900'
            }`}
          >
            Comunidad
          </button>
          <button
            onClick={() => setActiveTab('banners')}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              activeTab === 'banners' ? 'bg-white text-slate-900 shadow-sm border border-slate-250' : 'text-slate-650 hover:text-slate-900'
            }`}
          >
            Banners
          </button>
          <button
            onClick={() => { setActiveTab('ia'); resetBannerForm(); }}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ia' ? 'bg-purple-600 text-white shadow-sm font-black' : 'text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            <Sparkles size={13} />
            <span>IA / RAG</span>
          </button>
        </div>

        {/* Formulario General */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveConfig} className="space-y-5 flex-1 pb-10">
            {/* Card 1: Información de Identidad */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2">Identidad del Negocio</span>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Nombre de la Tienda *</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Minimarket Flor"
                  value={config.nombreTienda || ''}
                  onChange={e => setConfig({ ...config, nombreTienda: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Descripción de la Tienda</label>
                <textarea
                  rows={3}
                  placeholder="Describa el negocio..."
                  value={config.descripcionTienda || ''}
                  onChange={e => setConfig({ ...config, descripcionTienda: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors custom-scrollbar-light-light-light"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Horario de Atención</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Lunes a Sábado: 8:00 AM - 10:00 PM&#10;Domingo: 9:00 AM - 6:00 PM"
                  value={config.horarioAtencion || ''}
                  onChange={e => setConfig({ ...config, horarioAtencion: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors custom-scrollbar-light-light-light"
                />
              </div>
            </div>

            {/* Card 2: Contacto y Ubicación Física */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2">Ubicación y Contacto</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5 font-medium">WhatsApp de Consultas</label>
                  <input
                    type="text"
                    placeholder="Ej: 51970560023"
                    value={config.whatsapp || ''}
                    onChange={e => setConfig({ ...config, whatsapp: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5 font-medium">Correo de Contacto</label>
                  <input
                    type="email"
                    placeholder="contacto@tienda.com"
                    value={config.emailContacto || ''}
                    onChange={e => setConfig({ ...config, emailContacto: e.target.value })}
                    className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Dirección / Ubicación Física</label>
                <input
                  type="text"
                  placeholder="Av. Principal 123, Ciudad"
                  value={config.ubicacion || ''}
                  onChange={e => setConfig({ ...config, ubicacion: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Enlace de inserción de Google Maps (Iframe Src)</label>
                <textarea
                  rows={3}
                  placeholder="Pegar el enlace 'https://www.google.com/maps/embed?...'"
                  value={config.mapaIframe || ''}
                  onChange={e => setConfig({ ...config, mapaIframe: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors custom-scrollbar-light-light-light text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500 block mt-1 leading-normal">
                  Ve a Google Maps &rarr; Compartir &rarr; Insertar mapa &rarr; Copia únicamente el contenido del atributo <b>src="..."</b>.
                </span>
              </div>
            </div>

            {/* Card 3: Preferencias y Banderas */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2 mb-3">Preferencias de Visualización</span>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mostrarPrecios || false}
                  onChange={e => setConfig({ ...config, mostrarPrecios: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
                <div>
                  <span className="text-slate-800 font-medium block">Mostrar Precios en Web</span>
                  <span className="text-xs text-slate-500">Si se desactiva, los clientes verán los productos pero no sus costos (Modo Catálogo).</span>
                </div>
              </label>
            </div>

            <button 
              disabled={isLoading || !isConfigModified} 
              type="submit" 
              className={`w-full font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                isLoading || !isConfigModified
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-250 shadow-none' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={18} /> Guardar Cambios Web
                </>
              )}
            </button>
          </form>
        )}

        {/* Formulario de Empresa */}
        {activeTab === 'empresa' && (
          <form onSubmit={handleSaveEmpresa} className="space-y-5 flex-1 pb-10">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5 font-medium">Nombre Comercial *</label>
              <input
                required
                type="text"
                placeholder="Ej: Minimarket Flor"
                value={empresa.nombreComercial || ''}
                onChange={e => setEmpresa({ ...empresa, nombreComercial: e.target.value })}
                className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1.5 font-medium">Razón Social *</label>
              <input
                required
                type="text"
                placeholder="Ej: Negociaciones Flor S.A.C."
                value={empresa.razonSocial || ''}
                onChange={e => setEmpresa({ ...empresa, razonSocial: e.target.value })}
                className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">RUC *</label>
                <input
                  required
                  maxLength={11}
                  type="text"
                  placeholder="Ej: 20608754123"
                  value={empresa.ruc || ''}
                  onChange={e => setEmpresa({ ...empresa, ruc: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5 font-medium">Teléfono de Caja</label>
                <input
                  type="text"
                  placeholder="Ej: 970560023"
                  value={empresa.telefono || ''}
                  onChange={e => setEmpresa({ ...empresa, telefono: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1.5 font-medium">Dirección Fiscal *</label>
              <input
                required
                type="text"
                placeholder="Av. Larco 456, Miraflores, Lima"
                value={empresa.direccionFiscal || ''}
                onChange={e => setEmpresa({ ...empresa, direccionFiscal: e.target.value })}
                className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1.5 font-medium">Mensaje / Leyenda Legal del Ticket</label>
              <textarea
                rows={3}
                placeholder="Ej: Representación impresa de la Boleta de Venta Electrónica. Gracias por su preferencia."
                value={empresa.leyenda || ''}
                onChange={e => setEmpresa({ ...empresa, leyenda: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none custom-scrollbar-light-light-light text-xs"
              />
            </div>

                <button 
                  disabled={isLoading || !isEmpresaModified} 
                  type="submit" 
                  className={`w-full font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    isLoading || !isEmpresaModified
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-250 shadow-none' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={18} /> Guardar Datos Empresa
                </>
              )}
            </button>
          </form>
        )}

        {/* Formulario Comunidad */}
        {activeTab === 'comunidad' && (
          <form onSubmit={handleSaveComunidad} className="space-y-5 flex-1 pb-10">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5 font-medium">Mensaje Destacado Superior (Enlace a Comunidad)</label>
              <textarea
                rows={3}
                placeholder="Ej: ¡Nuevos servicios en la comunidad! Toca aquí para verlos."
                value={comunidad.avisoGlobal || ''}
                onChange={e => setComunidad({ ...comunidad, avisoGlobal: e.target.value })}
                className="w-full bg-white border border-amber-500/50 rounded-lg p-2.5 text-slate-900 focus:border-emerald-500 outline-none custom-scrollbar-light-light-light"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Este mensaje aparecerá en la parte superior de la web y redirigirá a la sección Comunidad.</span>
            </div>

            <div className="pt-4 border-t border-slate-300">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm text-slate-600 font-medium">Directorio de Emergencias</label>
                <button
                  type="button"
                  onClick={handleAddTelefono}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-300 transition-colors"
                >
                  <Plus size={14} /> Añadir Teléfono
                </button>
              </div>
              
              <div className="space-y-3">
                {!comunidad.telefonos || comunidad.telefonos.length === 0 ? (
                  <div className="text-center p-4 bg-white/50 rounded-lg border border-slate-200 border-dashed">
                    <p className="text-xs text-slate-500">No hay teléfonos registrados.</p>
                  </div>
                ) : (
                  comunidad.telefonos.map((tel) => (
                    <div key={tel.id} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-300">
                      <div className="flex-1 space-y-2">
                        <input
                          required
                          type="text"
                          placeholder="Nombre (Ej: Serenazgo, Posta)"
                          value={tel.nombre}
                          onChange={e => handleUpdateTelefono(tel.id, 'nombre', e.target.value)}
                          className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                        />
                        <input
                          required
                          type="text"
                          placeholder="Número (Ej: 01 555-5555)"
                          value={tel.numero}
                          onChange={e => handleUpdateTelefono(tel.id, 'numero', e.target.value)}
                          className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTelefono(tel.id)}
                        className="p-2 text-rose-600 hover:bg-rose-400/10 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AVISOS SECTION */}
            <div className="pt-4 border-t border-slate-300">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm text-slate-600 font-medium">Avisos y Comunicados</label>
                <button
                  type="button"
                  onClick={handleAddAviso}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-300 transition-colors"
                >
                  <Plus size={14} /> Añadir Aviso
                </button>
              </div>
              
              <div className="space-y-3">
                {!comunidad.avisos || comunidad.avisos.length === 0 ? (
                  <div className="text-center p-4 bg-white/50 rounded-lg border border-slate-200 border-dashed">
                    <p className="text-xs text-slate-500">No hay avisos registrados.</p>
                  </div>
                ) : (
                  comunidad.avisos.map((aviso) => (
                    <div key={aviso.id} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-300">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Título del aviso"
                            value={aviso.titulo}
                            onChange={e => handleUpdateAviso(aviso.id, 'titulo', e.target.value)}
                            className="flex-1 bg-slate-100 border border-slate-300 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none"
                          />
                          <input
                            required
                            type="text"
                            placeholder="Fecha"
                            value={aviso.fecha}
                            onChange={e => handleUpdateAviso(aviso.id, 'fecha', e.target.value)}
                            className="w-24 bg-white border border-slate-350 hover:border-slate-400 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                          />
                        </div>
                        <textarea
                          required
                          rows={2}
                          placeholder="Contenido del aviso..."
                          value={aviso.contenido}
                          onChange={e => handleUpdateAviso(aviso.id, 'contenido', e.target.value)}
                          className="w-full bg-slate-100 border border-slate-300 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none custom-scrollbar-light-light-light"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAviso(aviso.id)}
                        className="p-2 text-rose-600 hover:bg-rose-400/10 rounded-md transition-colors mt-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ANUNCIOS SECTION */}
            <div className="pt-4 border-t border-slate-300">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm text-slate-600 font-medium">Anuncios de Servicios Locales</label>
                <button
                  type="button"
                  onClick={handleAddAnuncio}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-300 transition-colors"
                >
                  <Plus size={14} /> Añadir Anuncio
                </button>
              </div>
              
              <div className="space-y-3">
                {!comunidad.anuncios || comunidad.anuncios.length === 0 ? (
                  <div className="text-center p-4 bg-white/50 rounded-lg border border-slate-200 border-dashed">
                    <p className="text-xs text-slate-500">No hay anuncios registrados.</p>
                  </div>
                ) : (
                  comunidad.anuncios.map((anuncio) => (
                    <div key={anuncio.id} className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-300">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Nombre / Empresa"
                            value={anuncio.nombre}
                            onChange={e => handleUpdateAnuncio(anuncio.id, 'nombre', e.target.value)}
                            className="flex-1 bg-slate-100 border border-slate-300 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none"
                          />
                          <input
                            required
                            type="text"
                            placeholder="Celular"
                            value={anuncio.telefono}
                            onChange={e => handleUpdateAnuncio(anuncio.id, 'telefono', e.target.value)}
                            className="w-32 bg-white border border-slate-350 hover:border-slate-400 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                          />
                        </div>
                        <input
                          required
                          type="text"
                          placeholder="Descripción breve del servicio..."
                          value={anuncio.descripcion}
                          onChange={e => handleUpdateAnuncio(anuncio.id, 'descripcion', e.target.value)}
                          className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-md p-2 text-xs text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAnuncio(anuncio.id)}
                        className="p-2 text-rose-600 hover:bg-rose-400/10 rounded-md transition-colors mt-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

                <button 
                  disabled={isLoading || !isComunidadModified} 
                  type="submit" 
                  className={`w-full font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    isLoading || !isComunidadModified
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-250 shadow-none' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={18} /> Guardar Comunidad
                </>
              )}
            </button>
          </form>
        )}


        {/* Formulario de Banners */}
        {activeTab === 'banners' && (
          <form onSubmit={handleBannerSubmit} className="space-y-4 flex-1">
            <div className="flex justify-between items-center pb-2 border-b border-slate-300 mb-2">
              <h3 className="font-semibold text-emerald-600">
                {isEditingBanner ? 'Editar Diapositiva' : 'Nueva Diapositiva'}
              </h3>
              {isEditingBanner && (
                <button type="button" onClick={resetBannerForm} className="text-xs text-rose-600 hover:underline">
                  Cancelar
                </button>
              )}
            </div>

            {/* GRUPO 1: Contenido Textual */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2">Contenido Textual</span>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm text-slate-600 font-medium">Título Principal</label>
                  <span className="text-[10px] text-slate-400 font-medium">{(bannerForm.title || '').length}/50</span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Ej: ¡Ofertas de Fin de Semana!"
                  value={bannerForm.title || ''}
                  onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm text-slate-600">Subtítulo / Mensaje Largo</label>
                  <span className="text-[10px] text-slate-400 font-medium">{(bannerForm.subtitle || '').length}/150</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={150}
                  placeholder="Ej: Aprovecha descuentos en abarrotes..."
                  value={bannerForm.subtitle || ''}
                  onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors custom-scrollbar-light-light-light"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Badge / Tag Corto</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Ej: Promoción"
                  value={bannerForm.badgeText || ''}
                  onChange={e => setBannerForm({ ...bannerForm, badgeText: e.target.value })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>
            </div>

            {/* GRUPO 2: Interactividad */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2">Interactividad</span>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1 font-medium">Acción del Botón (Enlace a)</label>
                  <select
                    value={bannerForm.ctaActionCategory || 'Todas'}
                    onChange={e => setBannerForm({ ...bannerForm, ctaActionCategory: e.target.value })}
                    className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 outline-none shadow-sm transition-colors cursor-pointer"
                  >
                    <option value="Todas">Todas</option>
                    <option value="Comunidad">🌟 Ir a Comunidad</option>
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
                  <label className="block text-sm text-slate-600 mb-1">Texto de Acción (CTA)</label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="Ej: Ver Ofertas"
                    value={bannerForm.ctaText || ''}
                    onChange={e => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                    className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1 font-medium">Prioridad / Orden</label>
                <input
                  type="number"
                  value={bannerForm.priority === undefined ? 0 : bannerForm.priority}
                  onChange={e => setBannerForm({ ...bannerForm, priority: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-lg p-2 text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition-colors"
                />
              </div>
            </div>

            {/* GRUPO 3: Multimedia */}
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 shadow-sm">
              <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2 mb-3">Multimedia</span>
              
              <label className="block text-sm text-slate-600 mb-1 font-medium">Imagen del Banner *</label>
              <p className="text-[10px] text-emerald-600/80 mb-2 font-medium">Proporción sugerida: 4:1 (Ej. 1200x300 píxeles).</p>
              
              <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-white transition-colors overflow-hidden group">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleBannerImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title="Haz clic o arrastra una imagen aquí"
                />
                
                {bannerForm.imagenLocal || bannerForm.imageUrl ? (
                  <div className="relative h-32 w-full flex items-center justify-center bg-slate-100">
                    <img src={bannerForm.imagenLocal || bannerForm.imageUrl || ''} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="text-white mb-1" size={24} />
                      <span className="text-white text-xs font-bold">Haz clic para cambiar</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-400 group-hover:text-emerald-500 transition-colors">
                    <ImageIcon className="mb-2" size={32} />
                    <span className="text-sm font-semibold">Haz clic o arrastra tu imagen aquí</span>
                    <span className="text-xs text-slate-400 mt-1">JPG, PNG o WEBP</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 py-2 my-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerForm.active ?? true}
                  onChange={e => setBannerForm({ ...bannerForm, active: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded"
                />
                <span className="text-slate-700 font-medium">Mostrar Diapositiva en la Web</span>
              </label>
            </div>

                <button 
                  disabled={isLoading || !isBannerModified} 
                  type="submit" 
                  className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    isLoading || !isBannerModified
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-250 shadow-none' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Plus size={18} /> {isEditingBanner ? 'Actualizar Diapositiva' : 'Agregar Diapositiva'}
                </>
              )}
            </button>
          </form>
        )}

        {/* Formulario IA / RAG */}
        {activeTab === 'ia' && (
          <div className="space-y-5 flex-1 pb-10">
            {/* Card principal del motor IA */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-600/20">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Motor IA · RAG</h3>
                  <p className="text-xs text-slate-600">Controla el motor de búsqueda vectorial y el armador de combos de la tienda web.</p>
                </div>
              </div>

              {/* ── Toggle 1: Búsqueda IA ─────────────────────────────── */}
              <div className="bg-white rounded-xl border border-purple-100 p-4 mb-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${iaBusquedaHabilitada ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Búsqueda Inteligente</p>
                      <p className="text-[11px] text-slate-500">Búsqueda semántica vectorial con Gemini Embeddings</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveIA(!iaBusquedaHabilitada, iaComboHabilitado)}
                    disabled={isLoading}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none cursor-pointer flex-shrink-0 ${
                      iaBusquedaHabilitada ? 'bg-purple-600' : 'bg-slate-300'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={iaBusquedaHabilitada ? 'Desactivar búsqueda IA' : 'Activar búsqueda IA'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${iaBusquedaHabilitada ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Indicador de estado */}
                <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold ${iaBusquedaHabilitada ? 'text-purple-600' : 'text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${iaBusquedaHabilitada ? 'bg-purple-500 animate-pulse' : 'bg-slate-300'}`} />
                  {iaBusquedaHabilitada ? 'ACTIVA — Los clientes pueden buscar por conceptos (ej: "algo para el desayuno")' : 'INACTIVA — Solo búsqueda por texto exacto'}
                </div>
              </div>

              {/* ── Toggle 2: Armador de Combos (dependiente de búsqueda) ─────── */}
              <div className={`bg-white rounded-xl border p-4 shadow-xs transition-all duration-300 ${
                iaBusquedaHabilitada ? 'border-indigo-100 opacity-100' : 'border-slate-100 opacity-50 pointer-events-none'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${iaComboHabilitado && iaBusquedaHabilitada ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Bot size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Armador de Combos</p>
                      <p className="text-[11px] text-slate-500">Gemini 1.5 Flash arma compras personalizadas por descripción</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => iaBusquedaHabilitada && handleSaveIA(iaBusquedaHabilitada, !iaComboHabilitado)}
                    disabled={isLoading || !iaBusquedaHabilitada}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 ${
                      iaComboHabilitado && iaBusquedaHabilitada ? 'bg-indigo-600 cursor-pointer' : 'bg-slate-300 cursor-not-allowed'
                    } ${isLoading ? 'opacity-50' : ''}`}
                    title={!iaBusquedaHabilitada ? 'Primero activa la Búsqueda IA' : (iaComboHabilitado ? 'Desactivar combos' : 'Activar combos')}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${iaComboHabilitado && iaBusquedaHabilitada ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Indicador de estado */}
                <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold ${iaComboHabilitado && iaBusquedaHabilitada ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${iaComboHabilitado && iaBusquedaHabilitada ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                  {!iaBusquedaHabilitada
                    ? 'Requiere que la Búsqueda IA esté activa'
                    : iaComboHabilitado
                      ? 'ACTIVO — Botón "Armar Combo" visible en la tienda web'
                      : 'INACTIVO — El botón "Armar Combo" está oculto en la tienda web'
                  }
                </div>
              </div>
            </div>

            {/* Niveles del sistema */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                  <Zap size={14} className="text-amber-500" /> Nivel 1: Búsqueda Exacta
                </div>
                <p className="text-[11px] text-slate-500">Coincidencia rápida de texto por código o prefijo. Siempre activo. Costo $0.</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                  <Cpu size={14} className="text-purple-600" /> Nivel 2: Vectorial RAG
                </div>
                <p className="text-[11px] text-slate-500">Búsqueda semántica por conceptos usando Gemini Embeddings + Firestore Vector Search.</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                  <Bot size={14} className="text-indigo-600" /> Nivel 3: Creador Combos
                </div>
                <p className="text-[11px] text-slate-500">LLM Gemini 1.5 Flash arma listas de compras a medida en 1-Clic a partir de descripciones naturales.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel Derecho: Lista de Diapositivas */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Banners Activos</h1>
            <p className="text-sm text-slate-600 mt-1">Carrusel de imágenes que se muestran en el Hero de la tienda web.</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar-light-light-light bg-slate-100 rounded-xl border border-slate-300 p-4">
          {banners.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic p-8">
              <ImageIcon size={48} className="opacity-20 mb-4" />
              <span>No hay diapositivas registradas en la web.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map(banner => (
                <div
                  key={banner.id}
                  className={`bg-white border rounded-2xl overflow-hidden flex flex-col justify-between shadow transition-all duration-300 hover:shadow-xl ${
                    banner.active ? 'border-slate-300' : 'border-slate-200 opacity-60'
                  }`}
                >
                  {/* Banner Image Preview */}
                  <div className="relative h-36 bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img src={banner.imageUrl || undefined} alt={banner.title} className="w-full h-full object-cover" />
                    
                    {/* Badge */}
                    {banner.badgeText && (
                      <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-white/20 backdrop-blur-md text-slate-900 border border-white/20 text-[10px] rounded-full font-semibold">
                        {banner.badgeText}
                      </span>
                    )}

                    {/* Sync indicator */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {banner.pendienteSync && banner.pendienteSync > 0 ? (
                        <span className="text-amber-600 bg-amber-400/10 px-2 py-0.5 rounded text-[10px] w-fit font-semibold border border-amber-400/20 animate-pulse">
                          ☁ Pendiente
                        </span>
                      ) : (
                        <span className="text-blue-600 bg-blue-400/10 px-2 py-0.5 rounded text-[10px] w-fit font-semibold border border-blue-400/20">
                          ☁ Nube
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Banner Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg line-clamp-1">{banner.title}</h4>
                      <p className="text-slate-600 text-xs mt-1 line-clamp-2">{banner.subtitle || 'Sin subtítulo'}</p>
                      
                      <div className="flex gap-2 flex-wrap mt-3">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-300">
                          CTA: {banner.ctaText}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-300">
                          Ir a: {banner.ctaActionCategory || 'Todas'}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-300">
                          Prioridad: {banner.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-200/80">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        banner.active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-slate-100 text-slate-500 border border-slate-300'
                      }`}>
                        {banner.active ? 'Visible en Web' : 'Oculto'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditBanner(banner)}
                          className="p-1.5 text-blue-600 hover:bg-blue-400/10 rounded transition"
                          title="Editar Diapositiva"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition"
                          title="Eliminar Diapositiva"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
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
