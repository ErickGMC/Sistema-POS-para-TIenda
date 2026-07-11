const { app } = require('electron');
const { db } = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 2: PRUEBA DE ESTRÉS (OFFLINE EXTREMO) ---');
        const count = 50;
        
        console.log(`\n1. Inyectando ${count} transacciones a la cola...`);
        const startTime = Date.now();

        // Limpieza
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'stress_test'").run();

        const insertStmt = db.prepare("INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json, estado_sync) VALUES (?, ?, ?, ?, ?)");
        
        const tx = db.transaction(() => {
            for(let i = 0; i < count; i++) {
                insertStmt.run(
                    'stress_test',
                    crypto.randomUUID(),
                    'INSERT',
                    JSON.stringify({ index: i, largeData: 'A'.repeat(1024) }), // 1KB payload extra
                    0
                );
            }
        });
        tx();

        const insertTime = Date.now() - startTime;
        console.log(` - Inserción completada en ${insertTime} ms. (EXITO)`);

        console.log('\n2. Procesando la cola completa (Simulacro)...');
        const processStartTime = Date.now();
        
        const pendientes = db.prepare("SELECT * FROM sync_queue WHERE estado_sync = 0 AND entidad = 'stress_test'").all();
        console.log(` - Registros encontrados: ${pendientes.length}`);
        
        const updateStmt = db.prepare('UPDATE sync_queue SET estado_sync = 1 WHERE id = ?');
        const txUpdate = db.transaction((ids) => {
            for(const id of ids) {
                updateStmt.run(id);
            }
        });
        
        txUpdate(pendientes.map(p => p.id));
        
        const processTime = Date.now() - processStartTime;
        console.log(` - Procesamiento completado en ${processTime} ms. (EXITO)`);
        
        const procesados = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE estado_sync = 1 AND entidad = 'stress_test'").get().c;
        console.log(` - Validación: ${procesados}/${count} marcados como exitosos.`);

        // Limpieza final
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'stress_test'").run();

        console.log('\n--- FIN DE LA PRUEBA DE ESTRÉS ---');
    } catch (e) {
        console.error('Error durante FASE 2:', e);
    }
    app.quit();
});
