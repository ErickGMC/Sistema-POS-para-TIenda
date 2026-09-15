const { db, limpiarUsuariosLocales, purgarColaSync, getSyncMeta, setSyncMeta } = require('../database/db.cjs');
const { initializeApp, deleteApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc, writeBatch, collection, getDocs, query, where, orderBy, limit, deleteField, vector, onSnapshot, Timestamp, increment } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } = require('firebase/auth');
const { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } = require('firebase/storage');

const fs = require('fs');
const path = require('path');

let firebaseConfig = null;
let app = null;
let firestore = null;
let auth = null;
let storage = null;
let secondaryApp = null;
let secondaryAuth = null;

// Helper para obtener la API Key de Gemini desde entorno o configuración local
function getGeminiApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (firebaseConfig && firebaseConfig.geminiApiKey) return firebaseConfig.geminiApiKey;
    return null;
}

// ── URL de la Tienda Web (para el webhook de embeddings) ───────────────────────
// En desarrollo: http://localhost:3000
// En producción: cambia a tu URL de Vercel/hosting
const TIENDA_WEB_URL = process.env.TIENDA_WEB_URL || 'http://localhost:3000';
const EMBED_SECRET = process.env.EMBED_SECRET || 'pos_embed_secret_minimarket_flor_2025';

// Constante: Límite de operaciones por batch de Firestore
const BATCH_LIMIT = 499;

function getConfigPath() {
    const electron = require('electron');
    const eApp = electron && electron.app;
    const dbDir = (eApp && typeof eApp.isPackaged !== 'undefined' && eApp.isPackaged) ? eApp.getPath('userData') : __dirname;
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
        const fullConfig = {
            ...config,
            geminiApiKey: config.geminiApiKey || (firebaseConfig && firebaseConfig.geminiApiKey) || getGeminiApiKey()
        };
        fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2), 'utf8');
        firebaseConfig = fullConfig;
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

        if (auth) {
            onAuthStateChanged(auth, (currentUser) => {
                if (currentUser) {
                    console.log(`[Auth] Sesión activa en Firebase (${currentUser.email || currentUser.uid}).`);
                    iniciarEscuchaTiempoReal();
                    sincronizarCola().catch(err => console.error("Error sync onAuthStateChanged:", err));
                } else {
                    console.log('[Auth] Sesión inactiva en Firebase.');
                    detenerEscuchaTiempoReal();
                }
            });
        }
    } catch(e) {
        console.error("Firebase init error:", e);
    }
}

// Intentar inicializar al arrancar
loadConfig();

/**
 * Parsea etiquetas que pueden estar sobre-escapadas en SQLite
 */
function parsearEtiquetasSync(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(e => typeof e === 'string');
    if (typeof raw === 'object') return Object.values(raw).filter(e => typeof e === 'string');
    let val = raw;
    for (let i = 0; i < 5; i++) {
        try {
            val = JSON.parse(val);
            if (Array.isArray(val)) return val.filter(e => typeof e === 'string');
            if (typeof val !== 'string') return [];
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * Infiere conceptos clave y necesidades a partir del nombre, categoría y descripción
 */
function inferirConceptosSemanticosSync(nombre, categoria, desc) {
    const texto = `${nombre || ''} ${categoria || ''} ${desc || ''}`.toLowerCase();
    const conceptos = [];

    // Proteína
    if (texto.includes('pollo') || texto.includes('carne') || texto.includes('huevo') || texto.includes('queso') || texto.includes('pescado') || texto.includes('atun') || texto.includes('patasca') || texto.includes('carnero')) {
        conceptos.push('proteina', 'alimento proteico', 'desarrollo muscular', 'fuerza');
    }
    // Hidratación
    if (texto.includes('agua') || texto.includes('sporade') || texto.includes('gatorade') || texto.includes('rehidratante') || texto.includes('cielo') || texto.includes('mineral') || texto.includes('isotonica') || texto.includes('electrolito')) {
        conceptos.push('hidratacion', 'rehidratacion', 'calmar la sed', 'electrolitos', 'deporte');
    }
    // Desayuno
    if (texto.includes('pan') || texto.includes('leche') || texto.includes('huevo') || texto.includes('queso') || texto.includes('avena') || texto.includes('yogurt') || texto.includes('platano')) {
        conceptos.push('desayuno', 'primera comida del dia', 'manana');
    }
    // Almuerzo
    if (texto.includes('arroz') || texto.includes('fideo') || texto.includes('tallarin') || texto.includes('pollo') || texto.includes('menu') || texto.includes('aderezo') || texto.includes('papa') || texto.includes('lenteja')) {
        conceptos.push('almuerzo', 'segundo', 'comida criolla', 'guiso');
    }
    // Limpieza
    if (texto.includes('lejia') || texto.includes('clorox') || texto.includes('desinfectante') || texto.includes('limpieza') || texto.includes('cloro') || texto.includes('aseo')) {
        conceptos.push('limpieza', 'desinfeccion', 'aseo del hogar', 'higiene');
    }
    // Antojo / Dulce
    if (texto.includes('chocolate') || texto.includes('sublime') || texto.includes('galleta') || texto.includes('casino') || texto.includes('morocha') || texto.includes('lentejas') || texto.includes('dulce')) {
        conceptos.push('antojo dulce', 'snack', 'golosina', 'piqueo');
    }
    // Carbohidratos / Energía
    if (texto.includes('arroz') || texto.includes('fideo') || texto.includes('papa') || texto.includes('pan') || texto.includes('harina') || texto.includes('avena')) {
        conceptos.push('carbohidratos', 'energia');
    }

    return conceptos;
}

/**
 * Construye el texto RAG idéntico y enriquecido ontológicamente
 */
function construirTextoRAGSync(p) {
    const partes = [
        `Producto: ${p.nombre}`,
        `Categoría: ${p.categoria || 'Sin categoría'}`,
    ];
    if (p.descripcion && p.descripcion.trim()) {
        partes.push(`Descripción: ${p.descripcion.trim()}`);
    }
    const etiquetas = parsearEtiquetasSync(p.etiquetas);
    if (etiquetas.length > 0) {
        partes.push(`Etiquetas: ${etiquetas.join(', ')}`);
    }
    const conceptos = inferirConceptosSemanticosSync(p.nombre, p.categoria || '', p.descripcion || '');
    if (conceptos.length > 0) {
        partes.push(`Necesidades y Conceptos: ${conceptos.join(', ')}`);
    }
    if (p.unidadMedida && p.unidadMedida !== 'unidad') {
        partes.push(`Unidad: ${p.unidadMedida}`);
    }
    partes.push(`Disponible: ${p.disponible ? 'Sí' : 'No'}`);
    if (p.precio != null && Number(p.precio) > 0) {
        partes.push(`Precio: S/ ${Number(p.precio).toFixed(2)}`);
    }
    return partes.join('. ');
}

/**
 * Genera el VectorValue (768 dims) directamente usando Gemini API
 */
async function obtenerVectorEmbedding(textoRAG) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        console.warn('[Sync Embedding] No hay GEMINI_API_KEY disponible.');
        return null;
    }
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelo = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
        const embeddingModel = genAI.getGenerativeModel({ model: modelo });
        let values = [];
        try {
            const result = await embeddingModel.embedContent({
                content: { role: 'user', parts: [{ text: textoRAG }] },
                outputDimensionality: 768
            });
            values = result.embedding.values.slice(0, 768);
        } catch {
            const fallback = await embeddingModel.embedContent(textoRAG);
            values = fallback.embedding.values.slice(0, 768);
        }
        if (values && values.length > 0) {
            return vector(values);
        }
        return null;
    } catch (err) {
        console.warn('[Sync Embedding] Warning generando embedding:', err.message);
        return null;
    }
}

