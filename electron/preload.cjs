const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // DB Methods
  openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
  buscarProductoPorCodigo: (codigo) => ipcRenderer.invoke('db:buscarProductoPorCodigo', codigo),
  buscarProductosPorNombre: (nombre) => ipcRenderer.invoke('db:buscarProductosPorNombre', nombre),
  obtenerTodosProductos: () => ipcRenderer.invoke('db:obtenerTodosProductos'),
  crearProducto: (producto) => ipcRenderer.invoke('db:crearProducto', producto),
  actualizarProducto: (producto) => ipcRenderer.invoke('db:actualizarProducto', producto),
  eliminarProducto: (id) => ipcRenderer.invoke('db:eliminarProducto', id),
  guardarVenta: (venta, detalle) => ipcRenderer.invoke('db:guardarVenta', venta, detalle),
  obtenerVentas: (filtros) => ipcRenderer.invoke('db:obtenerVentas', filtros),
  
  // Auth y Usuarios
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  obtenerUsuarios: () => ipcRenderer.invoke('usuarios:obtener'),
  crearUsuario: (userData, password) => ipcRenderer.invoke('usuarios:crear', { userData, password }),
  actualizarUsuario: (userData, newPassword) => ipcRenderer.invoke('usuarios:actualizar', { userData, newPassword }),
  eliminarUsuario: (id) => ipcRenderer.invoke('usuarios:eliminar', id),
  
  // Storage
  procesarImagenLocal: (buffer, fileName, type) => ipcRenderer.invoke('img:procesarLocal', buffer, fileName, type),
  
  // Imprimir
  imprimirSilencioso: (html) => ipcRenderer.invoke('printer:printTicket', html),
  
  // Sync & Firebase
  getFirebaseConfig: () => ipcRenderer.invoke('firebase:getConfig'),
  setFirebaseConfig: (config) => ipcRenderer.invoke('firebase:setConfig', config),
  descargarDatosDesdeNube: () => ipcRenderer.invoke('sync:downloadData'),
  startManualSync: () => ipcRenderer.invoke('sync:startManualSync'),
  forzarSincronizacion: () => ipcRenderer.invoke('sync:forzarSincronizacion'),
  obtenerEstadoSync: () => ipcRenderer.invoke('sync:obtenerEstadoSync'),
  onSyncCompleted: (callback) => {
    const listener = (_, count) => callback(count);
    ipcRenderer.on('sync:completado', listener);
    return () => ipcRenderer.removeListener('sync:completado', listener);
  },
  onSyncError: (callback) => {
    const listener = (_, err) => callback(err);
    ipcRenderer.on('sync:error', listener);
    return () => ipcRenderer.removeListener('sync:error', listener);
  },
  onSyncStatus: (callback) => {
    const listener = (_, msg) => callback(msg);
    ipcRenderer.on('sync:status', listener);
    return () => ipcRenderer.removeListener('sync:status', listener);
  },
  
  // Web Config & Banners
  obtenerWebConfig: () => ipcRenderer.invoke('db:obtenerWebConfig'),
  guardarWebConfig: (key, value) => ipcRenderer.invoke('db:guardarWebConfig', key, value),
  obtenerBanners: () => ipcRenderer.invoke('db:obtenerBanners'),
  crearBanner: (banner) => ipcRenderer.invoke('db:crearBanner', banner),
  actualizarBanner: (banner) => ipcRenderer.invoke('db:actualizarBanner', banner),
  eliminarBanner: (id) => ipcRenderer.invoke('db:eliminarBanner', id),
  
  // Analytics & Dashboard
  obtenerAnalytics: () => ipcRenderer.invoke('sync:obtenerAnalytics'),
  obtenerDashboardData: (tsInicioObj, strInicio) => ipcRenderer.invoke('sync:obtenerDashboardData', tsInicioObj, strInicio),

  // Compras / Listas de Reabastecimiento
  guardarListaCompra: (lista, detalles) => ipcRenderer.invoke('db:guardarListaCompra', lista, detalles),
  obtenerListasCompras: () => ipcRenderer.invoke('db:obtenerListasCompras'),
  eliminarListaCompra: (id) => ipcRenderer.invoke('db:eliminarListaCompra', id)
});
