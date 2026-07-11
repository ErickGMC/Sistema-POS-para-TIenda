const { db, limpiarUsuariosLocales } = require('../database/db.cjs');
const { initializeApp, deleteApp, getApps } = require('firebase/app');
const { getFirestore, doc, writeBatch, collection, getDocs, query, orderBy, limit, deleteField } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

const fs = require('fs');
const path = require('path');

let firebaseConfig = null;
let app = null;
let firestore = null;
let auth = null;
let storage = null;
let secondaryApp = null;
let secondaryAuth = null;

// Constante: Límite de operaciones por batch de Firestore
const BATCH_LIMIT = 499;

function getConfigPath() {
    const { app: eApp } = require('electron');
    const dbDir = eApp.isPackaged ? eApp.getPath('userData') : __dirname;
    return path.join(dbDir, 'firebase_config.json');
}

function loadConfig() {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
        try {
            const data = fs.readFileSync(configPath, 'utf8');
            firebaseConfig = JSON.parse(data);
            initFirebase();
            return true;
        } catch (e) {
            console.error('Error loading firebase config', e);
        }
    }
    return false;
}

function getFirebaseConfig() {
    return firebaseConfig;
}

// Helper: Construir email de Firebase Auth a partir del username
// Usa SIEMPRE el projectId como dominio para garantizar consistencia
function buildAuthEmail(username) {
    if (username.includes('@')) return username;
    const domain = firebaseConfig ? firebaseConfig.projectId : 'pos.local';
    return `${username}@${domain}.com`;
}

async function saveFirebaseConfig(config) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        firebaseConfig = config;
        initFirebase();
        
        // Validación de Conexión
        try {
            const prodSnap = await withTimeout(
                getDocs(query(collection(firestore, 'productos'), limit(1))),
                7000,
                "Tiempo de espera agotado al verificar las credenciales de Firebase."
            );
            
            if (!prodSnap.empty) {
                // Base de datos existente: limpiamos usuarios locales, forzando la descarga en el Login
                limpiarUsuariosLocales();
            }
        } catch (validationErr) {
            console.error("Fallo la validación de Firebase Config:", validationErr);
            
            // Revertir configuración si falla
            try { fs.unlinkSync(configPath); } catch {}
            firebaseConfig = null;
            
            let userMsg = validationErr.message;
            if (validationErr.code === 'permission-denied') {
                userMsg = "Permisos denegados. Asegúrate de que la colección 'productos' tenga permisos de lectura pública.";
            } else if (validationErr.code?.includes('invalid-api-key') || (validationErr.message && validationErr.message.includes('API key'))) {
                userMsg = "El API Key de tu configuración es inválido. Revisa tu archivo JSON.";
            }
            return { success: false, error: `Error de Validación: ${userMsg}` };
        }

        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

function initFirebase() {
    if (!firebaseConfig) return;
    try {
        // Eliminar instancias previas de forma síncrona-segura
        const apps = getApps();
        if (apps.length > 0) {
            // Usar un enfoque síncrono: simplemente re-obtener las instancias existentes
            // deleteApp es async pero no podemos await aquí, así que evitamos reinicializar si ya existe
            try {
                app = apps.find(a => a.name === '[DEFAULT]') || null;
                secondaryApp = apps.find(a => a.name === 'SecondaryAuthApp') || null;
                
                if (app && secondaryApp) {
                    firestore = getFirestore(app);
                    auth = getAuth(app);
                    storage = getStorage(app);
                    secondaryAuth = getAuth(secondaryApp);
                    return; // Ya están inicializados
                }
                
                // Si faltan, eliminar todo y reinicializar
                for (const existingApp of apps) {
                    try { deleteApp(existingApp); } catch {}
                }
            } catch {}
        }

        app = initializeApp(firebaseConfig);
        firestore = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
        
        // Secondary app for auth operations to avoid signing out the main app
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp');
        secondaryAuth = getAuth(secondaryApp);

    } catch(e) {
        console.error("Firebase init error:", e);
    }
}

// Intentar inicializar al arrancar
loadConfig();

// Helper para envolver promesas con timeout
function withTimeout(promise, timeoutMs, errorMessage) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs))
    ]);
}