/**
 * Escanea la colección 'productos' en Firestore y genera/rectifica los embeddings
 * y texto_rag faltantes en cualquier producto existente.
 */
async function repararEmbeddingsNube() {
    if (!firestore) return { success: false, error: 'Firestore no está inicializado' };
    console.log('[Reparar Embeddings] Iniciando escaneo de productos en la nube...');
    try {
        const snapshot = await getDocs(collection(firestore, 'productos'));
        if (snapshot.empty) {
            return { success: true, count: 0, message: 'No hay productos en la base de datos' };
        }

        let reparados = 0;
        let omitidos = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const necesitaEmbedding = !data.embedding || !data.texto_rag || !data.modelo_embedding;

            if (necesitaEmbedding) {
                const textoRAG = construirTextoRAGSync({ id: docSnap.id, ...data });
                const vectorVal = await obtenerVectorEmbedding(textoRAG);

                if (vectorVal) {
                    const updatePayload = {
                        texto_rag: textoRAG,
                        embedding: vectorVal,
                        modelo_embedding: 'gemini-embedding-2',
                        embedding_generado_en: new Date().toISOString()
                    };
                    const batch = writeBatch(firestore);
                    batch.set(doc(firestore, 'productos', docSnap.id), updatePayload, { merge: true });
                    await batch.commit();
                    reparados++;
                    console.log(`[Reparar Embeddings] ✅ Embedding (768 dims) generado y guardado para: "${data.nombre || docSnap.id}"`);
                    // Pausa de 150ms para respetar límites de cuota de Gemini API
                    await new Promise(resolve => setTimeout(resolve, 150));
                } else {
                    console.warn(`[Reparar Embeddings] ⚠️ No se pudo generar embedding para: "${data.nombre || docSnap.id}"`);
                }
            } else {
                omitidos++;
            }
        }

        console.log(`[Reparar Embeddings] 🎉 Finalizado. Reparados: ${reparados}, Omitidos (ya tenían): ${omitidos}`);
        return { success: true, reparados, omitidos };
    } catch (err) {
        console.error('[Reparar Embeddings] Error durante la reparación:', err);
        return { success: false, error: err.message };
    }
}

// Helper para envolver promesas con timeout
/**
 * Genera el embedding de un producto llamando al endpoint /api/embed-producto
 * de la Tienda-web. No bloquea la sincronización si falla.
 *
 * @param {object} producto - Datos del producto a embedear
 */
async function generarEmbeddingProducto(producto) {
    const url = `${TIENDA_WEB_URL}/api/embed-producto`;
    try {
        const response = await withTimeout(
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-embed-secret': EMBED_SECRET,
                },
                body: JSON.stringify({
                    productoId: producto.id,
                    nombre: producto.nombre,
                    descripcion: producto.descripcion || null,
                    categoria: producto.categoria || null,
                    etiquetas: producto.etiquetas || null,
                    precio: producto.precio || null,
                    unidadMedida: producto.unidadMedida || null,
                    disponible: Boolean(producto.disponible),
                    esPrincipalWeb: Boolean(producto.esPrincipalWeb),
                    etiquetaVariante: producto.etiquetaVariante || null,
                }),
            }),
            25000,
            'Timeout al generar embedding del producto'
        );

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`[Embed] ⚠️  Error HTTP ${response.status} para "${producto.nombre}": ${errText}`);
        } else {
            const data = await response.json();
            console.log(`[Embed] ✅ Embedding de ${data.dims} dims guardado para: "${producto.nombre}"`);
        }
    } catch (err) {
        // No bloqueante: la sincronización principal ya completó exitosamente
        console.warn(`[Embed] ⚠️  No se pudo generar embedding para "${producto.nombre || producto.id}": ${err.message}`);
    }
}

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
                    const v = data.venta || {};
                    const idParts = (reg.entidad_id || '').split('-');
                    const serie = idParts.length > 1 ? idParts[0] : 'B001';
                    const correlativoNumero = idParts.length > 1 ? parseInt(idParts[1], 10) || 1 : 1;
                    
                    const salePayload = {
                        ...v,
                        id: reg.entidad_id,
                        serie,
                        correlativoNumero,
                        numeroTicket: reg.entidad_id,
                        fechaString: v.fecha || new Date().toISOString(),
                        fecha: Timestamp.now(),
                        anulado: Boolean(v.anulado),
                        origen: 'TIENDA_POS_DESKTOP',
                        items: data.detalle || []
                    };
                    // Guardado atómico en 1 sola escritura: Documento raíz con arreglo 'items'
                    batch.set(docRef, salePayload, { merge: true });
                } else if (reg.entidad === 'producto') {
                    const docRef = doc(firestore, 'productos', reg.entidad_id);
                    if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                        let finalData = { ...data };
                        
                        // Garantizar que el ID del documento es siempre el entidad_id de la cola
                        // (evita duplicados si el body trae un campo 'id' diferente)
                        finalData.id = reg.entidad_id;

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
                        finalData.imageUrl = deleteField();
                        finalData.imagenLocal = deleteField();
                        finalData.thumbnailLocal = deleteField();
                        finalData.thumbnailUrl = deleteField();
                        finalData.tags = deleteField();

                        // Normalizar tipos: disponible y destacado deben ser booleanos en Firestore
                        finalData.disponible = finalData.disponible === true || finalData.disponible === 1 || finalData.disponible === '1';
                        finalData.destacado = finalData.destacado === true || finalData.destacado === 1 || finalData.destacado === '1';
                        finalData.esPrincipalWeb = finalData.esPrincipalWeb === true || finalData.esPrincipalWeb === 1 || finalData.esPrincipalWeb === '1';
                        finalData.mostrarPrecioWeb = finalData.mostrarPrecioWeb === true || finalData.mostrarPrecioWeb === 1 || finalData.mostrarPrecioWeb === '1';
                        finalData.productoPadreId = finalData.productoPadreId ? String(finalData.productoPadreId).trim() : null;
                        finalData.etiquetaVariante = finalData.etiquetaVariante ? String(finalData.etiquetaVariante).trim() : null;
                        
                        // Normalizar etiquetas a array limpio de strings
                        finalData.etiquetas = parsearEtiquetasSync(finalData.etiquetas);

                        // Si viene marcado como actualización únicamente de stock (ej. desde una venta o anulación),
                        // omitimos recalcular los embeddings de Gemini para cuidar la cuota y agilizar el batch
                        const esSoloStock = finalData._soloStock === true;
                        delete finalData._soloStock;

                        // Generar e incluir texto_rag y vector de embedding nativo (768 dims)
                        if (!esSoloStock) {
                            try {
                                const textoRAG = construirTextoRAGSync(finalData);
                                finalData.texto_rag = textoRAG;
                                const vectorVal = await obtenerVectorEmbedding(textoRAG);
                                if (vectorVal) {
                                    finalData.embedding = vectorVal;
                                    finalData.embedding_generado_en = new Date().toISOString();
                                    finalData.modelo_embedding = 'gemini-embedding-2';
                                }
                            } catch (embedErr) {
                                console.warn(`[Sync] Warning generando embedding para ${finalData.nombre}:`, embedErr.message);
                            }
                        }

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
                    if (!usuarioData.nombreCompleto) usuarioData.nombreCompleto = usuarioData.username || 'Usuario';
                    if (!usuarioData.pin) usuarioData.pin = '1234';
                    
                    if (reg.operacion === 'INSERT' || reg.operacion === 'UPDATE') {
                        batch.set(docRef, usuarioData, { merge: true });
                    } else if (reg.operacion === 'DELETE') {
                        batch.delete(docRef);
                    }
                } else if (reg.entidad === 'web_config') {
                    const docRef = doc(firestore, 'web_config', reg.entidad_id);
                    // data debe incluir el objeto de configuracion (sin el campo 'key' que es el ID del doc)
                    const { key: _key, ...configData } = data;
                    batch.set(docRef, configData, { merge: true });
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
                } else if (reg.entidad === 'caja_turno') {
                    const docRef = doc(firestore, 'caja_turnos', reg.entidad_id);
                    batch.set(docRef, { ...data, actualizado_el: Timestamp.now() }, { merge: true });
                } else if (reg.entidad === 'caja_movimiento') {
                    const docRef = doc(firestore, 'caja_movimientos', reg.entidad_id);
                    batch.set(docRef, { ...data, actualizado_el: Timestamp.now() }, { merge: true });
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

                // ── Hook post-sync: Invalidar caché de Next.js en Tienda-web ──────────
                // Se llama al webhook de revalidación para que los cambios en productos
                // y banners sean visibles inmediatamente en la tienda web (< 2s).
                // Se ejecuta de forma no bloqueante.
                const hayProductosOBanners = chunk.some(reg =>
                    (reg.entidad === 'producto' || reg.entidad === 'banner') &&
                    registrosProcesados.includes(reg.id)
                );
                if (hayProductosOBanners) {
                    const revalidateUrl = `${TIENDA_WEB_URL}/api/revalidate`;
                    fetch(revalidateUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-revalidate-secret': EMBED_SECRET,
                        },
                        body: JSON.stringify({ tags: ['productos', 'banners'] }),
                    }).then(res => {
                        if (res.ok) {
                            console.log('[Sync] ✅ Caché de Tienda-web invalidada correctamente.');
                        } else {
                            console.warn(`[Sync] ⚠️ Webhook de revalidación retornó HTTP ${res.status}.`);
                        }
                    }).catch(err => {
                        console.warn('[Sync] ⚠️ No se pudo contactar el webhook de revalidación:', err.message);
                    });
                }
                // ──────────────────────────────────────────────────────────────────────

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
let unsubscribeProductos = null;
let unsubscribeVentas = null;
let unsubscribeCajasTurnos = null;
let unsubscribeCajasMovimientos = null;
let mainWindowRef = null;

