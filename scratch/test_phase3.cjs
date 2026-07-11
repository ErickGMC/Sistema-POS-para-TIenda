const { app } = require('electron');
const { 
    crearProducto, 
    guardarVenta, 
    obtenerVentas,
    db 
} = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 3: PRUEBAS DE PUNTO DE VENTA (TICKETS Y STOCK) ---');

        // Limpiar para la prueba
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'venta'").run();
        
        // 1. Crear productos de prueba
        const prod1 = { id: crypto.randomUUID(), nombre: 'Prod Venta 1', categoria: 'Test', precio: 10, stock: 50 };
        const prod2 = { id: crypto.randomUUID(), nombre: 'Prod Venta 2', categoria: 'Test', precio: 25, stock: 10 };
        crearProducto(prod1);
        crearProducto(prod2);

        // 2. Realizar una venta
        const ventaParams = {
            id: '', // Se debe autogenerar
            total: 45, // (2 * 10) + (1 * 25)
            metodoPago: 'efectivo',
            clienteNombre: 'Juan Perez',
            clienteDocumento: '12345678'
        };

        const detalleVenta = [
            { id: crypto.randomUUID(), producto_id: prod1.id, cantidad: 2, precio_unitario: 10, subtotal: 20 },
            { id: crypto.randomUUID(), producto_id: prod2.id, cantidad: 1, precio_unitario: 25, subtotal: 25 }
        ];

        console.log('\n1. Transacción Atómica y Correlativos:');
        const resVenta = guardarVenta(ventaParams, detalleVenta);
        console.log(' - Guardar Venta:', resVenta.success ? 'EXITO' : 'FALLO (' + resVenta.error + ')');
        console.log(' - Correlativo Generado:', resVenta.ventaId);
        
        if (resVenta.success && resVenta.ventaId.startsWith('B001-')) {
            console.log(' - Formato de correlativo:', 'EXITO');
        } else {
            console.log(' - Formato de correlativo:', 'FALLO');
        }

        console.log('\n2. Verificación de Stock (Descuento automático):');
        const p1Db = db.prepare("SELECT stock FROM productos WHERE id = ?").get(prod1.id);
        const p2Db = db.prepare("SELECT stock FROM productos WHERE id = ?").get(prod2.id);
        console.log(` - Stock Prod 1 (Esperado: 48, Actual: ${p1Db.stock}):`, p1Db.stock === 48 ? 'EXITO' : 'FALLO');
        console.log(` - Stock Prod 2 (Esperado: 9, Actual: ${p2Db.stock}):`, p2Db.stock === 9 ? 'EXITO' : 'FALLO');

        console.log('\n3. Persistencia de Ticket y Detalles:');
        const tickets = obtenerVentas({ ticketId: resVenta.ventaId });
        if (tickets.success && tickets.ventas.length === 1) {
            const t = tickets.ventas[0];
            console.log(' - Recuperar ticket local:', 'EXITO');
            console.log(` - Cantidad de detalles guardados (Esperado: 2, Actual: ${t.detalles.length}):`, t.detalles.length === 2 ? 'EXITO' : 'FALLO');
            if (t.detalles.length === 2) {
                console.log(' - Detalle incluye nombre del producto (JOIN):', t.detalles[0].producto_nombre ? 'EXITO (' + t.detalles[0].producto_nombre + ')' : 'FALLO');
            }
        } else {
            console.log(' - Recuperar ticket local:', 'FALLO');
        }

        console.log('\n4. Registro en Nube (sync_queue JSON structure):');
        const syncVenta = db.prepare("SELECT * FROM sync_queue WHERE entidad = 'venta' AND entidad_id = ?").get(resVenta.ventaId);
        if (syncVenta) {
            console.log(' - Evento de sincronización encolado:', 'EXITO');
            const data = JSON.parse(syncVenta.datos_json);
            const incluyeVenta = !!data.venta;
            const incluyeDetalle = !!data.detalle && data.detalle.length === 2;
            console.log(' - Payload contiene objeto "venta":', incluyeVenta ? 'EXITO' : 'FALLO');
            console.log(' - Payload contiene array "detalle" con productos:', incluyeDetalle ? 'EXITO' : 'FALLO');
        } else {
            console.log(' - Evento de sincronización encolado:', 'FALLO');
        }

        // Limpieza final
        db.prepare("DELETE FROM ventas_detalle WHERE venta_id = ?").run(resVenta.ventaId);
        db.prepare("DELETE FROM ventas WHERE id = ?").run(resVenta.ventaId);
        db.prepare("DELETE FROM productos WHERE id = ? OR id = ?").run(prod1.id, prod2.id);
        db.prepare("DELETE FROM sync_queue WHERE entidad_id = ? OR entidad_id = ? OR entidad_id = ?").run(resVenta.ventaId, prod1.id, prod2.id);

        console.log('\n--- FIN DE LA FASE 3 ---');
    } catch (e) {
        console.error('Error durante FASE 3:', e);
    }
    app.quit();
});
