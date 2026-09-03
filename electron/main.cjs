const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { z } = require('zod');
const db = require('./database/db.cjs');

// --- Esquemas de Validación (Zod) ---
// Preprocess helper: convierte strings vacías a 0 para campos numéricos del formulario
const coerceNum = (defaultVal = 0) => z.preprocess(
  (val) => (val === '' || val === null || val === undefined) ? defaultVal : Number(val),
  z.number().min(0)
);
const coerceNumNullable = () => z.preprocess(
  (val) => (val === '' || val === null || val === undefined) ? null : Number(val),
  z.number().min(0).nullable()
);

const coerceBool = (defaultVal) => z.preprocess(
  (val) => {
    if (val === 1 || val === '1') return true;
    if (val === 0 || val === '0') return false;
    return Boolean(val);
  },
  z.boolean().default(defaultVal)
);

const ProductoSchema = z.object({
  id: z.string().uuid().optional().or(z.string()),
  codigoBarras: z.string().nullable().optional(),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  categoria: z.string().min(1),
  precio: coerceNum(0),
  costo: coerceNumNullable(),
  stock: coerceNum(0),
  unidadMedida: z.string().default('unidad'),
  imagenUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  imagenLocal: z.string().nullable().optional(),
  thumbnailLocal: z.string().nullable().optional(),
  disponible: coerceBool(true),
  destacado: coerceBool(false),
  esPrincipalWeb: coerceBool(false),
  productoPadreId: z.string().nullable().optional(),
  etiquetaVariante: z.string().nullable().optional(),
  mostrarPrecioWeb: coerceBool(false),
  etiquetas: z.any().transform(val => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  }).default([])
});

const VentaSchema = z.object({
  id: z.string().optional(),
  total: z.number().min(0),
  metodoPago: z.string(),
  clienteNombre: z.string().nullable().optional(),
  clienteDocumento: z.string().nullable().optional()
});

const VentaDetalleSchema = z.array(z.object({
  id: z.string(),
  producto_id: z.string(),
  cantidad: z.number().min(0.01),
  precio_unitario: z.number().min(0),
  subtotal: z.number().min(0)
}));

const UsuarioSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(2),
  email: z.string().email().optional().nullable(),
  role: z.string(),
  permisos: z.array(z.string()).optional(),
  activo: z.boolean().optional()
});

// IPC para abrir enlaces externos — con validación de URL
ipcMain.handle('system:openExternal', async (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      await shell.openExternal(url);
    } else {
      console.warn('Blocked openExternal for unsafe protocol:', parsed.protocol);
    }
  } catch (e) {
    console.error('Invalid URL for openExternal:', url, e);
  }
});

const { startSyncWorker } = require('./sync/firebaseSync.cjs');

// Variables globales para la ventana
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Minimarket POS Local',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();
}