// Verificar conexión a internet
function isOnline() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, 3000);
        
        require('dns').lookup('google.com', function(err) {
            clearTimeout(timeout);
            resolve(!err);
        });
    });
}

// ====================================================================
// SINCRONIZACIÓN: Cola SQLite → Firestore (con chunking de 500)
// ====================================================================
async function sincronizarCola() {
    const online = await isOnline();
    if (!online) {
        console.log('Offline: No se puede sincronizar.');
        return;
    }

    if (!auth || !auth.currentUser) {
        console.log('Usuario no autenticado en Firebase: Sincronización pausada.');
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('sync:error', 'Sincronización pausada: Falta iniciar sesión en la nube o configurar Auth.');
            }
        });
        return;
    }

    // Obtener registros pendientes
    const registros = db.prepare('SELECT * FROM sync_queue WHERE estado_sync = 0 ORDER BY fecha_creacion ASC').all();
    
    if (registros.length === 0) return;
    
    console.log(`Iniciando sincronización de ${registros.length} registros...`);

    // Dividir registros en chunks para respetar el límite de 500 operaciones por batch
    const chunks = [];
    for (let i = 0; i < registros.length; i += BATCH_LIMIT) {
        chunks.push(registros.slice(i, i + BATCH_LIMIT));
    }

    let totalProcesados = 0;
    let ultimoError = null;

    for (const chunk of chunks) {
        const batch = writeBatch(firestore);
        const registrosProcesados = [];

        for (let i = 0; i < chunk.length; i++) {
            const reg = chunk[i];
            
            // Yield al event loop cada 20 registros
            if (i > 0 && i % 20 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }

            try {
                const data = JSON.parse(reg.datos_json);
                
                if (reg.entidad === 'venta') {
                    const docRef = doc(firestore, 'ventas', reg.entidad_id);
                    batch.set(docRef, data.venta);
                    const detalleRef = doc(firestore, `ventas/${reg.entidad_id}/detalle`, 'items');
                    batch.set(detalleRef, { items: data.detalle });
                } else if (reg.entidad === 'producto') {
                    const docRef = doc(firestore, 'productos', reg.entidad_id);
                    if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                        let finalData = { ...data };
                        
                        // Si hay imagen local pendiente, subirla a Storage
                        if (finalData.imagenLocal && !finalData.imagenUrl) {
                            const base64Data = finalData.imagenLocal.replace(/^data:image\/\w+;base64,/, '');
                            const imageBuffer = Buffer.from(base64Data, 'base64');
                            const uploadRes = await subirImagenStorage(imageBuffer, 'producto', finalData.categoria);
                            
                            if (uploadRes.success) {
                                finalData.imagenUrl = uploadRes.url;
                                db.prepare('UPDATE productos SET imagenUrl = ? WHERE id = ?')
                                  .run(uploadRes.url, finalData.id);
                            }
                        }
                        
                        // Eliminar campos pesados/obsoletos de Firestore
                        finalData.imagenLocal = deleteField();
                        finalData.thumbnailLocal = deleteField();
                        finalData.thumbnailUrl = deleteField();
                        
                        batch.set(docRef, finalData, { merge: true });
                    } else if (reg.operacion === 'DELETE') {
                        batch.delete(docRef);
                    }
                } else if (reg.entidad === 'usuario') {
                    const docRef = doc(firestore, 'usuarios', reg.entidad_id);
                    const usuarioData = { ...data };
                    
                    // SEGURIDAD: Nunca enviar contraseñas a Firestore
                    delete usuarioData.password;
                    delete usuarioData.password_hash;
                    delete usuarioData.salt;
                    
                    if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                        batch.set(docRef, usuarioData, { merge: true });
                    } else if (reg.operacion === 'DELETE') {
                        batch.delete(docRef);
                    }
                } else if (reg.entidad === 'web_config') {
                    const docRef = doc(firestore, 'web_config', reg.entidad_id);
                    batch.set(docRef, data, { merge: true });
                } else if (reg.entidad === 'banner') {
                    const docRef = doc(firestore, 'banners', reg.entidad_id);
                    if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                        let finalData = { ...data };
                        
                        if (finalData.imagenLocal && (!finalData.imageUrl || finalData.imageUrl === 'PENDIENTE')) {
                            const base64Data = finalData.imagenLocal.replace(/^data:image\/\w+;base64,/, '');
                            const imageBuffer = Buffer.from(base64Data, 'base64');
                            const uploadRes = await subirImagenStorage(imageBuffer, 'banner', 'general');
                            
                            if (uploadRes.success) {
                                finalData.imageUrl = uploadRes.url;
                                db.prepare('UPDATE banners SET imageUrl = ? WHERE id = ?')
                                  .run(uploadRes.url, finalData.id);
                            }
                        }
                        
                        finalData.imagenLocal = deleteField();
                        
                        batch.set(docRef, finalData, { merge: true });
                    } else if (reg.operacion === 'DELETE') {
                        batch.delete(docRef);
                    }
                } else if (reg.entidad === 'lista_compra') {
                    const docRef = doc(firestore, 'compras_listas', reg.entidad_id);
                    if (reg.operacion === 'CREATE' || reg.operacion === 'UPDATE') {
                        batch.set(docRef, data, { merge: true });
                    } else if (reg.operacion === 'DELETE') {
                        batch.delete(docRef);
                    }
                }

                registrosProcesados.push(reg.id);
            } catch (e) {
                console.error('Error procesando registro de sync:', e);
                db.prepare('UPDATE sync_queue SET intentos = intentos + 1 WHERE id = ?').run(reg.id);
                ultimoError = e;
            }
        }

        if (registrosProcesados.length > 0) {
            try {
                await withTimeout(
                    batch.commit(),
                    15000,
                    "Tiempo de espera agotado al enviar datos a Firestore (15s)"
                );
                // Marcar como completados
                const updateStmt = db.prepare('UPDATE sync_queue SET estado_sync = 1 WHERE id = ?');
                const tx = db.transaction((ids) => {
                    for (const id of ids) updateStmt.run(id);
                });
                tx(registrosProcesados);
                totalProcesados += registrosProcesados.length;
                console.log(`Batch sincronizado: ${registrosProcesados.length} registros.`);
            } catch (error) {
                console.error('Error al comitear batch a Firestore:', error);
                const errStmt = db.prepare('UPDATE sync_queue SET intentos = intentos + 1 WHERE id = ?');
                const txErr = db.transaction((ids) => {
                    for (const id of ids) errStmt.run(id);
                });
                txErr(registrosProcesados);
                ultimoError = error;
            }
        }
    }

    // Emitir evento final al frontend
    const { BrowserWindow } = require('electron');
    if (totalProcesados > 0) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('sync:completado', totalProcesados);
            }
        });
        console.log(`Sincronización total completada: ${totalProcesados} registros.`);
    } else if (ultimoError) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('sync:error', ultimoError.message || 'Error en la cola de sincronización');
            }
        });
    }
}