function setMainWindow(win) {
    mainWindowRef = win;
}

function iniciarEscuchaTiempoReal() {
    if (!firestore || !auth || !auth.currentUser) return;
    detenerEscuchaTiempoReal();

    // 1. Escucha en tiempo real de Productos (Delta Sync optimizado)
    try {
        console.log('[Realtime] Activando escucha en tiempo real de productos en Firestore (Delta Sync)...');
        const prodCol = collection(firestore, 'productos');
        const lastSync = getSyncMeta('last_products_sync');

        // Si ya tenemos fecha de sincronización, consultar solo los modificados después de esa fecha
        const qProd = lastSync
            ? query(prodCol, where('updatedAt', '>', lastSync))
            : prodCol;
        
        let isFirstSnapshot = true;
        unsubscribeProductos = onSnapshot(qProd, (snapshot) => {
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                if (!lastSync) {
                    setSyncMeta('last_products_sync', new Date().toISOString());
                    return;
                }
            }

            const changes = snapshot.docChanges();
            if (!changes || changes.length === 0) return;

            const updateProdStmt = db.prepare(`
                UPDATE productos 
                SET stock = @stock,
                    precio = @precio,
                    nombre = COALESCE(@nombre, nombre),
                    disponible = @disponible
                WHERE id = @id
            `);

            const insertProdStmt = db.prepare(`
                INSERT OR IGNORE INTO productos (
                    id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, 
                    unidadMedida, imagenUrl, disponible, destacado, esPrincipalWeb
                ) VALUES (
                    @id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock,
                    @unidadMedida, @imagenUrl, @disponible, @destacado, @esPrincipalWeb
                )
            `);

            const checkProdStmt = db.prepare('SELECT id, stock, precio FROM productos WHERE id = ?');
            let actualizados = 0;
            let ultimoTimestamp = lastSync;

            const tx = db.transaction(() => {
                for (const change of changes) {
                    const docId = change.doc.id;
                    const data = change.doc.data();

                    // Borrado Lógico (Soft Delete) desde la nube
                    if (data.eliminado === true) {
                        db.prepare('DELETE FROM productos WHERE id = ?').run(docId);
                        actualizados++;
                        continue;
                    }

                    if (data.updatedAt && (!ultimoTimestamp || data.updatedAt > ultimoTimestamp)) {
                        ultimoTimestamp = data.updatedAt;
                    }

                    // Cachear imagen en disco local en segundo plano
                    if (data.imagenUrl) {
                        descargarYCachearImagen(docId, data.imagenUrl).catch(() => {});
                    }

                    if (change.type === 'added') {
                        const local = checkProdStmt.get(docId);
                        if (!local) {
                            insertProdStmt.run({
                                id: docId,
                                codigoBarras: data.codigoBarras || null,
                                nombre: data.nombre || '',
                                descripcion: data.descripcion || null,
                                categoria: data.categoria || 'Abarrotes',
                                precio: Number(data.precio) || 0,
                                costo: data.costo !== undefined ? Number(data.costo) : null,
                                stock: Number(data.stock) || 0,
                                unidadMedida: data.unidadMedida || 'unidad',
                                imagenUrl: data.imagenUrl || data.imageUrl || null,
                                disponible: data.disponible ? 1 : 0,
                                destacado: data.destacado ? 1 : 0,
                                esPrincipalWeb: data.esPrincipalWeb ? 1 : 0
                            });
                            actualizados++;
                        }
                    } else if (change.type === 'modified') {
                        const local = checkProdStmt.get(docId);
                        if (local) {
                            const nuevoStock = Number(data.stock) || 0;
                            const nuevoPrecio = Number(data.precio) || 0;
                            if (local.stock !== nuevoStock || local.precio !== nuevoPrecio) {
                                updateProdStmt.run({
                                    id: docId,
                                    stock: nuevoStock,
                                    precio: nuevoPrecio,
                                    nombre: data.nombre || null,
                                    disponible: data.disponible ? 1 : 0
                                });
                                actualizados++;
                            }
                        }
                    }
                }
            });

            tx();

            if (ultimoTimestamp && ultimoTimestamp !== lastSync) {
                setSyncMeta('last_products_sync', ultimoTimestamp);
            }

            if (actualizados > 0) {
                console.log(`[Realtime] ${actualizados} producto(s) sincronizados en tiempo real desde Firestore.`);
                const { BrowserWindow } = require('electron');
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('sync:productsChanged', { count: actualizados });
                    }
                });
            }
        }, (error) => {
            console.error('[Realtime] Error en escucha de productos Firestore:', error);
        });
    } catch (err) {
        console.error('[Realtime] Error al inicializar onSnapshot de productos:', err);
    }

    // 2. Escucha en tiempo real de Ventas (Originadas en AE_POS móvil o Web)
    try {
        console.log('[Realtime] Activando escucha en tiempo real de ventas en Firestore...');
        const ventasCol = collection(firestore, 'ventas');
        const qVentas = query(ventasCol, orderBy('fechaString', 'desc'), limit(50));

        let isFirstVentas = true;
        unsubscribeVentas = onSnapshot(qVentas, async (snapshot) => {
            if (isFirstVentas) {
                isFirstVentas = false;
                return;
            }

            const changes = snapshot.docChanges();
            if (!changes || changes.length === 0) return;

            const checkVentaStmt = db.prepare('SELECT id, anulado FROM ventas WHERE id = ?');
            const insertVentaStmt = db.prepare(`
                INSERT OR IGNORE INTO ventas (
                    id, fecha, total, metodoPago, clienteNombre, clienteDocumento, anulado, serie, correlativoNumero, numeroTicket
                ) VALUES (
                    @id, @fecha, @total, @metodoPago, @clienteNombre, @clienteDocumento, @anulado, @serie, @correlativoNumero, @numeroTicket
                )
            `);
            const updateAnuladoStmt = db.prepare('UPDATE ventas SET anulado = 1 WHERE id = ?');
            const insertDetalleStmt = db.prepare(`
                INSERT OR IGNORE INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (@id, @venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)
            `);

            let ventasModificadas = 0;

            for (const change of changes) {
                const docId = change.doc.id;
                const data = change.doc.data();

                if (change.type === 'added') {
                    const local = checkVentaStmt.get(docId);
                    if (!local) {
                        const serie = data.serie || 'B001';
                        const correlativoNumero = Number(data.correlativoNumero) || 1;
                        const numeroTicket = data.numeroTicket || `${serie}-${correlativoNumero.toString().padStart(8, '0')}`;
                        let fechaIso = new Date().toISOString();
                        if (data.fechaString) {
                            fechaIso = data.fechaString;
                        } else if (data.fecha && data.fecha.toDate) {
                            fechaIso = data.fecha.toDate().toISOString();
                        }

                        insertVentaStmt.run({
                            id: docId,
                            fecha: fechaIso,
                            total: Number(data.total) || 0,
                            metodoPago: data.metodoPago || 'Efectivo',
                            clienteNombre: data.clienteNombre || null,
                            clienteDocumento: data.clienteDocumento || null,
                            anulado: data.anulado ? 1 : 0,
                            serie,
                            correlativoNumero,
                            numeroTicket
                        });

                        // Detalles de venta
                        if (Array.isArray(data.items) && data.items.length > 0) {
                            for (const itm of data.items) {
                                insertDetalleStmt.run({
                                    id: itm.id || require('crypto').randomUUID(),
                                    venta_id: docId,
                                    producto_id: itm.producto_id || itm.productoId || '',
                                    cantidad: Number(itm.cantidad) || 1,
                                    precio_unitario: Number(itm.precio_unitario || itm.precioUnitario || 0),
                                    subtotal: Number(itm.subtotal) || 0
                                });
                            }
                        } else {
                            try {
                                const detSnap = await getDocs(collection(firestore, `ventas/${docId}/detalle`));
                                detSnap.forEach(detDoc => {
                                    const detData = detDoc.data();
                                    if (detDoc.id === 'items' && Array.isArray(detData.items)) {
                                        for (const itm of detData.items) {
                                            insertDetalleStmt.run({
                                                id: itm.id || require('crypto').randomUUID(),
                                                venta_id: docId,
                                                producto_id: itm.producto_id || itm.productoId || '',
                                                cantidad: Number(itm.cantidad) || 1,
                                                precio_unitario: Number(itm.precio_unitario || itm.precioUnitario || 0),
                                                subtotal: Number(itm.subtotal) || 0
                                            });
                                        }
                                    } else if (detData.producto_id || detData.productoId) {
                                        insertDetalleStmt.run({
                                            id: detDoc.id || require('crypto').randomUUID(),
                                            venta_id: docId,
                                            producto_id: detData.producto_id || detData.productoId || '',
                                            cantidad: Number(detData.cantidad) || 1,
                                            precio_unitario: Number(detData.precio_unitario || detData.precioUnitario || 0),
                                            subtotal: Number(detData.subtotal) || 0
                                        });
                                    }
                                });
                            } catch (_) {}
                        }
                        ventasModificadas++;
                    }
                } else if (change.type === 'modified') {
                    const local = checkVentaStmt.get(docId);
                    if (local && (data.anulado === true || data.anulado === 1) && !local.anulado) {
                        updateAnuladoStmt.run(docId);
                        ventasModificadas++;
                    }
                }
            }

            if (ventasModificadas > 0) {
                console.log(`[Realtime] ${ventasModificadas} venta(s) sincronizadas en tiempo real desde Firestore.`);
                const { BrowserWindow } = require('electron');
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('sync:ventasChanged', { count: ventasModificadas });
                    }
                });
            }
        }, (err) => {
            console.error('[Realtime] Error en escucha de ventas Firestore:', err);
        });
    } catch (err) {
        console.error('[Realtime] Error al inicializar onSnapshot de ventas:', err);
    }

    // 3. Escucha en tiempo real de Turnos de Caja
    try {
        console.log('[Realtime] Activando escucha en tiempo real de turnos de caja en Firestore...');
        const turnosCol = collection(firestore, 'caja_turnos');
        const qTurnos = query(turnosCol, orderBy('fechaApertura', 'desc'), limit(15));

        let isFirstTurnos = true;
        unsubscribeCajasTurnos = onSnapshot(qTurnos, (snapshot) => {
            if (isFirstTurnos) {
                isFirstTurnos = false;
                return;
            }
            const changes = snapshot.docChanges();
            if (!changes || changes.length === 0) return;

            const upsertTurnoStmt = db.prepare(`
                INSERT INTO cajas_turnos (
                    id, fechaApertura, fechaCierre, montoInicial, totalVentasEfectivo, totalVentasDigital,
                    totalIngresos, totalEgresos, montoEsperado, montoFinalReal, diferencia, estado, cajero, observaciones
                ) VALUES (
                    @id, @fechaApertura, @fechaCierre, @montoInicial, @totalVentasEfectivo, @totalVentasDigital,
                    @totalIngresos, @totalEgresos, @montoEsperado, @montoFinalReal, @diferencia, @estado, @cajero, @observaciones
                )
                ON CONFLICT(id) DO UPDATE SET
                    fechaCierre = excluded.fechaCierre,
                    totalVentasEfectivo = excluded.totalVentasEfectivo,
                    totalVentasDigital = excluded.totalVentasDigital,
                    totalIngresos = excluded.totalIngresos,
                    totalEgresos = excluded.totalEgresos,
                    montoEsperado = excluded.montoEsperado,
                    montoFinalReal = excluded.montoFinalReal,
                    diferencia = excluded.diferencia,
                    estado = excluded.estado,
                    observaciones = excluded.observaciones
            `);

            const tx = db.transaction(() => {
                for (const change of changes) {
                    const docId = change.doc.id;
                    const data = change.doc.data();
                    upsertTurnoStmt.run({
                        id: docId,
                        fechaApertura: data.fechaApertura || new Date().toISOString(),
                        fechaCierre: data.fechaCierre || null,
                        montoInicial: Number(data.montoInicial) || 0,
                        totalVentasEfectivo: Number(data.totalVentasEfectivo) || 0,
                        totalVentasDigital: Number(data.totalVentasDigital) || 0,
                        totalIngresos: Number(data.totalIngresos) || 0,
                        totalEgresos: Number(data.totalEgresos) || 0,
                        montoEsperado: Number(data.montoEsperado) || 0,
                        montoFinalReal: (data.montoFinalReal !== undefined && data.montoFinalReal !== null && data.montoFinalReal !== '') ? Number(data.montoFinalReal) : null,
                        diferencia: (data.diferencia !== undefined && data.diferencia !== null && data.diferencia !== '') ? Number(data.diferencia) : null,
                        estado: data.estado || 'abierta',
                        cajero: data.cajero || 'Cajero Principal',
                        observaciones: data.observaciones || null
                    });
                }
            });
            tx();

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('sync:cajasChanged', { tipo: 'turnos' });
                }
            });
        }, (err) => {
            console.error('[Realtime] Error en escucha de turnos Firestore:', err);
        });
    } catch (err) {
        console.error('[Realtime] Error al inicializar onSnapshot de turnos:', err);
    }

    // 4. Escucha en tiempo real de Movimientos de Caja
    try {
        console.log('[Realtime] Activando escucha en tiempo real de movimientos de caja en Firestore...');
        const movsCol = collection(firestore, 'caja_movimientos');
        const qMovs = query(movsCol, orderBy('fecha', 'desc'), limit(30));

        let isFirstMovs = true;
        unsubscribeCajasMovimientos = onSnapshot(qMovs, (snapshot) => {
            if (isFirstMovs) {
                isFirstMovs = false;
                return;
            }
            const changes = snapshot.docChanges();
            if (!changes || changes.length === 0) return;

            const insertMovStmt = db.prepare(`
                INSERT OR IGNORE INTO cajas_movimientos (id, turnoId, tipo, monto, motivo, fecha)
                VALUES (@id, @turnoId, @tipo, @monto, @motivo, @fecha)
            `);

            const tx = db.transaction(() => {
                for (const change of changes) {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        insertMovStmt.run({
                            id: change.doc.id,
                            turnoId: data.turnoId || '',
                            tipo: data.tipo || 'ingreso',
                            monto: Number(data.monto) || 0,
                            motivo: data.motivo || 'Movimiento',
                            fecha: data.fecha || new Date().toISOString()
                        });
                    }
                }
            });
            tx();

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('sync:cajasChanged', { tipo: 'movimientos' });
                }
            });
        }, (err) => {
            console.error('[Realtime] Error en escucha de movimientos Firestore:', err);
        });
    } catch (err) {
        console.error('[Realtime] Error al inicializar onSnapshot de movimientos:', err);
    }
}

