const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let app;
try {
    app = require('electron').app;
} catch (_) {}

// Obtener la ruta de la base de datos (segura en producción y pruebas)
const dbDir = (app && typeof app.getPath === 'function' && app.isPackaged) ? app.getPath('userData') : __dirname;
const dbPath = path.join(dbDir, 'pos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Inicializar base de datos
const db = new Database(dbPath, { 
    // verbose: console.log 
});

// Habilitar WAL mode para mayor concurrencia y velocidad
db.pragma('journal_mode = WAL');

// Inicializar esquema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migraciones de Base de Datos
const migrations = [
    // Version 1
    () => {
        db.exec("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1");
    },
    // Version 2
    () => {
        db.exec("ALTER TABLE ventas ADD COLUMN clienteNombre TEXT");
        db.exec("ALTER TABLE ventas ADD COLUMN clienteDocumento TEXT");
    },
    // Version 3
    () => {
        db.exec("ALTER TABLE productos ADD COLUMN thumbnailUrl TEXT");
        db.exec("ALTER TABLE productos ADD COLUMN imagenLocal TEXT");
        db.exec("ALTER TABLE productos ADD COLUMN thumbnailLocal TEXT");
    },
    // Version 4
    () => {
        db.exec("ALTER TABLE banners ADD COLUMN imagenLocal TEXT");
    },
    // Version 5
    () => {
        db.exec("CREATE TABLE IF NOT EXISTS correlativos (serie TEXT PRIMARY KEY, siguiente_numero INTEGER DEFAULT 1)");
        db.exec("INSERT OR IGNORE INTO correlativos (serie, siguiente_numero) VALUES ('B001', 1)");
    },
    // Version 6 (Deprecada: analytics_events eliminada)
    () => {
        db.exec("DROP TABLE IF EXISTS analytics_events");
    },
    // Version 7
    () => {
        db.exec("ALTER TABLE ventas ADD COLUMN anulado INTEGER DEFAULT 0");
    },
    // Version 8 — Índice compuesto para UPSERT eficiente en sync_queue
    () => {
        db.exec("CREATE INDEX IF NOT EXISTS idx_sync_queue_entidad_estado ON sync_queue(entidad, entidad_id, estado_sync)");
    },
    // Version 9 — Columna email e índice en usuarios para login con correo
    () => {
        db.exec("ALTER TABLE usuarios ADD COLUMN email TEXT");
        db.exec("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)");
    },
    // Version 10 — Catálogo Web / Familias de Productos y Control de Precios
    () => {
        db.exec("ALTER TABLE productos ADD COLUMN esPrincipalWeb INTEGER DEFAULT 0");
        db.exec("ALTER TABLE productos ADD COLUMN productoPadreId TEXT");
        db.exec("ALTER TABLE productos ADD COLUMN etiquetaVariante TEXT");
        db.exec("ALTER TABLE productos ADD COLUMN mostrarPrecioWeb INTEGER DEFAULT 0");
        db.exec("CREATE INDEX IF NOT EXISTS idx_productos_padre ON productos(productoPadreId)");
    },
    // Version 11 — Por defecto no disponibles en web excepto entes de familia
    () => {
        db.exec("UPDATE productos SET disponible = 0 WHERE (esPrincipalWeb = 0 OR esPrincipalWeb IS NULL)");
        db.exec("UPDATE productos SET disponible = 1 WHERE esPrincipalWeb = 1");
    },
    // Version 12 — Control de Cajas, Turnos, Arqueo y Movimientos de Efectivo + Restauración de disponible
    () => {
        db.exec("UPDATE productos SET disponible = 1 WHERE disponible = 0 AND (esPrincipalWeb = 0 OR esPrincipalWeb IS NULL)");
        db.exec(`
            CREATE TABLE IF NOT EXISTS cajas_turnos (
                id TEXT PRIMARY KEY,
                fechaApertura TEXT NOT NULL,
                fechaCierre TEXT,
                montoInicial REAL NOT NULL,
                totalVentasEfectivo REAL DEFAULT 0.0,
                totalVentasDigital REAL DEFAULT 0.0,
                totalIngresos REAL DEFAULT 0.0,
                totalEgresos REAL DEFAULT 0.0,
                montoEsperado REAL DEFAULT 0.0,
                montoFinalReal REAL,
                diferencia REAL,
                estado TEXT DEFAULT 'abierta',
                cajero TEXT DEFAULT 'Cajero Principal',
                observaciones TEXT,
                creado_el DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        db.exec(`
            CREATE TABLE IF NOT EXISTS cajas_movimientos (
                id TEXT PRIMARY KEY,
                turnoId TEXT NOT NULL,
                tipo TEXT NOT NULL,
                monto REAL NOT NULL,
                motivo TEXT NOT NULL,
                fecha TEXT NOT NULL,
                FOREIGN KEY(turnoId) REFERENCES cajas_turnos(id) ON DELETE CASCADE
            )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_cajas_movimientos_turno ON cajas_movimientos(turnoId)");
    },
    // Version 13 — Homologación total con AE_POS e índices de alto rendimiento
    () => {
        try { db.exec("ALTER TABLE ventas ADD COLUMN serie TEXT DEFAULT 'B001'"); } catch (_) {}
        try { db.exec("ALTER TABLE ventas ADD COLUMN correlativoNumero INTEGER DEFAULT 1"); } catch (_) {}
        try { db.exec("ALTER TABLE ventas ADD COLUMN numeroTicket TEXT"); } catch (_) {}
        try { db.exec("ALTER TABLE usuarios ADD COLUMN nombreCompleto TEXT DEFAULT 'Usuario'"); } catch (_) {}
        try { db.exec("ALTER TABLE usuarios ADD COLUMN pin TEXT DEFAULT '1234'"); } catch (_) {}
        db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_detalle_venta ON ventas_detalle(venta_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_detalle_producto ON ventas_detalle(producto_id)");
    },
    // Version 14 — Tabla sync_meta para Delta Sync y control de versiones
    () => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS sync_meta (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
        `);
    }
];

const currentVersion = db.pragma('user_version', { simple: true });
if (currentVersion < migrations.length) {
    console.log(`Migrating database from version ${currentVersion} to ${migrations.length}...`);
    const transaction = db.transaction(() => {
        for (let i = currentVersion; i < migrations.length; i++) {
            try {
                migrations[i]();
            } catch (err) {
                // Ignore "duplicate column" errors in case schema was partially applied before this system
                if (!err.message.includes('duplicate column name')) {
                    throw err;
                }
            }
        }
        db.pragma(`user_version = ${migrations.length}`);
    });
    transaction();
    console.log('Database migrations completed successfully.');
}


// --- Funciones CRUD de Productos ---

const stmtBuscarProductoPorCodigo = db.prepare(`
    SELECT p.*,
           COALESCE(p.imagenUrl, padre.imagenUrl) AS imagenUrl,
           COALESCE(p.thumbnailUrl, padre.thumbnailUrl) AS thumbnailUrl,
           COALESCE(p.imagenLocal, padre.imagenLocal) AS imagenLocal,
           COALESCE(p.thumbnailLocal, padre.thumbnailLocal) AS thumbnailLocal
    FROM productos p
    LEFT JOIN productos padre ON p.productoPadreId = padre.id
    WHERE p.codigoBarras = ? AND (p.esPrincipalWeb = 0 OR p.esPrincipalWeb IS NULL)
`);

const stmtBuscarProductosPorNombre = db.prepare(`
    SELECT p.*,
           COALESCE(p.imagenUrl, padre.imagenUrl) AS imagenUrl,
           COALESCE(p.thumbnailUrl, padre.thumbnailUrl) AS thumbnailUrl,
           COALESCE(p.imagenLocal, padre.imagenLocal) AS imagenLocal,
           COALESCE(p.thumbnailLocal, padre.thumbnailLocal) AS thumbnailLocal
    FROM productos p
    LEFT JOIN productos padre ON p.productoPadreId = padre.id
    WHERE (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigoBarras LIKE ?)
      AND (p.esPrincipalWeb = 0 OR p.esPrincipalWeb IS NULL)
    LIMIT 20
`);

function buscarProductoPorCodigo(codigo) {
    return stmtBuscarProductoPorCodigo.get(codigo);
}

function buscarProductosPorNombre(nombre) {
    const term = `%${nombre}%`;
    return stmtBuscarProductosPorNombre.all(term, term, term);
}

function obtenerProductosParaVenta() {
    return db.prepare(`
        SELECT p.*,
               COALESCE(p.imagenUrl, padre.imagenUrl) AS imagenUrl,
               COALESCE(p.thumbnailUrl, padre.thumbnailUrl) AS thumbnailUrl,
               COALESCE(p.imagenLocal, padre.imagenLocal) AS imagenLocal,
               COALESCE(p.thumbnailLocal, padre.thumbnailLocal) AS thumbnailLocal
        FROM productos p
        LEFT JOIN productos padre ON p.productoPadreId = padre.id
        WHERE (p.esPrincipalWeb = 0 OR p.esPrincipalWeb IS NULL)
          AND (p.disponible = 1 OR p.disponible IS NULL)
        ORDER BY p.destacado DESC, p.nombre ASC
    `).all();
}

function obtenerTodosProductos() {
    return db.prepare(`
        SELECT p.*, 
               (SELECT COUNT(*) FROM sync_queue WHERE entidad = 'producto' AND entidad_id = p.id AND estado_sync = 0) as pendienteSync
        FROM productos p 
        ORDER BY p.nombre ASC
    `).all();
}

function crearProducto(producto, isFromSync = false) {
    try {
        const stmt = db.prepare(`
            INSERT INTO productos (
                id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, 
                unidadMedida, imagenUrl, thumbnailUrl, imagenLocal, thumbnailLocal, 
                disponible, destacado, etiquetas, esPrincipalWeb, productoPadreId, etiquetaVariante, mostrarPrecioWeb
            ) 
            VALUES (
                @id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock, 
                @unidadMedida, @imagenUrl, @thumbnailUrl, @imagenLocal, @thumbnailLocal, 
                @disponible, @destacado, @etiquetas, @esPrincipalWeb, @productoPadreId, @etiquetaVariante, @mostrarPrecioWeb
            )
        `);
        
        const data = {
            id: producto.id || crypto.randomUUID(),
            codigoBarras: (producto.codigoBarras && producto.codigoBarras.trim() !== '') ? producto.codigoBarras : null,
            nombre: producto.nombre || '',
            descripcion: producto.descripcion || null,
            categoria: producto.categoria || 'Abarrotes',
            precio: Number(producto.precio ?? 0),
            costo: producto.costo !== undefined && producto.costo !== null ? Number(producto.costo) : null,
            stock: Number(producto.stock ?? 0),
            unidadMedida: producto.unidadMedida || 'unidad',
            imagenUrl: producto.imagenUrl || null,
            thumbnailUrl: producto.thumbnailUrl || null,
            imagenLocal: producto.imagenLocal || null,
            thumbnailLocal: producto.thumbnailLocal || null,
            disponible: producto.disponible ? 1 : 0,
            destacado: producto.destacado ? 1 : 0,
            etiquetas: producto.etiquetas ? JSON.stringify(producto.etiquetas) : null,
            esPrincipalWeb: producto.esPrincipalWeb ? 1 : 0,
            productoPadreId: producto.productoPadreId || null,
            etiquetaVariante: producto.etiquetaVariante || null,
            mostrarPrecioWeb: producto.mostrarPrecioWeb ? 1 : 0
        };
        
        stmt.run(data);
        
        // Agregar a Sync Queue solo si no viene de Firestore.
        // Normalizar booleans en el payload de Firebase.
        if (!isFromSync) {
            const syncData = { 
                ...data, 
                disponible: Boolean(data.disponible), 
                destacado: Boolean(data.destacado),
                esPrincipalWeb: Boolean(data.esPrincipalWeb),
                mostrarPrecioWeb: Boolean(data.mostrarPrecioWeb)
            };
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'producto', data.id, 'INSERT', JSON.stringify(syncData)
            );
        }
        
        return { success: true, id: data.id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function actualizarProducto(producto, isFromSync = false) {
    try {
        const stmt = db.prepare(`
            UPDATE productos 
            SET codigoBarras = @codigoBarras, nombre = @nombre, descripcion = @descripcion, 
                categoria = @categoria, precio = @precio, costo = @costo, stock = @stock, 
                unidadMedida = @unidadMedida, imagenUrl = @imagenUrl, thumbnailUrl = @thumbnailUrl, 
                imagenLocal = @imagenLocal, thumbnailLocal = @thumbnailLocal, disponible = @disponible, 
                destacado = @destacado, etiquetas = @etiquetas, esPrincipalWeb = @esPrincipalWeb,
                productoPadreId = @productoPadreId, etiquetaVariante = @etiquetaVariante,
                mostrarPrecioWeb = @mostrarPrecioWeb
            WHERE id = @id
        `);
        
        const data = {
            id: producto.id,
            codigoBarras: (producto.codigoBarras && producto.codigoBarras.trim() !== '') ? producto.codigoBarras : null,
            nombre: producto.nombre || '',
            descripcion: producto.descripcion || null,
            categoria: producto.categoria || 'Abarrotes',
            precio: Number(producto.precio ?? 0),
            costo: producto.costo !== undefined && producto.costo !== null ? Number(producto.costo) : null,
            stock: Number(producto.stock ?? 0),
            unidadMedida: producto.unidadMedida || 'unidad',
            imagenUrl: producto.imagenUrl || null,
            thumbnailUrl: producto.thumbnailUrl || null,
            imagenLocal: producto.imagenLocal || null,
            thumbnailLocal: producto.thumbnailLocal || null,
            disponible: producto.disponible ? 1 : 0,
            destacado: producto.destacado ? 1 : 0,
            etiquetas: producto.etiquetas ? JSON.stringify(producto.etiquetas) : null,
            esPrincipalWeb: producto.esPrincipalWeb ? 1 : 0,
            productoPadreId: producto.productoPadreId || null,
            etiquetaVariante: producto.etiquetaVariante || null,
            mostrarPrecioWeb: producto.mostrarPrecioWeb ? 1 : 0
        };
        
        const info = stmt.run(data);
        
        if (info.changes > 0) {
            // Agregar a Sync Queue solo si no viene de Firestore.
            // UPSERT: si ya existe una entrada pendiente para este producto, actualizarla
            // en lugar de insertar otra — evita múltiples writes a Firestore por la misma entidad.
            if (!isFromSync) {
                const syncData = { 
                    ...data, 
                    disponible: Boolean(data.disponible), 
                    destacado: Boolean(data.destacado),
                    esPrincipalWeb: Boolean(data.esPrincipalWeb),
                    mostrarPrecioWeb: Boolean(data.mostrarPrecioWeb)
                };
                const syncPayload = JSON.stringify(syncData);
                const existing = db.prepare(
                    "SELECT id FROM sync_queue WHERE entidad = 'producto' AND entidad_id = ? AND estado_sync = 0 ORDER BY fecha_creacion DESC LIMIT 1"
                ).get(data.id);
                if (existing) {
                    // Actualizar la entrada pendiente existente con los datos más recientes
                    db.prepare(
                        "UPDATE sync_queue SET operacion = 'UPDATE', datos_json = ?, fecha_creacion = CURRENT_TIMESTAMP, intentos = 0 WHERE id = ?"
                    ).run(syncPayload, existing.id);
                } else {
                    db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                        'producto', data.id, 'UPDATE', syncPayload
                    );
                }
            }
            return { success: true };
        } else {
            return { success: false, error: 'Producto no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarProducto(id, isFromSync = false) {
    try {
        // Verificar si el producto tiene ventas asociadas antes de intentar eliminar
        const ventasCount = db.prepare('SELECT COUNT(*) as count FROM ventas_detalle WHERE producto_id = ?').get(id);
        if (ventasCount && ventasCount.count > 0) {
            return { success: false, error: 'TIENE_VENTAS', ventasCount: ventasCount.count };
        }

        const info = db.prepare('DELETE FROM productos WHERE id = ?').run(id);
        
        if (info.changes > 0) {
            // Si el producto era una familia padre, desvincular a sus hijos
            db.prepare('UPDATE productos SET productoPadreId = NULL, etiquetaVariante = NULL WHERE productoPadreId = ?').run(id);
            
            // Agregar a Sync Queue solo si no viene de Firestore
            if (!isFromSync) {
                db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                    'producto', id, 'DELETE', JSON.stringify({ id })
                );
            }
            return { success: true };
        } else {
            return { success: false, error: 'Producto no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function obtenerPresentacionesDeFamilia(familiaId) {
    try {
        return db.prepare('SELECT * FROM productos WHERE productoPadreId = ? ORDER BY nombre ASC').all(familiaId);
    } catch (err) {
        console.error('Error en obtenerPresentacionesDeFamilia:', err);
        return [];
    }
}

function guardarFamiliaConPresentaciones(familiaData, presentaciones = []) {
    try {
        const tx = db.transaction(() => {
            const familiaId = familiaData.id || require('crypto').randomUUID();
            const productoFamilia = {
                ...familiaData,
                id: familiaId,
                codigoBarras: null,
                esPrincipalWeb: 1,
                precio: Number(familiaData.precio || 0),
                costo: null,
                stock: Number(familiaData.stock || 0),
                unidadMedida: familiaData.unidadMedida || 'unidad',
                disponible: familiaData.disponible !== false ? 1 : 0,
                destacado: familiaData.destacado ? 1 : 0,
                mostrarPrecioWeb: familiaData.mostrarPrecioWeb ? 1 : 0,
                productoPadreId: null,
                etiquetaVariante: null
            };

            const existing = db.prepare('SELECT id FROM productos WHERE id = ?').get(familiaId);
            if (existing) {
                actualizarProducto(productoFamilia);
            } else {
                crearProducto(productoFamilia);
            }

            // 1. Obtener los productos que estaban asociados a esta familia antes
            const anteriores = db.prepare('SELECT id FROM productos WHERE productoPadreId = ?').all(familiaId);
            const nuevosIds = new Set(presentaciones.map(p => p.id));

            // 2. Desvincular los que ya no están
            for (const ant of anteriores) {
                if (!nuevosIds.has(ant.id)) {
                    db.prepare('UPDATE productos SET productoPadreId = NULL, etiquetaVariante = NULL WHERE id = ?').run(ant.id);
                    const prodActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(ant.id);
                    if (prodActualizado) {
                        actualizarProducto(prodActualizado);
                    }
                }
            }

            // 3. Vincular y actualizar etiqueta de las presentaciones actuales
            for (const pres of presentaciones) {
                if (pres.id && pres.id !== familiaId) {
                    db.prepare('UPDATE productos SET productoPadreId = ?, etiquetaVariante = ? WHERE id = ?').run(
                        familiaId,
                        pres.etiquetaVariante || null,
                        pres.id
                    );
                    const prodActualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(pres.id);
                    if (prodActualizado) {
                        actualizarProducto(prodActualizado);
                    }
                }
            }

            return { success: true, id: familiaId };
        });

        return tx();
    } catch (err) {
        console.error('Error en guardarFamiliaConPresentaciones:', err);
        return { success: false, error: err.message };
    }
}

// --- Funciones de Usuarios (Auth y RBAC) ---

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

function verifyPassword(password, hash, salt) {
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return verifyHash === hash;
}

function login(identifier, password) {
    const term = (identifier || '').trim();
    const user = db.prepare('SELECT * FROM usuarios WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)) OR id = ?').get(term, term, term);
    if (!user) return { success: false, error: 'Usuario o correo incorrecto' };
    
    // Validar si el usuario está activo
    if (user.activo !== undefined && user.activo === 0) {
        return { success: false, error: 'Usuario desactivado. Hable con el administrador.' };
    }
    
    const isValidPass = verifyPassword(password, user.password_hash, user.salt);
    const isValidPin = user.pin && user.pin === password;

    if (isValidPass || isValidPin) {
        // Retornar usuario sin datos sensibles
        const { password_hash: _password_hash, salt: _salt, ...safeUser } = user;
        if (safeUser.permisos) {
            try {
                if (typeof safeUser.permisos === 'string') safeUser.permisos = JSON.parse(safeUser.permisos);
            } catch {
                safeUser.permisos = ['all'];
            }
        } else {
            safeUser.permisos = safeUser.role === 'admin' ? ['all'] : [];
        }
        return { success: true, user: safeUser };
    }
    return { success: false, error: 'Contraseña o PIN incorrecto' };
}

function loginConPin(pin) {
    const user = db.prepare('SELECT * FROM usuarios WHERE pin = ? AND (activo = 1 OR activo IS NULL)').get(pin);
    if (!user) return { success: false, error: 'PIN incorrecto o usuario inactivo' };
    const { password_hash: _password_hash, salt: _salt, ...safeUser } = user;
    if (safeUser.permisos) {
        try {
            if (typeof safeUser.permisos === 'string') safeUser.permisos = JSON.parse(safeUser.permisos);
        } catch {
            safeUser.permisos = ['all'];
        }
    } else {
        safeUser.permisos = safeUser.role === 'admin' ? ['all'] : [];
    }
    return { success: true, user: safeUser };
}

function obtenerUsuarios() {
    const users = db.prepare(`
        SELECT u.id, u.username, u.email, u.role, u.permisos, u.activo, u.fecha_creacion, u.nombreCompleto, u.pin,
               (SELECT COUNT(*) FROM sync_queue WHERE entidad = 'usuario' AND entidad_id = u.id AND estado_sync = 0) as pendienteSync
        FROM usuarios u 
        ORDER BY u.username ASC
    `).all();
    return users.map(u => ({ ...u, permisos: u.permisos ? JSON.parse(u.permisos) : [] }));
}

function crearUsuario(userData, password) {
    try {
        const { salt, hash } = hashPassword(password);
        const nombreCompleto = userData.nombreCompleto || userData.username;
        const pin = userData.pin || '1234';
        db.prepare('INSERT INTO usuarios (id, username, email, password_hash, salt, role, permisos, activo, nombreCompleto, pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            userData.id, userData.username, userData.email || null, hash, salt, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1, nombreCompleto, pin
        );

        // Agregar a Sync Queue
        const syncData = { ...userData, nombreCompleto, pin };
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'usuario', userData.id, 'INSERT', JSON.stringify(syncData)
        );

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function actualizarUsuario(userData, newPassword = null) {
    try {
        const activoVal = userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1;
        const nombreCompleto = userData.nombreCompleto !== undefined ? userData.nombreCompleto : null;
        const pin = userData.pin !== undefined ? userData.pin : null;
        let info;
        if (newPassword && newPassword.trim() !== '') {
            const { salt, hash } = hashPassword(newPassword);
            info = db.prepare('UPDATE usuarios SET username = ?, email = ?, role = ?, permisos = ?, password_hash = ?, salt = ?, activo = ?, nombreCompleto = COALESCE(?, nombreCompleto), pin = COALESCE(?, pin) WHERE id = ?').run(
                userData.username, userData.email || null, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, hash, salt, activoVal, nombreCompleto, pin, userData.id
            );
        } else {
            info = db.prepare('UPDATE usuarios SET username = ?, email = ?, role = ?, permisos = ?, activo = ?, nombreCompleto = COALESCE(?, nombreCompleto), pin = COALESCE(?, pin) WHERE id = ?').run(
                userData.username, userData.email || null, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, activoVal, nombreCompleto, pin, userData.id
            );
        }

        if (info.changes > 0) {
            // Agregar a Sync Queue
            const syncData = { ...userData };
            if (newPassword && newPassword.trim() !== '') syncData.password = newPassword;
            if (nombreCompleto) syncData.nombreCompleto = nombreCompleto;
            if (pin) syncData.pin = pin;
            
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'usuario', userData.id, 'UPDATE', JSON.stringify(syncData)
            );
            return { success: true };
        } else {
            return { success: false, error: 'Usuario no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarUsuario(id) {
    try {
        // Prevenir borrar al único admin
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin'").get().count;
        const user = db.prepare("SELECT role FROM usuarios WHERE id = ?").get(id);
        if (user && user.role === 'admin' && adminCount <= 1) {
            return { success: false, error: 'No puedes eliminar al último administrador.' };
        }
        
        const info = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

        if (info.changes > 0) {
            // Agregar a Sync Queue
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'usuario', id, 'DELETE', JSON.stringify({ id })
            );
            return { success: true };
        } else {
            return { success: false, error: 'Usuario no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// --- Funciones de Ventas ---

function obtenerVentas(filtros = {}) {
    try {
        let query = 'SELECT * FROM ventas WHERE 1=1';
        const params = [];

        if (filtros.fechaInicio) {
            query += ' AND date(fecha) >= date(?)';
            params.push(filtros.fechaInicio);
        }
        if (filtros.fechaFin) {
            query += ' AND date(fecha) <= date(?)';
            params.push(filtros.fechaFin);
        }
        if (filtros.ticketId) {
            query += ' AND id LIKE ?';
            params.push(`%${filtros.ticketId}%`);
        }
        if (filtros.minMonto !== undefined && filtros.minMonto !== '') {
            query += ' AND total >= ?';
            params.push(parseFloat(filtros.minMonto));
        }
        if (filtros.maxMonto !== undefined && filtros.maxMonto !== '') {
            query += ' AND total <= ?';
            params.push(parseFloat(filtros.maxMonto));
        }
        if (filtros.metodoPago && filtros.metodoPago !== 'todos') {
            query += ' AND metodoPago = ?';
            params.push(filtros.metodoPago);
        }
        if (filtros.estado && filtros.estado !== 'todos') {
            if (filtros.estado === 'anuladas') {
                query += ' AND anulado = 1';
            } else if (filtros.estado === 'completadas') {
                query += ' AND anulado = 0';
            }
        }

        query += ' ORDER BY fecha DESC LIMIT 150';

        const ventas = db.prepare(query).all(...params);

        // Cargar detalles de todas las ventas en una sola query JOIN para evitar N+1
        if (ventas.length === 0) return { success: true, ventas: [] };

        const ventaIds = ventas.map(v => v.id);
        const placeholders = ventaIds.map(() => '?').join(',');
        const todosDetalles = db.prepare(`
            SELECT d.*, p.nombre as producto_nombre 
            FROM ventas_detalle d 
            LEFT JOIN productos p ON d.producto_id = p.id 
            WHERE d.venta_id IN (${placeholders})
        `).all(...ventaIds);

        // Agrupar detalles por venta_id en memoria
        const detallesPorVenta = {};
        for (const det of todosDetalles) {
            if (!detallesPorVenta[det.venta_id]) detallesPorVenta[det.venta_id] = [];
            detallesPorVenta[det.venta_id].push(det);
        }
        for (const venta of ventas) {
            venta.detalles = detallesPorVenta[venta.id] || [];
        }

        return { success: true, ventas };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function guardarVenta(ventaParams, detalleVenta) {
    // Usar transacción para asegurar atomicidad
    const insertVenta = db.prepare(`
        INSERT INTO ventas (id, fecha, total, metodoPago, clienteNombre, clienteDocumento, serie, correlativoNumero, numeroTicket) 
        VALUES (@id, @fecha, @total, @metodoPago, @clienteNombre, @clienteDocumento, @serie, @correlativoNumero, @numeroTicket)
    `);
    const insertDetalle = db.prepare('INSERT INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@id, @venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)');
    const updateStock = db.prepare('UPDATE productos SET stock = stock - @cantidad WHERE id = @producto_id');
    const insertSync = db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (@entidad, @entidad_id, @operacion, @datos_json)');
    const getCorrelativo = db.prepare('SELECT siguiente_numero FROM correlativos WHERE serie = ?');

    const tx = db.transaction((vParams, d) => {
        let finalVentaId = vParams.id;
        // Si no se proveyó ID o si se requiere autogenerar (ej. para forzar secuencia)
        // Generaremos el ID secuencial siempre para ventas nuevas desde el POS
        const serie = vParams.serie || 'B001';
        const row = getCorrelativo.get(serie);
        let num = 1;
        if (row) {
            num = row.siguiente_numero;
        }

        const checkExist = db.prepare('SELECT id FROM ventas WHERE id = ?');
        while(true) {
            finalVentaId = `${serie}-${num.toString().padStart(8, '0')}`;
            if (!checkExist.get(finalVentaId)) {
                break;
            }
            num++;
        }
        
        db.prepare('UPDATE correlativos SET siguiente_numero = ? WHERE serie = ?').run(num + 1, serie);

        const v = { 
            ...vParams, 
            id: finalVentaId, 
            fecha: new Date().toISOString(),
            serie: serie,
            correlativoNumero: num,
            numeroTicket: finalVentaId
        };

        insertVenta.run({ 
            id: v.id, 
            fecha: v.fecha,
            total: v.total, 
            metodoPago: v.metodoPago,
            clienteNombre: v.clienteNombre || null,
            clienteDocumento: v.clienteDocumento || null,
            serie: v.serie,
            correlativoNumero: v.correlativoNumero,
            numeroTicket: v.numeroTicket
        });
        
        for (const item of d) {
            insertDetalle.run({
                id: item.id,
                venta_id: v.id,
                producto_id: item.producto_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal
            });
            if (!item.producto_id.startsWith('custom-')) {
                updateStock.run({ cantidad: item.cantidad, producto_id: item.producto_id });
                const prodRow = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.producto_id);
                if (prodRow) {
                    // Normalizar booleanos en el payload de Firebase
                    const prodSyncData = {
                        ...prodRow,
                        _soloStock: true,
                        disponible: Boolean(prodRow.disponible),
                        destacado: Boolean(prodRow.destacado)
                    };
                    const prodSyncPayload = JSON.stringify(prodSyncData);
                    // UPSERT: si ya existe una entrada pendiente para este producto, actualizarla
                    const existingProd = db.prepare(
                        "SELECT id FROM sync_queue WHERE entidad = 'producto' AND entidad_id = ? AND estado_sync = 0 LIMIT 1"
                    ).get(item.producto_id);
                    if (existingProd) {
                        db.prepare(
                            "UPDATE sync_queue SET datos_json = ?, fecha_creacion = CURRENT_TIMESTAMP, intentos = 0 WHERE id = ?"
                        ).run(prodSyncPayload, existingProd.id);
                    } else {
                        insertSync.run({
                            entidad: 'producto',
                            entidad_id: item.producto_id,
                            operacion: 'UPDATE',
                            datos_json: prodSyncPayload
                        });
                    }
                }
            }
        }
        
        // Actualizar turno de caja si existe uno abierto
        try {
            const activeShift = db.prepare("SELECT id FROM cajas_turnos WHERE estado = 'abierta' ORDER BY fechaApertura DESC LIMIT 1").get();
            if (activeShift) {
                const isEfectivo = (v.metodoPago || '').toLowerCase().includes('efectivo');
                if (isEfectivo) {
                    db.prepare("UPDATE cajas_turnos SET totalVentasEfectivo = totalVentasEfectivo + ? WHERE id = ?").run(v.total, activeShift.id);
                } else {
                    db.prepare("UPDATE cajas_turnos SET totalVentasDigital = totalVentasDigital + ? WHERE id = ?").run(v.total, activeShift.id);
                }
                const updatedShift = db.prepare("SELECT * FROM cajas_turnos WHERE id = ?").get(activeShift.id);
                if (updatedShift) {
                    insertSync.run({
                        entidad: 'caja_turno',
                        entidad_id: updatedShift.id,
                        operacion: 'UPDATE',
                        datos_json: JSON.stringify(updatedShift)
                    });
                }
            }
        } catch (_) {}

        // Agregar a la cola de sincronización para enviarla a Firebase luego
        insertSync.run({
            entidad: 'venta',
            entidad_id: v.id,
            operacion: 'INSERT',
            datos_json: JSON.stringify({ venta: v, detalle: d })
        });
        
        return v.id;
    });

    try {
        const finalId = tx(ventaParams, detalleVenta);
        return { success: true, ventaId: finalId };
    } catch (err) {
        console.error('Error al guardar venta:', err);
        return { success: false, error: err.message };
    }
}

function anularVenta(ventaId) {
    const selectVenta = db.prepare('SELECT * FROM ventas WHERE id = ?');
    const updateVentaAnulada = db.prepare('UPDATE ventas SET anulado = 1 WHERE id = ?');
    const selectDetalles = db.prepare('SELECT id, producto_id, cantidad, precio_unitario, subtotal FROM ventas_detalle WHERE venta_id = ?');
    const updateStock = db.prepare('UPDATE productos SET stock = stock + @cantidad WHERE id = @producto_id');
    const insertSync = db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (@entidad, @entidad_id, @operacion, @datos_json)');
    const selectProducto = db.prepare('SELECT * FROM productos WHERE id = ?');

    const tx = db.transaction((id) => {
        // Verificar si la venta existe y no está anulada
        const venta = selectVenta.get(id);
        if (!venta) throw new Error('Venta no encontrada');
        if (venta.anulado === 1) throw new Error('La venta ya se encuentra anulada');

        // Marcar como anulada
        updateVentaAnulada.run(id);

        // Obtener detalles para devolver el stock
        const detalles = selectDetalles.all(id);
        
        for (const item of detalles) {
            updateStock.run({ cantidad: item.cantidad, producto_id: item.producto_id });
            const prodRow = selectProducto.get(item.producto_id);
            if (prodRow) {
                // Normalizar booleanos en el payload de Firebase
                const prodSyncData = {
                    ...prodRow,
                    _soloStock: true,
                    disponible: Boolean(prodRow.disponible),
                    destacado: Boolean(prodRow.destacado)
                };
                const prodSyncPayload = JSON.stringify(prodSyncData);
                // UPSERT: si ya existe una entrada pendiente para este producto, actualizarla
                const existingProd = db.prepare(
                    "SELECT id FROM sync_queue WHERE entidad = 'producto' AND entidad_id = ? AND estado_sync = 0 LIMIT 1"
                ).get(item.producto_id);
                if (existingProd) {
                    db.prepare(
                        "UPDATE sync_queue SET datos_json = ?, fecha_creacion = CURRENT_TIMESTAMP, intentos = 0 WHERE id = ?"
                    ).run(prodSyncPayload, existingProd.id);
                } else {
                    insertSync.run({
                        entidad: 'producto',
                        entidad_id: item.producto_id,
                        operacion: 'UPDATE',
                        datos_json: prodSyncPayload
                    });
                }
            }
        }

        // Agregar a la cola de sync para marcar el ticket como anulado en Firebase.
        // El formato debe ser { venta: {...}, detalle: [...items] } para que
        // sincronizarCola() pueda hacer batch.set en ventas/{id} y ventas/{id}/detalle/items.
        venta.anulado = 1;
        // Reconstruir detalle en formato compatible con sincronizarCola (items de ticket)
        const detalleParaSync = detalles.map(d => ({
            id: d.id || crypto.randomUUID(),
            producto_id: d.producto_id,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario || 0,
            subtotal: d.subtotal || 0
        }));
        insertSync.run({
            entidad: 'venta',
            entidad_id: id,
            operacion: 'UPDATE',
            datos_json: JSON.stringify({ venta, detalle: detalleParaSync })
        });
        
        // Revertir del turno de caja si existe uno abierto
        try {
            const activeShift = db.prepare("SELECT id FROM cajas_turnos WHERE estado = 'abierta' ORDER BY fechaApertura DESC LIMIT 1").get();
            if (activeShift) {
                const isEfectivo = (venta.metodoPago || '').toLowerCase().includes('efectivo');
                if (isEfectivo) {
                    db.prepare("UPDATE cajas_turnos SET totalVentasEfectivo = MAX(0, totalVentasEfectivo - ?) WHERE id = ?").run(venta.total, activeShift.id);
                } else {
                    db.prepare("UPDATE cajas_turnos SET totalVentasDigital = MAX(0, totalVentasDigital - ?) WHERE id = ?").run(venta.total, activeShift.id);
                }
            }
        } catch (_) {}

        return true;
    });

    try {
        tx(ventaId);
        return { success: true };
    } catch (err) {
        console.error('Error al anular venta:', err);
        return { success: false, error: err.message };
    }
}



// --- Funciones de Configuración Web ---

function obtenerWebConfig() {
    try {
        const rows = db.prepare('SELECT * FROM web_config').all();
        const config = {};
        rows.forEach(row => {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch {
                config[row.key] = row.value;
            }
        });
        return { success: true, config };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function guardarWebConfig(key, value) {
    try {
        const valueStr = JSON.stringify(value);
        db.prepare('INSERT INTO web_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, valueStr);
        
        // El datos_json debe incluir la 'key' para que sincronizarCola() pueda
        // determinar el ID del documento de Firestore (web_config/{key}).
        const syncPayload = JSON.stringify({ key, ...(typeof value === 'object' && value !== null ? value : { _value: value }) });
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'web_config', key, 'UPDATE', syncPayload
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// --- Funciones de Banners ---

function obtenerBanners() {
    try {
        const banners = db.prepare(`
            SELECT b.*, 
                   (SELECT COUNT(*) FROM sync_queue WHERE entidad = 'banner' AND entidad_id = b.id AND estado_sync = 0) as pendienteSync
            FROM banners b 
            ORDER BY b.priority ASC
        `).all();
        return { success: true, banners: banners.map(b => ({ ...b, active: b.active === 1 })) };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function crearBanner(banner) {
    try {
        const id = banner.id || crypto.randomUUID();
        const stmt = db.prepare(`
            INSERT INTO banners (id, title, subtitle, imageUrl, imagenLocal, badgeText, ctaText, ctaActionCategory, active, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            id,
            banner.title || '',
            banner.subtitle || null,
            banner.imageUrl || 'PENDIENTE',
            banner.imagenLocal || null,
            banner.badgeText || null,
            banner.ctaText || 'Ver más',
            banner.ctaActionCategory || null,
            banner.active ? 1 : 0,
            banner.priority || 0
        );
        
        const data = {
            id,
            title: banner.title || '',
            subtitle: banner.subtitle || null,
            imageUrl: banner.imageUrl || 'PENDIENTE',
            imagenLocal: banner.imagenLocal || null,
            badgeText: banner.badgeText || null,
            ctaText: banner.ctaText || 'Ver más',
            ctaActionCategory: banner.ctaActionCategory || null,
            active: banner.active ? 1 : 0,
            priority: banner.priority || 0
        };
        
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'banner', id, 'INSERT', JSON.stringify(data)
        );
        return { success: true, id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function actualizarBanner(banner) {
    try {
        const stmt = db.prepare(`
            UPDATE banners
            SET title = ?, subtitle = ?, imageUrl = ?, imagenLocal = ?, badgeText = ?, ctaText = ?, ctaActionCategory = ?, active = ?, priority = ?
            WHERE id = ?
        `);
        const info = stmt.run(
            banner.title || '',
            banner.subtitle || null,
            banner.imageUrl || 'PENDIENTE',
            banner.imagenLocal || null,
            banner.badgeText || null,
            banner.ctaText || 'Ver más',
            banner.ctaActionCategory || null,
            banner.active ? 1 : 0,
            banner.priority || 0,
            banner.id
        );
        
        if (info.changes > 0) {
            const data = {
                id: banner.id,
                title: banner.title || '',
                subtitle: banner.subtitle || null,
                imageUrl: banner.imageUrl || 'PENDIENTE',
                imagenLocal: banner.imagenLocal || null,
                badgeText: banner.badgeText || null,
                ctaText: banner.ctaText || 'Ver más',
                ctaActionCategory: banner.ctaActionCategory || null,
                active: banner.active ? 1 : 0,
                priority: banner.priority || 0
            };
            
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'banner', banner.id, 'UPDATE', JSON.stringify(data)
            );
            return { success: true };
        } else {
            return { success: false, error: 'Banner no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarBanner(id) {
    try {
        const info = db.prepare('DELETE FROM banners WHERE id = ?').run(id);
        if (info.changes > 0) {
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'banner', id, 'DELETE', JSON.stringify({ id })
            );
            return { success: true };
        } else {
            return { success: false, error: 'Banner no encontrado' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function registrarUsuarioDesdeFirebase(id, username, email, password, role, permisos = null, activo = 1, nombreCompleto = null, pin = null) {
    try {
        const { salt, hash } = hashPassword(password);
        const termUsername = (username || '').trim();
        const termEmail = (email || '').trim();
        const existing = db.prepare('SELECT id, username, email, role, permisos, activo, nombreCompleto, pin FROM usuarios WHERE id = ? OR LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))').get(id, termUsername, termEmail);
        
        const finalUsername = termUsername || (existing ? existing.username : (termEmail ? termEmail.split('@')[0] : id));
        const finalEmail = termEmail || (existing ? existing.email : null);
        const finalRole = role || (existing ? existing.role : 'admin');
        const finalPermisos = permisos ? (typeof permisos === 'string' ? permisos : JSON.stringify(permisos)) : (existing ? existing.permisos : null);
        const finalActivo = activo !== undefined && activo !== null ? (activo ? 1 : 0) : 1;
        const finalNombreCompleto = nombreCompleto || (existing && existing.nombreCompleto) || finalUsername;
        const finalPin = pin || (existing && existing.pin) || '1234';

        if (existing) {
            db.prepare('UPDATE usuarios SET username = ?, email = ?, password_hash = ?, salt = ?, role = ?, permisos = ?, activo = ?, nombreCompleto = COALESCE(?, nombreCompleto), pin = COALESCE(?, pin) WHERE id = ?').run(
                finalUsername, finalEmail, hash, salt, finalRole, finalPermisos, finalActivo, nombreCompleto, pin, existing.id
            );
        } else {
            db.prepare('INSERT INTO usuarios (id, username, email, password_hash, salt, role, permisos, activo, nombreCompleto, pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                id, finalUsername, finalEmail, hash, salt, finalRole, finalPermisos, finalActivo, finalNombreCompleto, finalPin
            );
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
// --- Compras / Listas de Reabastecimiento ---
function guardarListaCompra(lista, detalles) {
    try {
        const stmtLista = db.prepare('INSERT INTO compras_listas (id, nombre, fecha, total_estimado) VALUES (?, ?, ?, ?)');
        const stmtDetalle = db.prepare('INSERT INTO compras_listas_detalle (id, lista_id, producto_id, cantidad_pedir, costo_unitario) VALUES (?, ?, ?, ?, ?)');
        const stmtSync = db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)');
        
        const tx = db.transaction(() => {
            stmtLista.run(lista.id, lista.nombre, lista.fecha || new Date().toISOString(), lista.total_estimado);
            
            for (const d of detalles) {
                stmtDetalle.run(d.id, lista.id, d.producto_id, d.cantidad_pedir, d.costo_unitario);
            }
            
            // Insertar en cola de sincronización para Firebase
            const listaCompleta = { ...lista, detalles };
            stmtSync.run('lista_compra', lista.id, 'CREATE', JSON.stringify(listaCompleta));
        });
        
        tx();
        return { success: true };
    } catch (err) {
        console.error('Error guardando lista compra:', err);
        return { success: false, error: err.message };
    }
}

function obtenerListasCompras() {
    try {
        const listas = db.prepare('SELECT * FROM compras_listas ORDER BY fecha DESC').all();
        const detallesStmt = db.prepare(`
            SELECT d.*, p.nombre, p.codigoBarras, p.unidadMedida, p.stock
            FROM compras_listas_detalle d
            JOIN productos p ON d.producto_id = p.id
            WHERE d.lista_id = ?
        `);
        
        for (let lista of listas) {
            lista.detalles = detallesStmt.all(lista.id);
        }
        return { success: true, listas };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarListaCompra(id) {
    try {
        let changed = false;
        const tx = db.transaction(() => {
            db.prepare('DELETE FROM compras_listas_detalle WHERE lista_id = ?').run(id);
            const info = db.prepare('DELETE FROM compras_listas WHERE id = ?').run(id);
            if (info.changes > 0) {
                db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                    'lista_compra', id, 'DELETE', JSON.stringify({ id })
                );
                changed = true;
            }
        });
        tx();
        return changed ? { success: true } : { success: false, error: 'Lista no encontrada' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function obtenerEstadoSync() {
    try {
        const count = db.prepare('SELECT COUNT(*) as pending FROM sync_queue WHERE estado_sync = 0').get();
        return { success: true, pendingCount: count.pending };
    } catch (err) {
        return { success: false, pendingCount: 0, error: err.message };
    }
}

function limpiarUsuariosLocales() {
    try {
        db.prepare('DELETE FROM usuarios').run();
        console.log('Usuarios locales limpiados.');
        return true;
    } catch (e) {
        console.error("Error al limpiar usuarios locales:", e);
        return false;
    }
}

function purgarColaSync() {
    try {
        // Eliminar registros completados (estado_sync = 1) con más de 7 días de antigüedad
        const info = db.prepare("DELETE FROM sync_queue WHERE estado_sync = 1 AND fecha_creacion < datetime('now', '-7 days')").run();
        return { success: true, deleted: info.changes };
    } catch (err) {
        console.error('Error purgando sync_queue:', err);
        return { success: false, error: err.message };
    }
}

function obtenerDashboardDataLocal(tsInicioObj, strInicio) {
    try {
        // 1. Obtener Ventas
        const ventas = db.prepare('SELECT * FROM ventas WHERE fecha >= ? ORDER BY fecha DESC').all(strInicio);
        
        if (ventas.length > 0) {
            const ventaIds = ventas.map(v => v.id);
            const placeholders = ventaIds.map(() => '?').join(',');
            const todosDetalles = db.prepare(`
                SELECT d.*, p.nombre as producto_nombre 
                FROM ventas_detalle d 
                LEFT JOIN productos p ON d.producto_id = p.id 
                WHERE d.venta_id IN (${placeholders})
            `).all(...ventaIds);

            const detallesPorVenta = {};
            for (const det of todosDetalles) {
                if (!detallesPorVenta[det.venta_id]) detallesPorVenta[det.venta_id] = [];
                detallesPorVenta[det.venta_id].push(det);
            }

            for (const v of ventas) {
                v.detalles = detallesPorVenta[v.id] || [];
                // Transform date for compat with UI
                v.fecha = { seconds: Math.floor(new Date(v.fecha).getTime() / 1000) };
            }
        }

        // 2. Obtener Stock Bajo
        const stock = db.prepare('SELECT * FROM productos WHERE stock <= 10 ORDER BY stock ASC LIMIT 10').all();

        return { success: true, ventas, stock };
    } catch (err) {
        console.error("Error obteniendo dashboard local:", err);
        return { success: false, error: err.message };
    }
}

// ====================================================================
// CONTROL DE CAJA, TURNOS, ARQUEO Y MOVIMIENTOS DE EFECTIVO
// ====================================================================

function abrirTurno(montoInicial = 0, cajero = 'Cajero Principal') {
    try {
        const existente = db.prepare("SELECT id FROM cajas_turnos WHERE estado = 'abierta' LIMIT 1").get();
        if (existente) {
            return { success: false, error: 'Ya existe un turno de caja abierto.' };
        }

        const id = crypto.randomUUID();
        const fechaApertura = new Date().toISOString();
        const montoNum = Number(montoInicial) || 0;

        const stmt = db.prepare(`
            INSERT INTO cajas_turnos (id, fechaApertura, montoInicial, montoEsperado, estado, cajero)
            VALUES (?, ?, ?, ?, 'abierta', ?)
        `);
        stmt.run(id, fechaApertura, montoNum, montoNum, cajero || 'Cajero Principal');

        const turno = db.prepare("SELECT * FROM cajas_turnos WHERE id = ?").get(id);

        // Encolar sincronización a Firestore
        db.prepare(`
            INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json)
            VALUES ('caja_turno', ?, 'INSERT', ?)
        `).run(id, JSON.stringify(turno));

        return { success: true, turno };
    } catch (err) {
        console.error('Error al abrir turno de caja:', err);
        return { success: false, error: err.message };
    }
}

function obtenerTurnoActual() {
    try {
        const turno = db.prepare("SELECT * FROM cajas_turnos WHERE estado = 'abierta' ORDER BY fechaApertura DESC LIMIT 1").get();
        if (!turno) {
            return { success: true, turno: null };
        }

        const movimientos = db.prepare("SELECT * FROM cajas_movimientos WHERE turnoId = ? ORDER BY fecha DESC").all(turno.id);
        const montoEsperado = Math.round((Number(turno.montoInicial) + Number(turno.totalVentasEfectivo) + Number(turno.totalIngresos) - Number(turno.totalEgresos)) * 100) / 100;

        return {
            success: true,
            turno: {
                ...turno,
                montoEsperado,
                movimientos
            }
        };
    } catch (err) {
        console.error('Error al obtener turno actual:', err);
        return { success: false, error: err.message };
    }
}

function registrarMovimientoCaja(turnoId, tipo, monto, motivo) {
    try {
        const turno = db.prepare("SELECT * FROM cajas_turnos WHERE id = ? AND estado = 'abierta'").get(turnoId);
        if (!turno) {
            return { success: false, error: 'Turno de caja no encontrado o ya cerrado.' };
        }

        const tipoNorm = tipo.toLowerCase() === 'ingreso' ? 'ingreso' : 'egreso';
        const montoNum = Math.abs(Number(monto)) || 0;
        if (montoNum <= 0) {
            return { success: false, error: 'El monto debe ser mayor a 0.' };
        }
        if (!motivo || !motivo.trim()) {
            return { success: false, error: 'El motivo es obligatorio.' };
        }

        const movId = crypto.randomUUID();
        const fecha = new Date().toISOString();

        const tx = db.transaction(() => {
            db.prepare(`
                INSERT INTO cajas_movimientos (id, turnoId, tipo, monto, motivo, fecha)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(movId, turnoId, tipoNorm, montoNum, motivo.trim(), fecha);

            if (tipoNorm === 'ingreso') {
                db.prepare("UPDATE cajas_turnos SET totalIngresos = totalIngresos + ? WHERE id = ?").run(montoNum, turnoId);
            } else {
                db.prepare("UPDATE cajas_turnos SET totalEgresos = totalEgresos + ? WHERE id = ?").run(montoNum, turnoId);
            }

            const movData = { id: movId, turnoId, tipo: tipoNorm, monto: montoNum, motivo: motivo.trim(), fecha };
            db.prepare(`
                INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json)
                VALUES ('caja_movimiento', ?, 'INSERT', ?)
            `).run(movId, JSON.stringify(movData));

            return movData;
        });

        const movimiento = tx();
        return { success: true, movimiento };
    } catch (err) {
        console.error('Error al registrar movimiento de caja:', err);
        return { success: false, error: err.message };
    }
}

function cerrarTurno(turnoId, montoFinalReal, observaciones = '') {
    try {
        const turno = db.prepare("SELECT * FROM cajas_turnos WHERE id = ? AND estado = 'abierta'").get(turnoId);
        if (!turno) {
            return { success: false, error: 'Turno de caja no encontrado o ya cerrado.' };
        }

        const realNum = Number(montoFinalReal) || 0;
        const montoEsperado = Math.round((Number(turno.montoInicial) + Number(turno.totalVentasEfectivo) + Number(turno.totalIngresos) - Number(turno.totalEgresos)) * 100) / 100;
        const diferencia = Math.round((realNum - montoEsperado) * 100) / 100;
        const fechaCierre = new Date().toISOString();

        db.prepare(`
            UPDATE cajas_turnos 
            SET fechaCierre = ?, montoFinalReal = ?, montoEsperado = ?, diferencia = ?, estado = 'cerrada', observaciones = ?
            WHERE id = ?
        `).run(fechaCierre, realNum, montoEsperado, diferencia, observaciones || null, turnoId);

        const turnoCerrado = db.prepare("SELECT * FROM cajas_turnos WHERE id = ?").get(turnoId);

        // Encolar sincronización a Firestore
        db.prepare(`
            INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json)
            VALUES ('caja_turno', ?, 'UPDATE', ?)
        `).run(turnoId, JSON.stringify(turnoCerrado));

        return { success: true, turno: turnoCerrado };
    } catch (err) {
        console.error('Error al cerrar turno de caja:', err);
        return { success: false, error: err.message };
    }
}

function obtenerHistorialTurnos(limite = 30) {
    try {
        const turnos = db.prepare(`
            SELECT * FROM cajas_turnos 
            ORDER BY fechaApertura DESC 
            LIMIT ?
        `).all(limite);

        return { success: true, turnos };
    } catch (err) {
        console.error('Error al obtener historial de turnos:', err);
        return { success: false, error: err.message };
    }
}

function getSyncMeta(clave) {
    try {
        const row = db.prepare('SELECT valor FROM sync_meta WHERE clave = ?').get(clave);
        return row ? row.valor : null;
    } catch {
        return null;
    }
}

function setSyncMeta(clave, valor) {
    try {
        db.prepare('INSERT OR REPLACE INTO sync_meta (clave, valor) VALUES (?, ?)').run(clave, String(valor));
    } catch (err) {
        console.warn('Error guardando sync_meta:', err.message);
    }
}

module.exports = {
    db,
    buscarProductoPorCodigo,
    buscarProductosPorNombre,
    obtenerProductosParaVenta,
    obtenerTodosProductos,
    obtenerPresentacionesDeFamilia,
    guardarFamiliaConPresentaciones,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    guardarVenta,
    obtenerVentas,
    anularVenta,
    login,
    loginConPin,
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    obtenerEstadoSync,
    registrarUsuarioDesdeFirebase,
    obtenerWebConfig,
    guardarWebConfig,
    obtenerBanners,
    crearBanner,
    actualizarBanner,
    eliminarBanner,
    guardarListaCompra,
    obtenerListasCompras,
    eliminarListaCompra,
    limpiarUsuariosLocales,
    obtenerDashboardDataLocal,
    purgarColaSync,
    abrirTurno,
    obtenerTurnoActual,
    registrarMovimientoCaja,
    cerrarTurno,
    obtenerHistorialTurnos,
    getSyncMeta,
    setSyncMeta
};