let syncInterval = null;

function startSyncWorker() {
    console.log("Iniciando worker de sincronización automática (cada 5 minutos)...");
    if (syncInterval) clearInterval(syncInterval);
    
    // Ejecutar inmediatamente
    sincronizarCola().catch(err => console.error("Error en syncWorker inicial:", err));
    
    // Programar ejecución cada 5 minutos (300000 ms)
    syncInterval = setInterval(() => {
        sincronizarCola().catch(err => console.error("Error en syncWorker periódico:", err));
    }, 300000);
}

// ====================================================================
// AUTENTICACIÓN FIREBASE AUTH
// ====================================================================

// Login principal: Autentica SOLO contra Firebase Auth
// Es el flujo correcto para la primera instalación y logins normales
async function loginConFirebase(email, password) {
    try {
        const loginEmail = buildAuthEmail(email);
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        return { success: true, uid: userCredential.user.uid, email: userCredential.user.email };
    } catch (err) {
        console.error("Error in loginConFirebase:", err);
        let friendlyError = err.message;
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
            friendlyError = 'Contraseña incorrecta';
        } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
            friendlyError = 'Usuario no encontrado en Firebase Auth';
        } else if (err.code === 'auth/too-many-requests') {
            friendlyError = 'Demasiados intentos. Espera unos minutos antes de reintentar.';
        } else if (err.code === 'auth/operation-not-allowed') {
            friendlyError = "Debes habilitar 'Correo electrónico/Contraseña' en la sección Authentication de tu consola Firebase.";
        }
        return { success: false, error: friendlyError, code: err.code };
    }
}