function detenerEscuchaTiempoReal() {
    if (unsubscribeProductos) {
        unsubscribeProductos();
        unsubscribeProductos = null;
    }
    if (unsubscribeVentas) {
        unsubscribeVentas();
        unsubscribeVentas = null;
    }
    if (unsubscribeCajasTurnos) {
        unsubscribeCajasTurnos();
        unsubscribeCajasTurnos = null;
    }
    if (unsubscribeCajasMovimientos) {
        unsubscribeCajasMovimientos();
        unsubscribeCajasMovimientos = null;
    }
    console.log('[Realtime] Escuchas en tiempo real detenidas.');
}

function startSyncWorker(win) {
    if (win) setMainWindow(win);
    console.log("Iniciando worker de sincronización automática (cada 5 minutos)...");
    if (syncInterval) clearInterval(syncInterval);
    
    // Iniciar escucha si ya hay sesión autenticada
    if (auth && auth.currentUser) {
        iniciarEscuchaTiempoReal();
    }
    
    // Ejecutar inmediatamente
    sincronizarCola().catch(err => console.error("Error en syncWorker inicial:", err));
    purgarColaSync();
    
    // Programar ejecución cada 5 minutos (300000 ms)
    syncInterval = setInterval(() => {
        sincronizarCola().catch(err => console.error("Error en syncWorker periódico:", err));
        purgarColaSync();
    }, 300000);
}

