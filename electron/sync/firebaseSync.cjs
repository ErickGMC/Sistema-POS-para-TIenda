const { db } = require('../database/db.cjs');
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

function getConfigPath() {
    const { app: eApp } = require('electron');
    // En dev guardamos en root para que persista, en prod en userData
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

function saveFirebaseConfig(config) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        firebaseConfig = config;
        initFirebase();
        return { success: true };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

function initFirebase() {
    if (!firebaseConfig) return;
    try {
        // Si ya existen instancias previas de Firebase en el proceso principal,
        // debemos eliminarlas antes de volver a inicializar con el nuevo proyecto.
        const apps = getApps();
        for (const existingApp of apps) {
            deleteApp(existingApp).catch(e => console.error("Error al limpiar app de Firebase:", e));
        }

        app = initializeApp(firebaseConfig);
        firestore = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
        
        // Secondary app for auth operations to avoid signing out the main app
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp');
        secondaryAuth = getAuth(secondaryApp);

        // Auto-login del Sync Worker para evitar PERMISSION_DENIED
        autoLoginSyncWorker();
    } catch(e) {
        console.error("Firebase init error:", e);
    }
}

async function autoLoginSyncWorker() {
    try {
        const crypto = require('crypto');
        // Generamos un email dinámico y único basado en el ID del proyecto Firebase del cliente
        const syncEmail = `sync_worker@${firebaseConfig.projectId}.firebaseapp.com`;
        
        // Generamos una contraseña determinista basada en el apiKey del proyecto
        // Esto previene fallos si se reinstala la app o se borra la configuración local
        const syncPassword = crypto.createHash('sha256').update(firebaseConfig.apiKey).digest('hex').slice(0, 20);

        try {
            await signInWithEmailAndPassword(auth, syncEmail, syncPassword);
            console.log("Sync Worker autenticado correctamente.");
        } catch (err) {
            // Si el usuario no existe, lo creamos
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
                try {
                    await createUserWithEmailAndPassword(auth, syncEmail, syncPassword);
                    console.log("Sync Worker account creado y autenticado.");
                } catch (createErr) {
                    // Si el correo ya existía (por ejemplo, contraseña desincronizada en la nube), 
                    // no detenemos la ejecución, pero informamos del inconveniente
                    if (createErr.code === 'auth/email-already-in-use') {
                        console.error("El usuario de sincronización ya existe en Firebase, pero la contraseña no coincide. Por favor, elimínalo de Firebase Auth para que se vuelva a crear.");
                    } else {
                        throw createErr;
                    }
                }
            } else {
                throw err;
            }
        }
    } catch (e) {
        console.error("Error en autoLoginSyncWorker:", e);
    }
}

// Intentar inicializar al arrancar
loadConfig();

// Verificar conexión a internet antes de sincronizar
function isOnline() {
    return new Promise((resolve) => {
        require('dns').lookup('google.com', function(err) {
            if (err) {
               resolve(false);
            } else {
               resolve(true);
            }
        });
    });
}