// Crear usuario en Firebase Auth (para nuevos colaboradores)
async function crearUsuarioAuth(email, password) {
    if (!firebaseConfig) return { success: false, error: 'Firebase no configurado' };
    try {
        const authEmail = buildAuthEmail(email);
        await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
        return { success: true };
    } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
            return { success: true }; // Ya existe, no es error
        }
        return { success: false, error: authErr.message };
    }
}

// ====================================================================
// ANALYTICS & DASHBOARD (NUBE)
// ====================================================================
async function obtenerDashboardData(tsInicioObj, strInicio) {
    if (!firestore) return { success: false, error: 'Firebase no configurado' };
    try {
        const { Timestamp, where } = require('firebase/firestore');
        const tsInicio = new Timestamp(tsInicioObj.seconds, tsInicioObj.nanoseconds || 0);

        // 1. Cargar Ventas
        const qVentas = query(collection(firestore, 'ventas'), where('fecha', '>=', strInicio), orderBy('fecha', 'desc'));
        const snapVentas = await getDocs(qVentas);
        const ventasList = snapVentas.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Cargar Stock Bajo
        const qStock = query(collection(firestore, 'productos'), where('stock', '<=', 10), orderBy('stock', 'asc'), limit(10));
        const snapStock = await getDocs(qStock);
        const stockList = snapStock.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Cargar Analytics
        const qAnalytics = query(collection(firestore, 'analytics_events'), where('timestamp', '>=', tsInicio), orderBy('timestamp', 'desc'));
        const snapAnalytics = await getDocs(qAnalytics);
        
        const analyticsList = snapAnalytics.docs.map(d => {
            const data = d.data();
            if (data.timestamp && data.timestamp.toDate) {
                data.timestamp = { seconds: data.timestamp.seconds, nanoseconds: data.timestamp.nanoseconds };
            }
            return { id: d.id, ...data };
        });

        return { success: true, ventas: ventasList, stock: stockList, analytics: analyticsList };
    } catch (err) {
        console.error("Error obteniendo dashboard data:", err);
        return { success: false, error: err.message };
    }
}

// ====================================================================
// SUBIDA DE IMÁGENES A FIREBASE STORAGE
// ====================================================================
async function subirImagenStorage(buffer, type, categoria) {
    try {
        const catCode = categoria ? categoria.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : 'GEN';
        const unique = Math.random().toString(36).substring(2, 6).toUpperCase();
        const fileName = `${type}s/${catCode}-${unique}.webp`;
        
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, buffer, { contentType: 'image/webp' });
        
        const url = await getDownloadURL(storageRef);
        return { success: true, url };
    } catch (error) {
        console.error('Error subiendo imagen a Storage:', error);
        return { success: false, error: error.message };
    }
}