// ====================================================================
// AUTENTICACIÓN FIREBASE AUTH
// ====================================================================

// Login principal: Autentica contra Firebase Auth y recupera perfil de Firestore
async function loginConFirebase(identifier, password) {
    if (!auth) return { success: false, error: 'Firebase no está inicializado.' };
    try {
        let loginEmail = (identifier || '').trim();
        
        // Si no contiene '@', intentar resolver el correo asociado
        if (!loginEmail.includes('@')) {
            // 1. Buscar en base de datos local
            try {
                const localUser = db.prepare('SELECT email, username FROM usuarios WHERE LOWER(username) = LOWER(?)').get(loginEmail);
                if (localUser && localUser.email) {
                    loginEmail = localUser.email;
                }
            } catch {}
            
            // 2. Si sigue sin '@', construir con buildAuthEmail como fallback
            if (!loginEmail.includes('@')) {
                loginEmail = buildAuthEmail(loginEmail);
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const uid = userCredential.user.uid;
        const email = userCredential.user.email || loginEmail;

        // Obtener el perfil real del usuario desde Firestore
        let userProfile = null;
        try {
            if (firestore) {
                const userDoc = await getDoc(doc(firestore, 'usuarios', uid));
                if (userDoc.exists()) {
                    userProfile = { id: userDoc.id, ...userDoc.data() };
                }
            }
        } catch (docErr) {
            console.warn('Advertencia al consultar perfil en Firestore:', docErr.message);
        }

        // Si la cuenta está explícitamente desactivada, impedir el acceso
        if (userProfile && userProfile.activo === false) {
            try { await auth.signOut(); } catch {}
            return { success: false, error: 'Tu cuenta ha sido desactivada. Contacta al administrador.', code: 'auth/user-disabled' };
        }

        const finalUsername = (userProfile && userProfile.username) ? userProfile.username : (email.includes('@') ? email.split('@')[0] : identifier);
        const finalRole = (userProfile && userProfile.role) ? userProfile.role : 'admin';
        const finalPermisos = (userProfile && userProfile.permisos) ? userProfile.permisos : (finalRole === 'admin' ? ['all'] : []);

        // Activar escucha en tiempo real inmediatamente
        iniciarEscuchaTiempoReal();
        sincronizarCola().catch(err => console.error("Error en sincronización post-login:", err));

        return { 
            success: true, 
            uid, 
            email, 
            username: finalUsername,
            role: finalRole,
            permisos: finalPermisos,
            profile: userProfile 
        };
    } catch (err) {
        console.error("Error in loginConFirebase:", err);
        let friendlyError = err.message;
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
            friendlyError = 'Contraseña o credenciales incorrectas.';
        } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
            friendlyError = 'Usuario o correo electrónico no encontrado en Firebase Auth.';
        } else if (err.code === 'auth/too-many-requests') {
            friendlyError = 'Demasiados intentos fallidos. Espera unos minutos antes de reintentar.';
        } else if (err.code === 'auth/operation-not-allowed') {
            friendlyError = "Debes habilitar 'Correo electrónico/Contraseña' en la sección Authentication de tu consola Firebase.";
        }
        return { success: false, error: friendlyError, code: err.code };
    }
}

