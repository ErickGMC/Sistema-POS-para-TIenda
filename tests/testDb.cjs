const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
    try {
        const dbPath = path.join(__dirname, '../electron/database/pos.db');
        const db = new Database(dbPath);
        
        try {
            const errors = db.prepare('SELECT id, entidad, operacion, length(datos_json), error_message FROM sync_queue WHERE estado_sync = 0').all();
            console.log('SYNC QUEUE ERRORS:', JSON.stringify(errors, null, 2));
        } catch(e) {
            console.log('SYNC QUEUE ERRORS TABLE ISSUE:', e.message);
        }
        
        // Also let's try to update a product to see if it throws an error
        const prod = db.prepare('SELECT * FROM productos LIMIT 1').get();
        if (prod) {
            console.log('PRODUCT TO UPDATE:', prod.id);
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
                    id: prod.id,
                    codigoBarras: prod.codigoBarras,
                    nombre: prod.nombre + ' test',
                    descripcion: prod.descripcion,
                    categoria: prod.categoria,
                    precio: prod.precio,
                    costo: prod.costo,
                    stock: prod.stock,
                    unidadMedida: prod.unidadMedida,
                    imagenUrl: prod.imagenUrl,
                    thumbnailUrl: prod.thumbnailUrl,
                    imagenLocal: prod.imagenLocal,
                    thumbnailLocal: prod.thumbnailLocal,
                    disponible: prod.disponible,
                    destacado: prod.destacado,
                    etiquetas: prod.etiquetas
                };
                
                stmt.run(data);
                console.log('UPDATE SUCCESS');
            } catch (err) {
                console.error('UPDATE ERROR:', err.message);
            }
        }
    } catch (e) {
        console.error('INIT ERROR:', e);
    }
    app.quit();
});