// ====================================================================
// DESCARGA COMPLETA DESDE FIREBASE → SQLite
// ====================================================================
async function descargarDatosDesdeNube() {
    if (!firestore) return { success: false, error: 'Firebase no está configurado.' };
    try {
        console.log("Descargando base de datos completa desde Firebase...");
        
        // 1. Descargar Productos
        const prodSnap = await getDocs(collection(firestore, 'productos'));
        const productos = [];
        prodSnap.forEach(d => productos.push(d.data()));

        // 2. Descargar Usuarios
        const userSnap = await getDocs(collection(firestore, 'usuarios'));
        const usuarios = [];
        userSnap.forEach(d => usuarios.push(d.data()));

        // 3. Descargar Banners
        const bannerSnap = await getDocs(collection(firestore, 'banners'));
        const banners = [];
        bannerSnap.forEach(d => banners.push(d.data()));

        // 4. Descargar Ventas y Detalles
        const ventasList = [];
        const ventasSnap = await getDocs(collection(firestore, 'ventas'));
        
        for (let i = 0; i < ventasSnap.docs.length; i++) {
            const docSnap = ventasSnap.docs[i];
            
            if (i > 0 && i % 50 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
            
            const v = docSnap.data();
            const ventaId = docSnap.id;
            const detalles = [];
            
            const detallesSnap = await getDocs(collection(firestore, `ventas/${ventaId}/detalle`));
            detallesSnap.forEach(detDoc => {
                const detData = detDoc.data();
                if (detData && Array.isArray(detData.items)) {
                    detalles.push(...detData.items);
                }
            });
            
            ventasList.push({
                id: ventaId,
                data: v,
                detalles
            });
        }

        // 5. Descargar Web Config
        const webConfigSnap = await getDocs(collection(firestore, 'web_config'));
        const webConfig = [];
        webConfigSnap.forEach(d => webConfig.push({ key: d.id, value: JSON.stringify(d.data()) }));

        // 6. Descargar Listas de Compras
        const comprasListasSnap = await getDocs(collection(firestore, 'compras_listas'));
        const comprasListas = [];
        comprasListasSnap.forEach(d => comprasListas.push({ id: d.id, data: d.data() }));

        // 7. Descargar Analytics Events
        const analyticsSnap = await getDocs(collection(firestore, 'analytics_events'));
        const analyticsEvents = [];
        analyticsSnap.forEach(d => analyticsEvents.push({ id: d.id, data: d.data() }));

        console.log("Descarga de red completada con éxito. Escribiendo de forma atómica en SQLite...");

        // 8. Guardar en SQLite en UNA SOLA TRANSACCIÓN ATÓMICA
        const stmtInsertProd = db.prepare('INSERT OR REPLACE INTO productos (id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, unidadMedida, imagenUrl, thumbnailUrl, imagenLocal, thumbnailLocal, disponible, destacado, etiquetas) VALUES (@id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock, @unidadMedida, @imagenUrl, @thumbnailUrl, @imagenLocal, @thumbnailLocal, @disponible, @destacado, @etiquetas)');
        const stmtCheckUser = db.prepare('SELECT password_hash, salt FROM usuarios WHERE id = ? OR username = ?');
        const stmtUser = db.prepare('INSERT OR REPLACE INTO usuarios (id, username, password_hash, salt, role, permisos, activo) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const stmtBanner = db.prepare('INSERT OR REPLACE INTO banners (id, title, subtitle, imageUrl, imagenLocal, badgeText, ctaText, ctaActionCategory, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const insertVenta = db.prepare('INSERT OR REPLACE INTO ventas (id, fecha, total, metodoPago, estado, clienteNombre, clienteDocumento) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertDetalle = db.prepare('INSERT OR REPLACE INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
        
        const stmtWebConfig = db.prepare('INSERT OR REPLACE INTO web_config (key, value) VALUES (?, ?)');
        const stmtLista = db.prepare('INSERT OR REPLACE INTO compras_listas (id, nombre, fecha, total_estimado, estado) VALUES (?, ?, ?, ?, ?)');
        const stmtDetalleLista = db.prepare('INSERT OR REPLACE INTO compras_listas_detalle (id, lista_id, producto_id, cantidad_pedir, costo_unitario) VALUES (?, ?, ?, ?, ?)');
        const stmtAnalytics = db.prepare('INSERT OR REPLACE INTO analytics_events (id, type, timestamp, data) VALUES (?, ?, ?, ?)');

        const tx = db.transaction(() => {
            // A. Registrar Usuarios preservando contraseñas locales si ya existen
            for (const u of usuarios) {
                let hash, salt;
                const existing = stmtCheckUser.get(u.id || u.username, u.username);
                
                if (existing) {
                    hash = existing.password_hash;
                    salt = existing.salt;
                } else {
                    const crypto = require('crypto');
                    salt = crypto.randomBytes(16).toString('hex');
                    hash = crypto.scryptSync('123456', salt, 64).toString('hex');
                }
                
                stmtUser.run(
                    u.id || u.username, 
                    u.username, 
                    hash, 
                    salt, 
                    u.role || 'user', 
                    u.permisos ? JSON.stringify(u.permisos) : null,
                    u.activo !== undefined ? (u.activo ? 1 : 0) : 1
                );
            }

            // B. Registrar Productos
            for (const p of productos) {
                stmtInsertProd.run({
                    id: p.id,
                    codigoBarras: p.codigoBarras || null,
                    nombre: p.nombre || '',
                    descripcion: p.descripcion || null,
                    categoria: p.categoria || 'Abarrotes',
                    precio: p.precio !== undefined ? p.precio : 0,
                    costo: p.costo !== undefined ? p.costo : null,
                    stock: p.stock !== undefined ? p.stock : 0,
                    unidadMedida: p.unidadMedida || 'unidad',
                    imagenUrl: p.imagenUrl || null,
                    thumbnailUrl: p.thumbnailUrl || null,
                    imagenLocal: p.imagenLocal || null,
                    thumbnailLocal: p.thumbnailLocal || null,
                    disponible: p.disponible ? 1 : 0,
                    destacado: p.destacado ? 1 : 0,
                    etiquetas: p.etiquetas ? JSON.stringify(p.etiquetas) : null
                });
            }

            // C. Registrar Banners
            for (const b of banners) {
                stmtBanner.run(
                    b.id, b.title || '', b.subtitle || null, b.imageUrl || null, b.imagenLocal || null, b.badgeText || null, b.ctaText || 'Ver más', b.ctaActionCategory || null, b.active ? 1 : 0, b.priority || 0
                );
            }

            // D. Registrar Ventas y Detalles
            for (const itemVenta of ventasList) {
                const v = itemVenta.data;
                const ventaId = itemVenta.id;
                
                let fechaSql = new Date().toISOString();
                if (v.fecha) {
                    if (v.fecha.seconds) {
                        fechaSql = new Date(v.fecha.seconds * 1000).toISOString();
                    } else if (typeof v.fecha === 'string') {
                        fechaSql = new Date(v.fecha).toISOString();
                    }
                }

                insertVenta.run(
                    ventaId,
                    fechaSql,
                    v.total || 0,
                    v.metodoPago || 'Efectivo',
                    v.estado || 'completada',
                    v.clienteNombre || null,
                    v.clienteDocumento || null
                );

                for (const d of itemVenta.detalles) {
                    insertDetalle.run(
                        d.id || require('crypto').randomUUID(),
                        ventaId,
                        d.producto_id || '',
                        d.cantidad || 1,
                        d.precio_unitario || 0,
                        d.subtotal || 0
                    );
                }
            }

            // E. Registrar Web Config
            for (const wc of webConfig) {
                stmtWebConfig.run(wc.key, wc.value);
            }

            // F. Registrar Listas de Compra
            for (const cl of comprasListas) {
                const l = cl.data;
                const listaId = cl.id;
                
                let fechaSql = new Date().toISOString();
                if (l.fecha) {
                    if (l.fecha.seconds) {
                        fechaSql = new Date(l.fecha.seconds * 1000).toISOString();
                    } else if (typeof l.fecha === 'string') {
                        fechaSql = new Date(l.fecha).toISOString();
                    }
                }
                
                stmtLista.run(
                    listaId,
                    l.nombre || 'Lista Importada',
                    fechaSql,
                    l.total_estimado || 0,
                    l.estado || 'pendiente'
                );

                if (l.detalles && Array.isArray(l.detalles)) {
                    for (const d of l.detalles) {
                        stmtDetalleLista.run(
                            d.id,
                            listaId,
                            d.producto_id,
                            d.cantidad_pedir || d.cantidad || 0,
                            d.costo_unitario || 0
                        );
                    }
                }
            }

            // G. Registrar Analytics Events
            for (const a of analyticsEvents) {
                const data = a.data;
                let fechaSql = new Date().toISOString();
                if (data.timestamp) {
                    if (data.timestamp.seconds) {
                        fechaSql = new Date(data.timestamp.seconds * 1000).toISOString();
                    } else if (typeof data.timestamp === 'string') {
                        fechaSql = new Date(data.timestamp).toISOString();
                    }
                }
                const extraData = { ...data };
                delete extraData.timestamp;
                delete extraData.type;
                stmtAnalytics.run(
                    a.id,
                    data.type || 'unknown',
                    fechaSql,
                    Object.keys(extraData).length > 0 ? JSON.stringify(extraData) : null
                );
            }
        });
        
        tx();
        console.log("Base de datos escrita y guardada localmente con éxito.");
        return { success: true };
    } catch (e) {
        console.error('Error durante la descarga de datos:', e);
        return { success: false, error: `Error en red o permisos: ${e.message}` };
    }
}

module.exports = {
    startSyncWorker,
    sincronizarCola,
    get app() { return app; },
    loginConFirebase,
    subirImagenStorage,
    getFirebaseConfig,
    saveFirebaseConfig,
    descargarDatosDesdeNube,
    obtenerDashboardData,
    crearUsuarioAuth,
    buildAuthEmail
};