// Crear usuario en Firebase Auth (para nuevos colaboradores)
async function crearUsuarioAuth(emailOrUsername, password) {
    if (!firebaseConfig) return { success: false, error: 'Firebase no configurado' };
    try {
        const authEmail = buildAuthEmail(emailOrUsername);
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
// DASHBOARD (NUBE)
// ====================================================================
async function obtenerDashboardData(tsInicioObj, strInicio) {
    // Arquitectura Local-First: Consultar siempre SQLite local para evitar consumo de lecturas en Firestore
    try {
        const localData = db.obtenerDashboardDataLocal(tsInicioObj, strInicio);
        if (localData && localData.success) {
            return localData;
        }
    } catch (localErr) {
        console.warn("Aviso obteniendo dashboard local, intentando consulta directa:", localErr.message);
    }

    // Fallback de consulta SQLite directa
    try {
        const localVentas = db.prepare(`
            SELECT * FROM ventas 
            WHERE fecha >= ? AND (anulado = 0 OR anulado IS NULL) 
            ORDER BY fecha DESC
        `).all(strInicio);
        const localStock = db.prepare(`
            SELECT * FROM productos 
            WHERE stock <= 10 AND (esPrincipalWeb = 0 OR esPrincipalWeb IS NULL) 
            ORDER BY stock ASC LIMIT 10
        `).all();
        return { success: true, ventas: localVentas, stock: localStock, isOffline: true };
    } catch (localErr) {
        return { success: false, error: localErr.message };
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
        await uploadBytes(storageRef, buffer, {
            contentType: 'image/webp',
            customMetadata: {
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
        
        const url = await getDownloadURL(storageRef);
        return { success: true, url };
    } catch (error) {
        console.error('Error subiendo imagen a Storage:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Descarga una imagen de Firebase Storage una sola vez y la almacena en el disco local
 * del equipo. Actualiza SQLite con la ruta local (local-img://...) para no volver a consumirla.
 */
async function descargarYCachearImagen(id, imagenUrl) {
    if (!imagenUrl || typeof imagenUrl !== 'string' || !imagenUrl.startsWith('http')) return null;
    try {
        const electron = require('electron');
        const eApp = electron && electron.app;
        if (!eApp || !eApp.getPath) return null;
        const imgDir = path.join(eApp.getPath('userData'), 'cached_images');
        if (!fs.existsSync(imgDir)) {
            fs.mkdirSync(imgDir, { recursive: true });
        }
        const filePath = path.join(imgDir, `${id}.webp`);
        if (fs.existsSync(filePath)) {
            return `local-img://${filePath}`;
        }

        const response = await fetch(imagenUrl);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

        const localProtocolUrl = `local-img://${filePath}`;
        try {
            db.prepare('UPDATE productos SET imagenLocal = ? WHERE id = ?').run(localProtocolUrl, id);
        } catch {}
        return localProtocolUrl;
    } catch (err) {
        return null;
    }
}

// ====================================================================
// LIMPIEZA DE ARCHIVOS HUÉRFANOS EN FIREBASE STORAGE
// ====================================================================
async function limpiarArchivosHuerfanosStorage() {
    if (!storage || !firestore) {
        return { success: false, error: 'Firebase no está inicializado o configurado.' };
    }

    try {
        console.log('[Storage Cleanup] Iniciando auditoría de archivos huérfanos en Storage...');

        // 1. Recopilar todas las URLs de imágenes activas en Firestore
        const [prodSnap, bannerSnap] = await Promise.all([
            getDocs(collection(firestore, 'productos')),
            getDocs(collection(firestore, 'banners'))
        ]);

        const urlsEnUso = new Set();

        prodSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.imageUrl) urlsEnUso.add(String(data.imageUrl));
            if (data.imagenUrl) urlsEnUso.add(String(data.imagenUrl));
            if (data.thumbnailUrl) urlsEnUso.add(String(data.thumbnailUrl));
        });

        bannerSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.imageUrl) urlsEnUso.add(String(data.imageUrl));
            if (data.imagenUrl) urlsEnUso.add(String(data.imagenUrl));
        });

        // Incluir también URLs de SQLite local por máxima seguridad
        try {
            const prodLocales = db.prepare('SELECT imageUrl, imagenUrl, thumbnailUrl FROM productos').all();
            prodLocales.forEach(p => {
                if (p.imageUrl) urlsEnUso.add(String(p.imageUrl));
                if (p.imagenUrl) urlsEnUso.add(String(p.imagenUrl));
                if (p.thumbnailUrl) urlsEnUso.add(String(p.thumbnailUrl));
            });
            const bannersLocales = db.prepare('SELECT imageUrl, imagenUrl FROM banners').all();
            bannersLocales.forEach(b => {
                if (b.imageUrl) urlsEnUso.add(String(b.imageUrl));
                if (b.imagenUrl) urlsEnUso.add(String(b.imagenUrl));
            });
        } catch (e) {
            console.warn('[Storage Cleanup] Aviso leyendo SQLite local:', e.message);
        }

        // 2. Listar y auditar carpetas 'productos' y 'banners'
        const carpetas = ['productos', 'banners'];
        let totalEliminados = 0;
        let totalAnalizados = 0;

        for (const carpeta of carpetas) {
            const folderRef = ref(storage, carpeta);
            try {
                const res = await listAll(folderRef);
                totalAnalizados += res.items.length;

                for (const itemRef of res.items) {
                    const itemFullPath = itemRef.fullPath; // ej: "banners/GEN-UTJD.webp"
                    const encodedFullPath = encodeURIComponent(itemFullPath);

                    // Verificar si el archivo está en uso por alguna URL
                    const enUso = Array.from(urlsEnUso).some(url => 
                        url.includes(itemFullPath) || 
                        url.includes(encodedFullPath)
                    );

                    if (!enUso) {
                        console.log(`[Storage Cleanup] 🗑️ Eliminando archivo huérfano: ${itemFullPath}`);
                        await deleteObject(itemRef);
                        totalEliminados++;
                    }
                }
            } catch (folderErr) {
                console.warn(`[Storage Cleanup] Aviso escaneando carpeta ${carpeta}:`, folderErr.message);
            }
        }

        console.log(`[Storage Cleanup] ✅ Finalizado: ${totalEliminados} archivos eliminados de ${totalAnalizados} analizados.`);
        return {
            success: true,
            totalAnalizados,
            totalEliminados,
            totalConservados: totalAnalizados - totalEliminados
        };
    } catch (err) {
        console.error('[Storage Cleanup] Error:', err);
        return { success: false, error: err.message };
    }
}

// ====================================================================
// DESCARGA COMPLETA DESDE FIREBASE → SQLite
// ====================================================================
async function descargarDatosDesdeNube() {
    if (!firestore) return { success: false, error: 'Firebase no está configurado.' };
    
    // Validar autenticación antes de intentar descargar datos protegidos (como ventas)
    if (!auth || !auth.currentUser) {
        return { 
            success: false, 
            error: 'Sesión en la nube no activa. Por seguridad, por favor cierra sesión en la aplicación (menú usuario) y vuelve a ingresar con tu contraseña para descargar la base de datos.' 
        };
    }
    try {
        console.log("Descargando base de datos completa desde Firebase...");
        
        // 1. Descargar Productos
        const prodSnap = await getDocs(collection(firestore, 'productos'));
        const productos = [];
        prodSnap.forEach(d => {
            // El ID del documento en Firestore SIEMPRE prevalece sobre cualquier
            // campo 'id' que pueda estar dentro del body del documento.
            // Esto garantiza coherencia entre SQLite y Firestore.
            const bodyData = d.data();
            productos.push({ ...bodyData, id: d.id });
        });

        // 2. Descargar Usuarios
        const userSnap = await getDocs(collection(firestore, 'usuarios'));
        const usuarios = [];
        userSnap.forEach(d => usuarios.push({ id: d.id, ...d.data() }));

        // 3. Descargar Banners
        const bannerSnap = await getDocs(collection(firestore, 'banners'));
        const banners = [];
        bannerSnap.forEach(d => banners.push({ id: d.id, ...d.data() }));

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
            
            // Optimización Anti-N+1: Si la venta ya incluye 'items' o 'detalles' en su raíz,
            // leerlos directamente sin realizar peticiones HTTP adicionales a subcolecciones
            if (Array.isArray(v.items) && v.items.length > 0) {
                detalles.push(...v.items);
            } else if (Array.isArray(v.detalles) && v.detalles.length > 0) {
                detalles.push(...v.detalles);
            } else {
                // Fallback de retrocompatibilidad solo para registros legados
                try {
                    const detallesSnap = await getDocs(collection(firestore, `ventas/${ventaId}/detalle`));
                    detallesSnap.forEach(detDoc => {
                        const detData = detDoc.data();
                        if (detData) {
                            if (detDoc.id === 'items' && Array.isArray(detData.items)) {
                                detalles.push(...detData.items);
                            } else if (detData.producto_id || detData.productoId) {
                                detalles.push({
                                    id: detDoc.id || detData.id,
                                    producto_id: detData.producto_id || detData.productoId,
                                    cantidad: Number(detData.cantidad) || 1,
                                    precio_unitario: Number(detData.precio_unitario || detData.precioUnitario || 0),
                                    subtotal: Number(detData.subtotal) || 0
                                });
                            }
                        }
                    });
                } catch (detErr) {
                    console.warn(`[Sync] Detalle de venta omitido para ${ventaId}:`, detErr.message);
                }
            }
            
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

        // 6b. Descargar Turnos y Movimientos de Caja
        let turnos = [];
        try {
            const turnosSnap = await getDocs(collection(firestore, 'caja_turnos'));
            turnosSnap.forEach(d => turnos.push({ id: d.id, ...d.data() }));
        } catch (_) {}

        let movs = [];
        try {
            const movsSnap = await getDocs(collection(firestore, 'caja_movimientos'));
            movsSnap.forEach(d => movs.push({ id: d.id, ...d.data() }));
        } catch (_) {}

        console.log("Descarga de red completada con éxito. Escribiendo de forma atómica en SQLite...");

        // 7. Guardar en SQLite en UNA SOLA TRANSACCIÓN ATÓMICA
        const stmtInsertProd = db.prepare('INSERT OR REPLACE INTO productos (id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, unidadMedida, imagenUrl, thumbnailUrl, imagenLocal, thumbnailLocal, disponible, destacado, etiquetas, esPrincipalWeb, productoPadreId, etiquetaVariante, mostrarPrecioWeb) VALUES (@id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock, @unidadMedida, @imagenUrl, @thumbnailUrl, @imagenLocal, @thumbnailLocal, @disponible, @destacado, @etiquetas, @esPrincipalWeb, @productoPadreId, @etiquetaVariante, @mostrarPrecioWeb)');
        const stmtCheckUser = db.prepare('SELECT password_hash, salt FROM usuarios WHERE id = ? OR username = ? OR (email IS NOT NULL AND LOWER(email) = LOWER(?))');
        const stmtUser = db.prepare('INSERT OR REPLACE INTO usuarios (id, username, email, password_hash, salt, role, permisos, activo, nombreCompleto, pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const stmtBanner = db.prepare('INSERT OR REPLACE INTO banners (id, title, subtitle, imageUrl, imagenLocal, badgeText, ctaText, ctaActionCategory, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const insertVenta = db.prepare('INSERT OR REPLACE INTO ventas (id, fecha, total, metodoPago, estado, clienteNombre, clienteDocumento, anulado, serie, correlativoNumero, numeroTicket) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const insertDetalle = db.prepare('INSERT OR REPLACE INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
        
        const stmtWebConfig = db.prepare('INSERT OR REPLACE INTO web_config (key, value) VALUES (?, ?)');
        const stmtLista = db.prepare('INSERT OR REPLACE INTO compras_listas (id, nombre, fecha, total_estimado, estado) VALUES (?, ?, ?, ?, ?)');
        const stmtDetalleLista = db.prepare('INSERT OR REPLACE INTO compras_listas_detalle (id, lista_id, producto_id, cantidad_pedir, costo_unitario) VALUES (?, ?, ?, ?, ?)');
        const stmtTurno = db.prepare('INSERT OR REPLACE INTO cajas_turnos (id, fechaApertura, fechaCierre, montoInicial, totalVentasEfectivo, totalVentasDigital, totalIngresos, totalEgresos, montoEsperado, montoFinalReal, diferencia, estado, cajero, observaciones) VALUES (@id, @fechaApertura, @fechaCierre, @montoInicial, @totalVentasEfectivo, @totalVentasDigital, @totalIngresos, @totalEgresos, @montoEsperado, @montoFinalReal, @diferencia, @estado, @cajero, @observaciones)');
        const stmtMov = db.prepare('INSERT OR REPLACE INTO cajas_movimientos (id, turnoId, tipo, monto, motivo, fecha) VALUES (@id, @turnoId, @tipo, @monto, @motivo, @fecha)');

        const tx = db.transaction(() => {
            // A. Registrar Usuarios preservando contraseñas locales si ya existen
            for (const u of usuarios) {
                let hash, salt;
                const userId = u.id || u.username || 'admin';
                const username = u.username || u.id || 'admin';
                const email = u.email || null;
                const existing = stmtCheckUser.get(userId, username, email || '');
                
                if (existing) {
                    hash = existing.password_hash;
                    salt = existing.salt;
                } else {
                    const crypto = require('crypto');
                    salt = crypto.randomBytes(16).toString('hex');
                    const tempSecret = crypto.randomBytes(32).toString('hex');
                    hash = crypto.scryptSync(tempSecret, salt, 64).toString('hex');
                }
                
                stmtUser.run(
                    userId, 
                    username, 
                    email,
                    hash, 
                    salt, 
                    u.role || 'colaborador', 
                    u.permisos ? (typeof u.permisos === 'string' ? u.permisos : JSON.stringify(u.permisos)) : null,
                    u.activo !== undefined && u.activo !== null ? (u.activo ? 1 : 0) : 1,
                    u.nombreCompleto || username,
                    u.pin || '1234'
                );
            }

            // Helper de sanitización estricta para columnas de texto de SQLite
            const toStrOrNull = (val) => (typeof val === 'string' && val.trim() !== '' ? val : null);

            // B. Registrar Productos
            for (const p of productos) {
                stmtInsertProd.run({
                    id: typeof p.id === 'string' ? p.id : (p.id || require('crypto').randomUUID()),
                    codigoBarras: toStrOrNull(p.codigoBarras),
                    nombre: typeof p.nombre === 'string' ? p.nombre : '',
                    descripcion: toStrOrNull(p.descripcion),
                    categoria: typeof p.categoria === 'string' ? p.categoria : 'Abarrotes',
                    precio: (p.precio !== undefined && p.precio !== null) ? Number(p.precio) : 0,
                    costo: (p.costo !== undefined && p.costo !== null) ? Number(p.costo) : null,
                    stock: (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0,
                    unidadMedida: typeof p.unidadMedida === 'string' ? p.unidadMedida : 'unidad',
                    imagenUrl: toStrOrNull(p.imagenUrl) || toStrOrNull(p.imageUrl),
                    thumbnailUrl: toStrOrNull(p.thumbnailUrl),
                    imagenLocal: toStrOrNull(p.imagenLocal),
                    thumbnailLocal: toStrOrNull(p.thumbnailLocal),
                    disponible: (p.disponible !== false && p.disponible !== 0 && p.disponible !== '0') ? 1 : 0,
                    destacado: (p.destacado === true || p.destacado === 1 || p.destacado === '1' || p.destacado === 'true') ? 1 : 0,
                    etiquetas: p.etiquetas ? (typeof p.etiquetas === 'string' ? p.etiquetas : JSON.stringify(p.etiquetas)) : null,
                    esPrincipalWeb: (p.esPrincipalWeb === true || p.esPrincipalWeb === 1 || p.esPrincipalWeb === '1' || p.esPrincipalWeb === 'true') ? 1 : 0,
                    productoPadreId: toStrOrNull(p.productoPadreId),
                    etiquetaVariante: toStrOrNull(p.etiquetaVariante),
                    mostrarPrecioWeb: (p.mostrarPrecioWeb === true || p.mostrarPrecioWeb === 1 || p.mostrarPrecioWeb === '1' || p.mostrarPrecioWeb === 'true') ? 1 : 0
                });
            }

            // C. Registrar Banners
            for (const b of banners) {
                stmtBanner.run(
                    typeof b.id === 'string' ? b.id : (b.id || require('crypto').randomUUID()),
                    typeof b.title === 'string' ? b.title : '',
                    toStrOrNull(b.subtitle),
                    toStrOrNull(b.imageUrl) || toStrOrNull(b.imagenUrl),
                    toStrOrNull(b.imagenLocal),
                    toStrOrNull(b.badgeText),
                    toStrOrNull(b.ctaText) || 'Ver más',
                    toStrOrNull(b.ctaActionCategory) || 'Todas',
                    (b.active === undefined || b.active === true || b.active === 1 || b.active === '1') ? 1 : 0,
                    (b.priority !== undefined && b.priority !== null) ? Number(b.priority) : 0
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

                const serie = v.serie || 'B001';
                const correlativoNumero = Number(v.correlativoNumero) || 1;
                const numeroTicket = v.numeroTicket || `${serie}-${correlativoNumero.toString().padStart(8, '0')}`;

                insertVenta.run(
                    ventaId,
                    fechaSql,
                    (v.total !== undefined && v.total !== null) ? Number(v.total) : 0,
                    v.metodoPago || 'Efectivo',
                    v.estado || 'completada',
                    v.clienteNombre || null,
                    v.clienteDocumento || null,
                    (v.anulado === true || v.anulado === 1) ? 1 : 0,
                    serie,
                    correlativoNumero,
                    numeroTicket
                );

                if (Array.isArray(itemVenta.detalles)) {
                    for (const d of itemVenta.detalles) {
                        insertDetalle.run(
                            d.id || require('crypto').randomUUID(),
                            ventaId,
                            d.producto_id || d.productoId || '',
                            (d.cantidad !== undefined && d.cantidad !== null) ? Number(d.cantidad) : 1,
                            (d.precio_unitario !== undefined && d.precio_unitario !== null) ? Number(d.precio_unitario) : (d.precioUnitario || 0),
                            (d.subtotal !== undefined && d.subtotal !== null) ? Number(d.subtotal) : 0
                        );
                    }
                }
            }

            // E. Registrar Web Config
            for (const wc of webConfig) {
                stmtWebConfig.run(wc.key || '', wc.value || '{}');
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
                    (l.total_estimado !== undefined && l.total_estimado !== null) ? Number(l.total_estimado) : 0,
                    l.estado || 'pendiente'
                );

                if (l.detalles && Array.isArray(l.detalles)) {
                    for (const d of l.detalles) {
                        stmtDetalleLista.run(
                            d.id || require('crypto').randomUUID(),
                            listaId,
                            d.producto_id || d.productoId || '',
                            (d.cantidad_pedir !== undefined && d.cantidad_pedir !== null) ? Number(d.cantidad_pedir) : ((d.cantidad !== undefined && d.cantidad !== null) ? Number(d.cantidad) : 0),
                            (d.costo_unitario !== undefined && d.costo_unitario !== null) ? Number(d.costo_unitario) : 0
                        );
                    }
                }
            }

            // G. Registrar Turnos y Movimientos de Caja
            for (const t of turnos) {
                stmtTurno.run({
                    id: t.id,
                    fechaApertura: t.fechaApertura || new Date().toISOString(),
                    fechaCierre: t.fechaCierre || null,
                    montoInicial: Number(t.montoInicial) || 0,
                    totalVentasEfectivo: Number(t.totalVentasEfectivo) || 0,
                    totalVentasDigital: Number(t.totalVentasDigital) || 0,
                    totalIngresos: Number(t.totalIngresos) || 0,
                    totalEgresos: Number(t.totalEgresos) || 0,
                    montoEsperado: Number(t.montoEsperado) || 0,
                    montoFinalReal: (t.montoFinalReal !== undefined && t.montoFinalReal !== null) ? Number(t.montoFinalReal) : null,
                    diferencia: (t.diferencia !== undefined && t.diferencia !== null) ? Number(t.diferencia) : null,
                    estado: t.estado || 'abierta',
                    cajero: t.cajero || 'Cajero Principal',
                    observaciones: t.observaciones || null
                });
            }

            for (const m of movs) {
                stmtMov.run({
                    id: m.id,
                    turnoId: m.turnoId,
                    tipo: m.tipo || 'ingreso',
                    monto: Number(m.monto) || 0,
                    motivo: m.motivo || 'Movimiento',
                    fecha: m.fecha || new Date().toISOString()
                });
            }
        });
        
        tx();
        console.log("Base de datos escrita y guardada localmente con éxito.");
        setSyncMeta('last_products_sync', new Date().toISOString());

        // Cachear imágenes a disco local en segundo plano
        setTimeout(() => {
            for (const p of productos) {
                if (p.imagenUrl && (!p.imagenLocal || !p.imagenLocal.startsWith('local-img://'))) {
                    descargarYCachearImagen(p.id, p.imagenUrl).catch(() => {});
                }
            }
        }, 1000);

        return { success: true };
    } catch (e) {
        console.error('Error durante la descarga de datos:', e);
        return { success: false, error: `Error en red o permisos: ${e.message}` };
    }
}

module.exports = {
    startSyncWorker,
    sincronizarCola,
    setMainWindow,
    iniciarEscuchaTiempoReal,
    detenerEscuchaTiempoReal,
    get app() { return app; },
    loginConFirebase,
    subirImagenStorage,
    getFirebaseConfig,
    saveFirebaseConfig,
    descargarDatosDesdeNube,
    obtenerDashboardData,
    crearUsuarioAuth,
    buildAuthEmail,
    repararEmbeddingsNube,
    limpiarArchivosHuerfanosStorage
};