// Background Worker: Sincronizar cola
async function sincronizarCola() {
    const online = await isOnline();
    if (!online) {
        console.log('Offline: No se puede sincronizar.');
        return;
    }

    // Obtener registros pendientes (estado_sync = 0)
    const registros = db.prepare('SELECT * FROM sync_queue WHERE estado_sync = 0 ORDER BY fecha_creacion ASC').all();
    
    if (registros.length === 0) return;
    
    console.log(`Iniciando sincronización de ${registros.length} registros...`);

    const batch = writeBatch(firestore);
    const registrosProcesados = [];
    let ultimoError = null;

    for (const reg of registros) {
        try {
            const data = JSON.parse(reg.datos_json);
            
            if (reg.entidad === 'venta') {
                const docRef = doc(firestore, 'ventas_locales', reg.entidad_id);
                batch.set(docRef, data.venta);
                
                // Los detalles podrían ir en subcolecciones, o como array
                const detalleRef = doc(firestore, `ventas_locales/${reg.entidad_id}/detalle`, 'items');
                batch.set(detalleRef, { items: data.detalle });
            } else if (reg.entidad === 'producto') {
                const docRef = doc(firestore, 'productos', reg.entidad_id);
                if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                    let finalData = { ...data };
                    
                    // Si hay una imagen local pendiente y NO hay URL (es nueva), subirla a Storage
                    if (finalData.imagenLocal && !finalData.imagenUrl) {
                        const base64Data = finalData.imagenLocal.replace(/^data:image\/\w+;base64,/, '');
                        const imageBuffer = Buffer.from(base64Data, 'base64');
                        const uploadRes = await subirImagenStorage(imageBuffer, 'producto', finalData.categoria);
                        
                        if (uploadRes.success) {
                            finalData.imagenUrl = uploadRes.url;
                            
                            // Actualizar la base de datos local con la URL pública, pero SIN borrar la imagenLocal
                            db.prepare('UPDATE productos SET imagenUrl = ? WHERE id = ?')
                              .run(uploadRes.url, finalData.id);
                        }
                    }
                    
                    // IMPORTANTE: Eliminar la cadena pesada Base64 y fields obsoletos para que se borren en Firestore
                    finalData.imagenLocal = deleteField();
                    finalData.thumbnailLocal = deleteField();
                    finalData.thumbnailUrl = deleteField();
                    
                    batch.set(docRef, finalData, { merge: true });
                } else if (reg.operacion === 'DELETE') {
                    batch.delete(docRef);
                }
            } else if (reg.entidad === 'usuario') {
                const docRef = doc(firestore, 'usuarios', reg.entidad_id);
                const { password, ...usuarioData } = data;
                
                if (reg.operacion === 'INSERT') {
                    let email = usuarioData.email || usuarioData.username;
                    if (!email.includes('@')) {
                        email = `${email}@minimarketflor.com`;
                    }
                    
                    try {
                        await createUserWithEmailAndPassword(secondaryAuth, email, password || 'admin123');
                    } catch (authErr) {
                        if (authErr.code !== 'auth/email-already-in-use') {
                            throw authErr;
                        }
                    }
                    batch.set(docRef, usuarioData, { merge: true });
                } else if (reg.operacion === 'UPDATE') {
                    batch.set(docRef, usuarioData, { merge: true });
                } else if (reg.operacion === 'DELETE') {
                    batch.delete(docRef);
                }
                
                // Remove password from local sync_queue for security
                if (password) {
                    db.prepare("UPDATE sync_queue SET datos_json = ? WHERE id = ?").run(JSON.stringify(usuarioData), reg.id);
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
            await batch.commit();
            // Marcar como completados
            const updateStmt = db.prepare('UPDATE sync_queue SET estado_sync = 1 WHERE id = ?');
            const tx = db.transaction((ids) => {
                for (const id of ids) updateStmt.run(id);
            });
            tx(registrosProcesados);
            console.log(`Sincronización completada de ${registrosProcesados.length} registros.`);
            
            // Emitir evento a todas las ventanas
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('sync:completado', registrosProcesados.length);
                }
            });
        } catch (error) {
            console.error('Error al comitear a Firestore:', error);
            // Incrementar intentos en caso de falla
            const errStmt = db.prepare('UPDATE sync_queue SET intentos = intentos + 1 WHERE id = ?');
            const txErr = db.transaction((ids) => {
                for (const id of ids) errStmt.run(id);
            });
            txErr(registrosProcesados);

            // Emitir evento de error
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('sync:error', error.message);
                }
            });
        }
    } else if (ultimoError) {
        // Si no se procesó nada pero hubo un error en el bucle, notificar al frontend
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('sync:error', ultimoError.message || 'Error en la cola de sincronización');
            }
        });
    }
}

// Función mantenida por compatibilidad pero ya no inicia intervalos
function startSyncWorker() {
    console.log("Worker automático desactivado. Usar sincronización manual.");
}

async function loginConFirebase(email, password, allowCreate = false) {
    try {
        let loginEmail = email;
        if (!loginEmail.includes('@')) {
            // Usamos el ID del proyecto Firebase como dominio para que sea universal
            const domain = firebaseConfig ? firebaseConfig.projectId : 'pos.local';
            loginEmail = `${loginEmail}@${domain}.com`;
        }
        try {
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
            return { success: true, uid: userCredential.user.uid, email: userCredential.user.email };
        } catch (err) {
            // Si las credenciales fallan pero pasamos el login local (allowCreate), el usuario no existe en Firebase o su contraseña se desincronizó
            if (allowCreate && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials')) {
                const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
                return { success: true, uid: userCredential.user.uid, email: userCredential.user.email, isNew: true };
            }
            throw err;
        }
    } catch (err) {
        console.error("Error in loginConFirebase:", err);
        return { success: false, error: err.message, code: err.code };
    }
}

async function obtenerAnalytics() {
    try {
        const q = query(collection(firestore, 'analytics_events'), orderBy('timestamp', 'desc'), limit(1000));
        const snapshot = await getDocs(q);
        const events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, events };
    } catch (err) {
        console.error("Error obteniendo analytics:", err);
        return { success: false, error: err.message };
    }
}

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

