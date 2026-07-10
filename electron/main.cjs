const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const db = require('./database/db.cjs');

// --- Esquemas de Validación (Zod) ---
const ProductoSchema = z.object({
  id: z.string().uuid().optional().or(z.string()),
  codigoBarras: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  categoria: z.string().min(1),
  precio: z.number().min(0),
  costo: z.number().min(0).optional(),
  stock: z.number().min(0),
  unidadMedida: z.string().default('unidad'),
  imagenUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  imagenLocal: z.string().nullable().optional(),
  thumbnailLocal: z.string().nullable().optional(),
  disponible: z.boolean().default(true),
  destacado: z.boolean().default(false),
  etiquetas: z.array(z.string()).default([])
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
  username: z.string().min(3),
  role: z.string(),
  permisos: z.array(z.string()).optional(),
  activo: z.boolean().optional()
});

// IPC para abrir enlaces externos (Ej: WhatsApp Web)
ipcMain.handle('system:openExternal', async (event, url) => {
  await shell.openExternal(url);
});
const { startSyncWorker } = require('./sync/firebaseSync.cjs');
const { optimizeImageToWebp } = require('./utils/imageOptimizer.cjs');

// Variables globales para la ventana
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Minimarket Flor - POS Local',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Si estamos en desarrollo, cargamos el puerto de Vite. Si no, cargamos el build.
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Quitar el menú por defecto de Electron para aspecto de app kiosko/POS
  mainWindow.setMenuBarVisibility(false);
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
  
  // --- IPC Handlers (Auth y Usuarios) ---
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    let finalRes = { success: false, error: 'Credenciales inválidas' };
    let localRes = db.login(username, password);

    const { loginConFirebase, descargarDatosDesdeNube } = require('./sync/firebaseSync.cjs');

    const tryAutoDownload = async () => {
      try {
        const prodCount = db.obtenerTodosProductos().length;
        if (prodCount === 0) {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('sync:status', 'Descargando base de datos, por favor espere...');
          });
          console.log("Base de datos local vacía. Auto-descargando desde la nube tras login exitoso...");
          await descargarDatosDesdeNube();
        }
      } catch(e) { console.error("Error en auto-descarga:", e); }
    };

    if (localRes.success) {
      finalRes = localRes;
      try {
        const fbRes = await loginConFirebase(username, password, true); // Sincroniza auth con Firebase, crea si es admin inicial
        
        if (!fbRes.success) {
            console.warn("Advertencia de Firebase Auth en background:", fbRes.error);
            // Avisar al frontend (el login local procede para modo offline)
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                let msg = `Aviso de Nube: ${fbRes.error}`;
                if (fbRes.code === 'auth/operation-not-allowed') {
                    msg = "Configuración faltante: Debes habilitar 'Correo electrónico/Contraseña' en la sección Authentication de tu consola Firebase para sincronizar.";
                }
                win.webContents.send('sync:error', msg);
            });
        } else {
            await tryAutoDownload();
        }
      } catch (e) {
        console.error("Error background auth firebase:", e);
      }
    } else {
      // 2. Si falla localmente, intentar con Firebase Auth
      try {
        const fbRes = await loginConFirebase(username, password, false);
        if (fbRes.success) {
          const registrarRes = db.registrarUsuarioDesdeFirebase(fbRes.uid, username, password, 'admin');
          if (registrarRes.success) {
            finalRes = db.login(username, password);
            await tryAutoDownload();
          }
        } else {
          if (fbRes.code === 'auth/wrong-password' || fbRes.code === 'auth/invalid-credential' || fbRes.code === 'auth/invalid-login-credentials') {
            finalRes = { success: false, error: 'Contraseña incorrecta' };
          } else if (fbRes.code === 'auth/user-not-found' || fbRes.code === 'auth/invalid-email') {
            finalRes = { success: false, error: 'Usuario incorrecto' };
          }
        }
      } catch (e) {
        console.error('Error en login Firebase:', e);
      }
    }
    
    return finalRes;
  });
  ipcMain.handle('usuarios:obtener', async () => {
    try {
      return db.obtenerUsuarios();
    } catch (err) {
      return [];
    }
  });
  ipcMain.handle('usuarios:crear', async (_, { userData, password }) => {
    try {
      const parsedUserData = UsuarioSchema.parse(userData);
      z.string().min(6).parse(password);
      
      // Intentar crear en Firebase Auth primero
      const firebaseSync = require('./sync/firebaseSync.cjs');
      const authRes = await firebaseSync.crearUsuarioAuth(parsedUserData.username, password);
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

  // Iniciar worker de sincronización en background
  startSyncWorker();

  // IPC Handlers de Imágenes y Sincronización
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

  ipcMain.handle('sync:startManualSync', async () => {
    const { sincronizarCola } = require('./sync/firebaseSync.cjs');
    await sincronizarCola();
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

  ipcMain.handle('sync:forzarSincronizacion', async () => {
    const { sincronizarCola } = require('./sync/firebaseSync.cjs');
    await sincronizarCola();
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

  ipcMain.handle('sync:obtenerAnalytics', async () => {
    const { obtenerAnalytics } = require('./sync/firebaseSync.cjs');
    return obtenerAnalytics();
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
  } catch (err) {
    return null;
  }
});

ipcMain.handle('db:buscarProductosPorNombre', (event, nombre) => {
  try {
    return db.buscarProductosPorNombre(nombre);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('db:obtenerTodosProductos', () => {
  try {
    return db.obtenerTodosProductos();
  } catch (err) {
    return [];
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

// Image Optimization IPC
ipcMain.handle('img:procesarYSubir', async (event, arrayBuffer, fileName, type = 'producto') => {
  const nodeBuffer = Buffer.from(arrayBuffer);
  const optResult = await optimizeImageToWebp(nodeBuffer, type);
  
  if (!optResult.success) return optResult;
  
  return { 
      success: true, 
      url: optResult.base64,
      thumbnailUrl: null,
      imagenLocal: null,
      thumbnailLocal: null
  };
});


// Printing IPC
ipcMain.handle('printer:printTicket', async (event, htmlContent) => {
  return new Promise((resolve) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    
    // Load HTML using data URI
    const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    printWindow.loadURL(dataUri);

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print({ 
        silent: true, 
        printBackground: true, 
        margins: { marginType: 'none' } 
      }, (success, failureReason) => {
        printWindow.close();
        if (success) resolve({ success: true });
        else resolve({ success: false, error: failureReason });
      });
    });
  });
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
