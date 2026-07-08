const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');

// Obtener la ruta de la base de datos (segura en producción)
const dbDir = app.isPackaged ? app.getPath('userData') : __dirname;
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
try {
    db.exec("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE ventas ADD COLUMN clienteNombre TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE ventas ADD COLUMN clienteDocumento TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE productos ADD COLUMN thumbnailUrl TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE productos ADD COLUMN imagenLocal TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE productos ADD COLUMN thumbnailLocal TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("ALTER TABLE banners ADD COLUMN imagenLocal TEXT");
} catch {
    // La columna ya existe
}
try {
    db.exec("CREATE TABLE IF NOT EXISTS correlativos (serie TEXT PRIMARY KEY, siguiente_numero INTEGER DEFAULT 1)");
    db.exec("INSERT OR IGNORE INTO correlativos (serie, siguiente_numero) VALUES ('B001', 1)");
} catch (e) {
    console.error("Error creating correlativos table:", e);
}

// Crear usuario por defecto si no existen usuarios (permite el primer login antes de descargar la nube)
try {
    const count = db.prepare("SELECT COUNT(*) as count FROM usuarios").get().count;
    if (count === 0) {
        const adminId = crypto.randomUUID();
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync('admin', salt, 64).toString('hex');
        
        db.prepare('INSERT INTO usuarios (id, username, password_hash, salt, role, permisos, activo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            adminId, 'admin', hash, salt, 'admin', JSON.stringify(['all']), 1
        );
        console.log('Usuario admin por defecto creado.');
    }
} catch (e) {
    console.error("Error al crear usuario por defecto:", e);
}
// --- Funciones CRUD de Productos ---

const stmtBuscarProductoPorCodigo = db.prepare('SELECT * FROM productos WHERE codigoBarras = ?');
const stmtBuscarProductosPorNombre = db.prepare(`
    SELECT * FROM productos 
    WHERE nombre LIKE ? 
       OR descripcion LIKE ? 
       OR codigoBarras LIKE ? 
    LIMIT 20
`);

function buscarProductoPorCodigo(codigo) {
    return stmtBuscarProductoPorCodigo.get(codigo);
}

function buscarProductosPorNombre(nombre) {
    const term = `%${nombre}%`;
    return stmtBuscarProductosPorNombre.all(term, term, term);
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
            INSERT INTO productos (id, codigoBarras, nombre, descripcion, categoria, precio, costo, stock, unidadMedida, imagenUrl, thumbnailUrl, imagenLocal, thumbnailLocal, disponible, destacado, etiquetas) 
            VALUES (@id, @codigoBarras, @nombre, @descripcion, @categoria, @precio, @costo, @stock, @unidadMedida, @imagenUrl, @thumbnailUrl, @imagenLocal, @thumbnailLocal, @disponible, @destacado, @etiquetas)
        `);
        
        const data = {
            id: producto.id || crypto.randomUUID(),
            codigoBarras: (producto.codigoBarras && producto.codigoBarras.trim() !== '') ? producto.codigoBarras : null,
            nombre: producto.nombre || '',
            descripcion: producto.descripcion || null,
            categoria: producto.categoria || 'Abarrotes',
            precio: producto.precio !== undefined ? producto.precio : 0,
            costo: producto.costo !== undefined ? producto.costo : null,
            stock: producto.stock !== undefined ? producto.stock : 0,
            unidadMedida: producto.unidadMedida || 'unidad',
            imagenUrl: producto.imagenUrl || null,
            thumbnailUrl: producto.thumbnailUrl || null,
            imagenLocal: producto.imagenLocal || null,
            thumbnailLocal: producto.thumbnailLocal || null,
            disponible: producto.disponible ? 1 : 0,
            destacado: producto.destacado ? 1 : 0,
            etiquetas: producto.etiquetas ? JSON.stringify(producto.etiquetas) : null
        };
        
        stmt.run(data);
        
        // Agregar a Sync Queue solo si no viene de Firestore
        if (!isFromSync) {
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'producto', data.id, 'INSERT', JSON.stringify(data)
            );
        }
        
        return { success: true };
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
                unidadMedida = @unidadMedida, imagenUrl = @imagenUrl, thumbnailUrl = @thumbnailUrl, imagenLocal = @imagenLocal, thumbnailLocal = @thumbnailLocal, disponible = @disponible, 
                destacado = @destacado, etiquetas = @etiquetas
            WHERE id = @id
        `);
        
        const data = {
            id: producto.id,
            codigoBarras: (producto.codigoBarras && producto.codigoBarras.trim() !== '') ? producto.codigoBarras : null,
            nombre: producto.nombre || '',
            descripcion: producto.descripcion || null,
            categoria: producto.categoria || 'Abarrotes',
            precio: producto.precio !== undefined ? producto.precio : 0,
            costo: producto.costo !== undefined ? producto.costo : null,
            stock: producto.stock !== undefined ? producto.stock : 0,
            unidadMedida: producto.unidadMedida || 'unidad',
            imagenUrl: producto.imagenUrl || null,
            thumbnailUrl: producto.thumbnailUrl || null,
            imagenLocal: producto.imagenLocal || null,
            thumbnailLocal: producto.thumbnailLocal || null,
            disponible: producto.disponible ? 1 : 0,
            destacado: producto.destacado ? 1 : 0,
            etiquetas: producto.etiquetas ? JSON.stringify(producto.etiquetas) : null
        };
        
        stmt.run(data);
        
        // Agregar a Sync Queue solo si no viene de Firestore
        if (!isFromSync) {
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'producto', data.id, 'UPDATE', JSON.stringify(data)
            );
        }
        
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarProducto(id, isFromSync = false) {
    try {
        db.prepare('DELETE FROM productos WHERE id = ?').run(id);
        
        // Agregar a Sync Queue solo si no viene de Firestore
        if (!isFromSync) {
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'producto', id, 'DELETE', JSON.stringify({ id })
            );
        }
        
        return { success: true };
    } catch (err) {
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

function login(username, password) {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    if (!user) return { success: false, error: 'Usuario incorrecto' };
    
    // Validar si el usuario está activo
    if (user.activo !== undefined && user.activo === 0) {
        return { success: false, error: 'Usuario desactivado. Hable con el administrador.' };
    }
    
    if (verifyPassword(password, user.password_hash, user.salt)) {
        // Retornar usuario sin datos sensibles
        const { password_hash: _password_hash, salt: _salt, ...safeUser } = user;
        if (safeUser.permisos) safeUser.permisos = JSON.parse(safeUser.permisos);
        return { success: true, user: safeUser };
    }
    return { success: false, error: 'Contraseña incorrecta' };
}

function obtenerUsuarios() {
    const users = db.prepare(`
        SELECT u.id, u.username, u.role, u.permisos, u.activo, u.fecha_creacion,
               (SELECT COUNT(*) FROM sync_queue WHERE entidad = 'usuario' AND entidad_id = u.id AND estado_sync = 0) as pendienteSync
        FROM usuarios u 
        ORDER BY u.username ASC
    `).all();
    return users.map(u => ({ ...u, permisos: u.permisos ? JSON.parse(u.permisos) : [] }));
}

function crearUsuario(userData, password) {
    try {
        const { salt, hash } = hashPassword(password);
        db.prepare('INSERT INTO usuarios (id, username, password_hash, salt, role, permisos, activo) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            userData.id, userData.username, hash, salt, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1
        );

        // Agregar a Sync Queue
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'usuario', userData.id, 'INSERT', JSON.stringify({
                ...userData,
                password: password
            })
        );

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function actualizarUsuario(userData, newPassword = null) {
    try {
        const activoVal = userData.activo !== undefined ? (userData.activo ? 1 : 0) : 1;
        if (newPassword && newPassword.trim() !== '') {
            const { salt, hash } = hashPassword(newPassword);
            db.prepare('UPDATE usuarios SET username = ?, role = ?, permisos = ?, password_hash = ?, salt = ?, activo = ? WHERE id = ?').run(
                userData.username, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, hash, salt, activoVal, userData.id
            );
        } else {
            db.prepare('UPDATE usuarios SET username = ?, role = ?, permisos = ?, activo = ? WHERE id = ?').run(
                userData.username, userData.role, userData.permisos ? JSON.stringify(userData.permisos) : null, activoVal, userData.id
            );
        }

        // Agregar a Sync Queue
        const syncData = { ...userData };
        if (newPassword && newPassword.trim() !== '') syncData.password = newPassword;
        
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'usuario', userData.id, 'UPDATE', JSON.stringify(syncData)
        );

        return { success: true };
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
        
        db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

        // Agregar a Sync Queue
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'usuario', id, 'DELETE', JSON.stringify({ id })
        );

        return { success: true };
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

        query += ' ORDER BY fecha DESC LIMIT 100';

        const ventas = db.prepare(query).all(...params);

        // Fetch detalles for each venta
        const stmtDetalles = db.prepare(`
            SELECT d.*, p.nombre as producto_nombre 
            FROM ventas_detalle d 
            LEFT JOIN productos p ON d.producto_id = p.id 
            WHERE d.venta_id = ?
        `);

        for (const venta of ventas) {
            venta.detalles = stmtDetalles.all(venta.id);
        }

        return { success: true, ventas };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function guardarVenta(ventaParams, detalleVenta) {
    // Usar transacción para asegurar atomicidad
    const insertVenta = db.prepare('INSERT INTO ventas (id, total, metodoPago, clienteNombre, clienteDocumento) VALUES (@id, @total, @metodoPago, @clienteNombre, @clienteDocumento)');
    const insertDetalle = db.prepare('INSERT INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (@id, @venta_id, @producto_id, @cantidad, @precio_unitario, @subtotal)');
    const updateStock = db.prepare('UPDATE productos SET stock = stock - @cantidad WHERE id = @producto_id');
    const insertSync = db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (@entidad, @entidad_id, @operacion, @datos_json)');
    const getCorrelativo = db.prepare('SELECT siguiente_numero FROM correlativos WHERE serie = ?');
    const updateCorrelativo = db.prepare('UPDATE correlativos SET siguiente_numero = siguiente_numero + 1 WHERE serie = ?');

    const tx = db.transaction((vParams, d) => {
        let finalVentaId = vParams.id;
        // Si no se proveyó ID o si se requiere autogenerar (ej. para forzar secuencia)
        // Generaremos el ID secuencial siempre para ventas nuevas desde el POS
        const serie = 'B001';
        const row = getCorrelativo.get(serie);
        let num = 1;
        if (row) {
            num = row.siguiente_numero;
            updateCorrelativo.run(serie);
        }
        finalVentaId = `${serie}-${num.toString().padStart(8, '0')}`;

        const v = { ...vParams, id: finalVentaId };

        insertVenta.run({ 
            id: v.id, 
            total: v.total, 
            metodoPago: v.metodoPago,
            clienteNombre: v.clienteNombre || null,
            clienteDocumento: v.clienteDocumento || null
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
            updateStock.run({ cantidad: item.cantidad, producto_id: item.producto_id });
            const prodRow = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.producto_id);
            if (prodRow) {
                insertSync.run({
                    entidad: 'producto',
                    entidad_id: item.producto_id,
                    operacion: 'UPDATE',
                    datos_json: JSON.stringify(prodRow)
                });
            }
        }
        
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

function obtenerEstadoSync() {
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE estado_sync = 0').get().count;
        return { success: true, pendingCount: count };
    } catch (err) {
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
        
        // Agregar a la cola de sincronización
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'web_config', key, 'SET', valueStr
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
        stmt.run(
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
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function eliminarBanner(id) {
    try {
        db.prepare('DELETE FROM banners WHERE id = ?').run(id);
        db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
            'banner', id, 'DELETE', JSON.stringify({ id })
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function registrarUsuarioDesdeFirebase(id, username, password, role) {
    try {
        const { salt, hash } = hashPassword(password);
        db.prepare('INSERT OR IGNORE INTO usuarios (id, username, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)').run(
            id, username, hash, salt, role
        );
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
        const tx = db.transaction(() => {
            db.prepare('DELETE FROM compras_listas_detalle WHERE lista_id = ?').run(id);
            db.prepare('DELETE FROM compras_listas WHERE id = ?').run(id);
            
            db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
                'lista_compra', id, 'DELETE', JSON.stringify({ id })
            );
        });
        tx();
        return { success: true };
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

module.exports = {
    db,
    buscarProductoPorCodigo,
    buscarProductosPorNombre,
    obtenerTodosProductos,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    guardarVenta,
    obtenerVentas,
    login,
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
    eliminarListaCompra
};

