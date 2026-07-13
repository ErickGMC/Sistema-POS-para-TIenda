const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'electron', 'database', 'db.cjs');
let content = fs.readFileSync(dbPath, 'utf8');

// 1. Add migration
if (!content.includes('Version 7')) {
  content = content.replace(
    /(\/\/ Version 6\s*\(\) => \{\s*db\.exec\(`CREATE TABLE IF NOT EXISTS analytics_events \([\s\S]*?\)`\);\s*\})/,
    `$1,
    // Version 7
    () => {
        db.exec("ALTER TABLE ventas ADD COLUMN anulado INTEGER DEFAULT 0");
    }`
  );
}

// 2. Add anularVenta function
if (!content.includes('function anularVenta')) {
  const anularVentaStr = `
function anularVenta(ventaId) {
    const tx = db.transaction((id) => {
        // Verificar si la venta existe y no está anulada
        const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
        if (!venta) throw new Error('Venta no encontrada');
        if (venta.anulado === 1) throw new Error('La venta ya se encuentra anulada');

        // Marcar como anulada
        db.prepare('UPDATE ventas SET anulado = 1 WHERE id = ?').run(id);

        // Obtener detalles para devolver el stock
        const detalles = db.prepare('SELECT producto_id, cantidad FROM ventas_detalle WHERE venta_id = ?').all(id);
        
        const updateStock = db.prepare('UPDATE productos SET stock = stock + @cantidad WHERE id = @producto_id');
        const insertSync = db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (@entidad, @entidad_id, @operacion, @datos_json)');

        for (const item of detalles) {
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

        // Agregar a la cola de sync para actualizar el ticket a anulado en Firebase
        venta.anulado = 1;
        insertSync.run({
            entidad: 'venta',
            entidad_id: id,
            operacion: 'UPDATE',
            datos_json: JSON.stringify({ venta, detalle: detalles })
        });
        
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
`;
  content = content.replace(/(function guardarVenta[\s\S]*?\}\s*\n)/, `$1\n${anularVentaStr}\n`);
}

// 3. Export it
if (!content.includes('anularVenta,')) {
  content = content.replace(/guardarVenta,\n/, 'guardarVenta,\n    anularVenta,\n');
}

fs.writeFileSync(dbPath, content, 'utf8');
console.log('db.cjs updated successfully!');
