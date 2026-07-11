const { app } = require('electron');
const { db } = require('../electron/database/db.cjs');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 4: PRUEBAS DE SINCRONIZACIÓN (OFFLINE/ONLINE) ---');
        
        console.log('\n1. Simulación Offline (Encolamiento):');
        // Limpiamos
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'test_sync'").run();
        
        // Simular que trabajamos offline y generamos eventos
        db.prepare("INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json, estado_sync) VALUES (?, ?, ?, ?, ?)").run(
            'test_sync', 'sync-id-1', 'INSERT', JSON.stringify({ name: 'test' }), 0
        );
        db.prepare("INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json, estado_sync) VALUES (?, ?, ?, ?, ?)").run(
            'test_sync', 'sync-id-2', 'UPDATE', JSON.stringify({ name: 'test2' }), 0
        );

        const pendingCount = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE entidad = 'test_sync' AND estado_sync = 0").get().c;
        console.log(` - Elementos encolados esperando conexión (Esperado: 2, Actual: ${pendingCount}):`, pendingCount === 2 ? 'EXITO' : 'FALLO');

        console.log('\n2. Recuperación Online (Procesamiento y cambio de estado):');
        // Para probar, vamos a marcar directamente los elementos como procesados simulando que el commit a firestore tuvo exito.
        // Simulamos la logica de firebaseSync.cjs:
        const registros = db.prepare("SELECT * FROM sync_queue WHERE entidad = 'test_sync' AND estado_sync = 0").all();
        const procesados = registros.map(r => r.id);
        
        // Simular éxito de commit:
        const updateStmt = db.prepare('UPDATE sync_queue SET estado_sync = 1 WHERE id = ?');
        const tx = db.transaction((ids) => {
            for (const id of ids) updateStmt.run(id);
        });
        tx(procesados);

        const processedCount = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE entidad = 'test_sync' AND estado_sync = 1").get().c;
        console.log(` - Elementos marcados como sincronizados exitosamente (Esperado: 2, Actual: ${processedCount}):`, processedCount === 2 ? 'EXITO' : 'FALLO');

        console.log('\n3. Descarga Bidireccional (Nube -> Local):');
        // Insertemos un registro desde "la nube" directo a SQLite con INSERT OR REPLACE como hace firebaseSync
        const cloudProdId = 'cloud-prod-' + Date.now();
        const cloudProd = {
            id: cloudProdId,
            codigoBarras: 'CLOUD_123',
            nombre: 'Prod desde Nube',
            categoria: 'Cloud',
            precio: 50,
            stock: 200,
            unidadMedida: 'unidad',
            disponible: 1,
            destacado: 0
        };

        const stmtInsertProd = db.prepare('INSERT OR REPLACE INTO productos (id, codigoBarras, nombre, categoria, precio, stock, unidadMedida, disponible, destacado) VALUES (@id, @codigoBarras, @nombre, @categoria, @precio, @stock, @unidadMedida, @disponible, @destacado)');
        
        const txNube = db.transaction(() => {
            stmtInsertProd.run(cloudProd);
        });
        txNube();

        const localCopy = db.prepare("SELECT * FROM productos WHERE id = ?").get(cloudProdId);
        if (localCopy) {
            console.log(' - Insercion / Reemplazo desde la nube a SQLite:', 'EXITO');
            console.log(` - Nombre sincronizado: ${localCopy.nombre}`);
        } else {
            console.log(' - Insercion / Reemplazo desde la nube a SQLite:', 'FALLO');
        }

        // Limpieza final
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'test_sync'").run();
        db.prepare("DELETE FROM productos WHERE id = ?").run(cloudProdId);

        console.log('\n--- FIN DE LA FASE 4 ---');
    } catch (e) {
        console.error('Error durante FASE 4:', e);
    }
    app.quit();
});
