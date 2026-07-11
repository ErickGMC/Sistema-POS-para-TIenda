const { app } = require('electron');
const { 
    crearProducto, 
    actualizarProducto, 
    eliminarProducto, 
    db 
} = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 2: PRUEBAS DE INVENTARIO (PRODUCTOS) ---');

        const testBarcode = 'BARCODE_TEST_12345';
        const prodId = crypto.randomUUID();

        // Limpiar registros de pruebas anteriores
        db.prepare("DELETE FROM productos WHERE codigoBarras = ?").run(testBarcode);
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'producto'").run();

        console.log('\n1. CRUD de Productos (Creación):');
        const prodData = {
            id: prodId,
            codigoBarras: testBarcode,
            nombre: 'Producto de Prueba',
            categoria: 'Tests',
            precio: 10.5,
            stock: 100,
            imagenLocal: 'data:image/png;base64,iVBORw0KGgo...', // Simular imagen
            disponible: 1
        };

        const resCreate = crearProducto(prodData);
        console.log(' - Crear Producto:', resCreate.success ? 'EXITO' : 'FALLO (' + resCreate.error + ')');

        console.log('\n2. Restricciones de duplicidad (Códigos de barra):');
        const prodDataDupe = { ...prodData, id: crypto.randomUUID(), nombre: 'Producto Duplicado' };
        const resCreateDupe = crearProducto(prodDataDupe);
        
        if (!resCreateDupe.success && resCreateDupe.error.includes('UNIQUE')) {
            console.log(' - Bloquear duplicado por codigoBarras:', 'EXITO (' + resCreateDupe.error + ')');
        } else {
            console.log(' - Bloquear duplicado por codigoBarras:', 'FALLO');
        }

        // Verificar que el fallido NO se guardó en sync_queue
        const syncCount = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE entidad_id = ?").get(prodDataDupe.id).c;
        console.log(' - ¿Se evitó sincronizar el duplicado fallido?:', syncCount === 0 ? 'EXITO' : 'FALLO (Hay registros en sync_queue)');

        console.log('\n3. CRUD de Productos (Actualización y Sync Queue):');
        const resUpdate = actualizarProducto({ ...prodData, precio: 15.0 });
        console.log(' - Actualizar Producto existente:', resUpdate.success ? 'EXITO' : 'FALLO (' + resUpdate.error + ')');

        const syncUpdateReg = db.prepare("SELECT * FROM sync_queue WHERE entidad = 'producto' AND operacion = 'UPDATE' AND entidad_id = ?").get(prodId);
        if (syncUpdateReg) {
            console.log(' - Registro de UPDATE en sync_queue encontrado:', 'EXITO');
            const data = JSON.parse(syncUpdateReg.datos_json);
            console.log(' - Contiene imagenLocal para ser procesada a URL?:', data.imagenLocal ? 'EXITO' : 'FALLO');
        } else {
            console.log(' - Registro de UPDATE en sync_queue encontrado:', 'FALLO');
        }

        console.log('\n4. CRUD de Productos (Eliminación):');
        const resDelete = eliminarProducto(prodId);
        console.log(' - Eliminar Producto:', resDelete.success ? 'EXITO' : 'FALLO (' + resDelete.error + ')');

        // Limpieza final
        db.prepare("DELETE FROM sync_queue WHERE entidad_id = ?").run(prodId);

        console.log('\n--- FIN DE LA FASE 2 ---');
    } catch (e) {
        console.error('Error durante FASE 2:', e);
    }
    app.quit();
});