app.whenReady().then(() => {
  const { protocol } = require('electron');
  protocol.registerFileProtocol('local-img', (request, callback) => {
    const url = request.url.replace('local-img://', '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error(error);
    }
  });

  createWindow();
  
  // ====================================================================
  // AUTH: Nuevo flujo — Firebase Auth primero, luego local
  // ====================================================================
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    const { loginConFirebase, descargarDatosDesdeNube } = require('./sync/firebaseSync.cjs');
    let fbRes = null;

    // Notificar al frontend que estamos verificando
    const notificar = (msg) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('sync:status', msg);
      });
    };

    // PASO 1: Intentar login contra Firebase Auth (obligatorio si hay internet)
    try {
      notificar('Verificando credenciales en la nube...');
      fbRes = await loginConFirebase(username, password);
      
      if (!fbRes.success) {
        // Si la cuenta está desactivada, retornar error de inmediato
        if (fbRes.code === 'auth/user-disabled') {
          notificar('');
          return { success: false, error: fbRes.error };
        }
        
        // Fallback: Intentar login local offline
        const localRes = db.login(username, password);
        if (localRes.success) {
          notificar('');
          return localRes;
        }
        // Ambos fallaron
        notificar('');
        return { success: false, error: fbRes.error || 'Credenciales inválidas' };
      }
    } catch (e) {
      console.error('Error en Firebase Auth:', e);
      // Si Firebase no responde, intentar login local
      const localRes = db.login(username, password);
      if (localRes.success) {
        notificar('');
        return localRes;
      }
      notificar('');
      return { success: false, error: 'Error de conexión. Verifica tu internet o credenciales.' };
    }

    // PASO 2: Firebase Auth exitoso — registrar/actualizar usuario localmente con perfil de Firestore
    const finalUsername = fbRes.username || username;
    const finalEmail = fbRes.email || (username.includes('@') ? username : null);
    const finalRole = fbRes.role || 'admin';
    const finalPermisos = fbRes.permisos || (finalRole === 'admin' ? ['all'] : []);

    db.registrarUsuarioDesdeFirebase(
      fbRes.uid,
      finalUsername,
      finalEmail,
      password,
      finalRole,
      finalPermisos,
      1
    );
    
    // PASO 3: Sincronizar base de datos completa desde Firebase tras login exitoso
    try {
      notificar('Sincronizando datos desde la nube...');
      console.log("Sincronizando datos completos desde Firestore tras login exitoso...");
      const dlRes = await descargarDatosDesdeNube();
      if (!dlRes.success) {
        console.warn("Advertencia en sincronización automática:", dlRes.error);
      } else {
        console.log("Sincronización inicial de catálogo, banners y web completada con éxito.");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync:completed', { timestamp: Date.now() });
        }
      }
    } catch (e) {
      console.error("Error en sincronización automática tras login:", e);
    }

    // PASO 4: Hacer login local con las credenciales ya registradas
    notificar('');
    const finalRes = db.login(finalEmail || finalUsername || username, password);
    if (finalRes.success) {
      return finalRes;
    }

    // Fallback por UID
    const userByUid = db.login(fbRes.uid, password);
    if (userByUid.success) {
      return userByUid;
    }

    return {
      success: true,
      user: {
        id: fbRes.uid,
        username: finalUsername,
        email: finalEmail,
        role: finalRole,
        permisos: finalPermisos,
        activo: 1
      }
    };
  });

  // --- IPC Handlers (Usuarios) ---
  ipcMain.handle('usuarios:obtener', async () => {
    try {
      return db.obtenerUsuarios();
    } catch {
      return [];
    }
  });
  ipcMain.handle('usuarios:crear', async (_, { userData, password }) => {
    try {
      const parsedUserData = UsuarioSchema.parse(userData);
      z.string().min(6).parse(password);
      
      // Crear en Firebase Auth primero
      const firebaseSync = require('./sync/firebaseSync.cjs');
      const authTarget = parsedUserData.email || parsedUserData.username;
      const authRes = await firebaseSync.crearUsuarioAuth(authTarget, password);
      if (!authRes.success) {
        return { success: false, error: authRes.error };
      }
      return db.crearUsuario(parsedUserData, password);
    } catch (err) {
      if (err instanceof z.ZodError) return { success: false, error: 'Datos inválidos', issues: err.issues };
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('usuarios:actualizar', async (_, { userData, newPassword }) => {
    try {
      return db.actualizarUsuario(userData, newPassword);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('usuarios:eliminar', async (_, id) => {
    try {
      return db.eliminarUsuario(id);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Iniciar worker de sincronización
  startSyncWorker();

  // IPC Handlers de Imágenes
  ipcMain.handle('img:procesarLocal', async (event, buffer, fileName, type) => {
    try {
      const { optimizeImageToWebp } = require('./utils/imageOptimizer.cjs');
      const optRes = await optimizeImageToWebp(buffer, type);
      if (!optRes.success) throw new Error(optRes.error);
      return { success: true, base64: optRes.base64 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // IPC Handlers de Sincronización
  ipcMain.handle('sync:startManualSync', async () => {
    const { sincronizarCola, repararEmbeddingsNube } = require('./sync/firebaseSync.cjs');
    await sincronizarCola();
    // Reparar en segundo plano cualquier embedding faltante en la nube
    repararEmbeddingsNube().catch(err => console.warn('Error en auto-reparación de embeddings:', err.message));
    return { success: true };
  });

  ipcMain.handle('firebase:getConfig', () => {
    const { getFirebaseConfig } = require('./sync/firebaseSync.cjs');
    return getFirebaseConfig();
  });

  ipcMain.handle('firebase:setConfig', async (event, config) => {
    const { saveFirebaseConfig } = require('./sync/firebaseSync.cjs');
    return await saveFirebaseConfig(config);
  });

  ipcMain.handle('sync:downloadData', async () => {
    const { descargarDatosDesdeNube } = require('./sync/firebaseSync.cjs');
    return await descargarDatosDesdeNube();
  });

  ipcMain.handle('sync:repararEmbeddings', async () => {
    const { repararEmbeddingsNube } = require('./sync/firebaseSync.cjs');
    return await repararEmbeddingsNube();
  });

  ipcMain.handle('sync:forzarSincronizacion', async () => {
    const { sincronizarCola, repararEmbeddingsNube } = require('./sync/firebaseSync.cjs');
    await sincronizarCola();
    repararEmbeddingsNube().catch(err => console.warn('Error en auto-reparación de embeddings:', err.message));
    return { success: true };
  });

  ipcMain.handle('sync:obtenerEstadoSync', async () => {
    try {
      const res = db.obtenerEstadoSync();
      return res;
    } catch {
      return { success: false, pendingCount: 0 };
    }
  });

  ipcMain.handle('sync:obtenerDashboardData', async (event, tsInicioObj, strInicio) => {
    return db.obtenerDashboardDataLocal(tsInicioObj, strInicio);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC DB Methods
ipcMain.handle('db:buscarProductoPorCodigo', (event, codigo) => {
  try {
    return db.buscarProductoPorCodigo(codigo);
  } catch {
    return null;
  }
});

ipcMain.handle('db:buscarProductosPorNombre', (event, nombre) => {
  try {
    return db.buscarProductosPorNombre(nombre);
  } catch {
    return [];
  }
});

ipcMain.handle('db:obtenerTodosProductos', () => {
  try {
    return db.obtenerTodosProductos();
  } catch {
    return [];
  }
});

ipcMain.handle('db:obtenerProductosParaVenta', () => {
  try {
    return db.obtenerProductosParaVenta();
  } catch {
    return [];
  }
});

ipcMain.handle('db:obtenerPresentacionesDeFamilia', (event, familiaId) => {
  try {
    return db.obtenerPresentacionesDeFamilia(familiaId);
  } catch {
    return [];
  }
});

ipcMain.handle('db:guardarFamiliaConPresentaciones', (event, { familia, presentaciones }) => {
  try {
    return db.guardarFamiliaConPresentaciones(familia, presentaciones);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:crearProducto', (event, producto) => {
  try {
    const parsed = ProductoSchema.parse(producto);
    return db.crearProducto(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) return { success: false, error: 'Datos inválidos', issues: err.issues };
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:actualizarProducto', (event, producto) => {
  try {
    const parsed = ProductoSchema.parse(producto);
    return db.actualizarProducto(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) return { success: false, error: 'Datos inválidos', issues: err.issues };
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:eliminarProducto', (event, id) => {
  try {
    return db.eliminarProducto(id);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:guardarVenta', (event, venta, detalle) => {
  try {
    const parsedVenta = VentaSchema.parse(venta);
    const parsedDetalle = VentaDetalleSchema.parse(detalle);
    return db.guardarVenta(parsedVenta, parsedDetalle);
  } catch (err) {
    if (err instanceof z.ZodError) return { success: false, error: 'Datos de venta inválidos', issues: err.issues };
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:obtenerVentas', (event, filtros) => {
  try {
    return db.obtenerVentas(filtros);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:anularVenta', (event, id) => {
  try {
    return db.anularVenta(id);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Printing IPC con timeout y captura de errores
ipcMain.handle('printer:printTicket', async (event, htmlContent) => {
  return new Promise((resolve) => {
    let resolved = false;
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { printWindow.close(); } catch (_) {}
        resolve({ success: false, error: 'Tiempo de espera de impresión agotado' });
      }
    }, 10000);

    const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    printWindow.loadURL(dataUri).catch(err => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { printWindow.close(); } catch (_) {}
        resolve({ success: false, error: err.message });
      }
    });

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print({ 
        silent: true, 
        printBackground: true, 
        margins: { marginType: 'none' } 
      }, (success, failureReason) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try { printWindow.close(); } catch (_) {}
          if (success) resolve({ success: true });
          else resolve({ success: false, error: failureReason });
        }
      });
    });

    printWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { printWindow.close(); } catch (_) {}
        resolve({ success: false, error: errorDescription });
      }
    });
  });
});

// Control de Caja, Turnos y Arqueo IPC
ipcMain.handle('caja:abrirTurno', (event, montoInicial, cajero) => {
  return db.abrirTurno(montoInicial, cajero);
});

ipcMain.handle('caja:obtenerTurnoActual', () => {
  return db.obtenerTurnoActual();
});

ipcMain.handle('caja:registrarMovimiento', (event, { turnoId, tipo, monto, motivo }) => {
  return db.registrarMovimientoCaja(turnoId, tipo, monto, motivo);
});

ipcMain.handle('caja:cerrarTurno', (event, { turnoId, montoFinalReal, observaciones }) => {
  return db.cerrarTurno(turnoId, montoFinalReal, observaciones);
});

ipcMain.handle('caja:obtenerHistorial', (event, limite) => {
  return db.obtenerHistorialTurnos(limite);
});

// Web Config & Banners IPC
ipcMain.handle('db:obtenerWebConfig', () => {
  return db.obtenerWebConfig();
});

ipcMain.handle('db:guardarWebConfig', (event, key, value) => {
  return db.guardarWebConfig(key, value);
});

ipcMain.handle('db:obtenerBanners', () => {
  return db.obtenerBanners();
});

ipcMain.handle('db:crearBanner', (event, banner) => {
  return db.crearBanner(banner);
});

ipcMain.handle('db:actualizarBanner', (event, banner) => {
  return db.actualizarBanner(banner);
});

ipcMain.handle('db:eliminarBanner', (event, id) => {
  return db.eliminarBanner(id);
});

// Compras / Listas de Reabastecimiento IPC
ipcMain.handle('db:guardarListaCompra', (event, lista, detalles) => {
  return db.guardarListaCompra(lista, detalles);
});

ipcMain.handle('db:obtenerListasCompras', () => {
  return db.obtenerListasCompras();
});

ipcMain.handle('db:eliminarListaCompra', (event, id) => {
  return db.eliminarListaCompra(id);
});

// Storage Maintenance IPC
ipcMain.handle('storage:limpiarArchivosHuerfanos', async () => {
  try {
    const firebaseSync = require('./sync/firebaseSync.cjs');
    return await firebaseSync.limpiarArchivosHuerfanosStorage();
  } catch (err) {
    return { success: false, error: err.message };
  }
});