async function descargarDatosDesdeNube() {
    if (!firestore) return { success: false, error: 'Firebase no está configurado.' };
    try {
        // Descargar Productos
        const prodSnap = await getDocs(collection(firestore, 'productos'));
        const productos = [];
        prodSnap.forEach(d => productos.push(d.data()));

        // Descargar Usuarios
        const userSnap = await getDocs(collection(firestore, 'usuarios'));
        const usuarios = [];
        userSnap.forEach(d => usuarios.push(d.data()));

        // Descargar Banners
        const bannerSnap = await getDocs(collection(firestore, 'banners'));
        const banners = [];
        bannerSnap.forEach(d => banners.push(d.data()));

        // Guardar en local de forma transaccional (sqlite db)
        const stmtInsertProd = db.prepare('INSERT OR REPLACE INTO productos (id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, unidadMedida, imagenUrl, thumbnailUrl, imagenLocal, thumbnailLocal, disponible, destacado, etiquetas) VALUES (@id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock, @unidadMedida, @imagenUrl, @thumbnailUrl, @imagenLocal, @thumbnailLocal, @disponible, @destacado, @etiquetas)');
        
        const tx = db.transaction(() => {
            // Usuarios
            const stmtUser = db.prepare('INSERT OR REPLACE INTO usuarios (id, username, password_hash, salt, role, permisos, activo) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const u of usuarios) {
                // Generar salt y hash genérico local si no existe (Firebase maneja la auth real, pero SQLite requiere la columna)
                // Usamos un password default 'sync' ya que login real pasa a firebase
                const crypto = require('crypto');
                const salt = crypto.randomBytes(16).toString('hex');
                const hash = crypto.scryptSync('123456', salt, 64).toString('hex');
                
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

            // Productos
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

            // Banners
            const stmtBanner = db.prepare('INSERT OR REPLACE INTO banners (id, title, subtitle, imageUrl, imagenLocal, badgeText, ctaText, ctaActionCategory, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const b of banners) {
                stmtBanner.run(
                    b.id, b.title || '', b.subtitle || null, b.imageUrl || null, b.imagenLocal || null, b.badgeText || null, b.ctaText || 'Ver más', b.ctaActionCategory || null, b.active ? 1 : 0, b.priority || 0
                );
            }
        });
        
        tx();

        // 4. Descargar Ventas y sus detalles (Paso secuencial para evitar sobrecargar memoria)
        try {
            console.log("Descargando historial de ventas desde la nube...");
            const ventasSnap = await getDocs(collection(firestore, 'ventas_locales'));
            
            // Usamos una transacción para insertar todas las ventas de forma atómica
            const insertVenta = db.prepare('INSERT OR REPLACE INTO ventas (id, fecha, total, metodoPago, estado, clienteNombre, clienteDocumento) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insertDetalle = db.prepare('INSERT OR REPLACE INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
            
            for (const docSnap of ventasSnap.docs) {
                const v = docSnap.data();
                const ventaId = docSnap.id;
                
                // Formatear fecha (Firebase Timestamp a string ISO/SQL DATETIME)
                let fechaSql = new Date().toISOString();
                if (v.fecha) {
                    if (v.fecha.seconds) {
                        fechaSql = new Date(v.fecha.seconds * 1000).toISOString();
                    } else if (typeof v.fecha === 'string') {
                        fechaSql = new Date(v.fecha).toISOString();
                    }
                }

                // Guardar Cabecera de Venta
                insertVenta.run(
                    ventaId,
                    fechaSql,
                    v.total || 0,
                    v.metodoPago || 'Efectivo',
                    v.estado || 'completada',
                    v.clienteNombre || null,
                    v.clienteDocumento || null
                );

                // Intentar descargar detalles de esta venta desde su subcolección
                try {
                    const detallesSnap = await getDocs(collection(firestore, `ventas_locales/${ventaId}/detalle`));
                    detallesSnap.forEach(detDoc => {
                        const detData = detDoc.data();
                        if (detData && Array.isArray(detData.items)) {
                            for (const item of detData.items) {
                                insertDetalle.run(
                                    item.id,
                                    ventaId,
                                    item.producto_id,
                                    item.cantidad,
                                    item.precio_unitario,
                                    item.subtotal
                                );
                            }
                        }
                    });
                } catch (errDetalle) {
                    console.error(`Error descargando detalles para venta ${ventaId}:`, errDetalle);
                }
            }
            console.log(`Descarga de ventas completada. Total procesadas: ${ventasSnap.size}`);
        } catch (errVentas) {
            console.error("Error al descargar ventas locales:", errVentas);
        }

        return { success: true };
    } catch (e) {
        console.error('Error descargando datos:', e);
        return { success: false, error: e.message };
    }
}

module.exports = {
    startSyncWorker,
    sincronizarCola,
    get app() { return app; },
    loginConFirebase,
    obtenerAnalytics,
    subirImagenStorage,
    getFirebaseConfig,
    saveFirebaseConfig,
    descargarDatosDesdeNube
};
