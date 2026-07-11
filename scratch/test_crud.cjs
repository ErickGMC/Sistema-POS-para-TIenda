const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../electron/database/pos.db');
const db = new Database(dbPath);

console.log('--- TEST: UPDATE DE PRODUCTO INEXISTENTE ---');
const fakeId = 'no-existe-' + Date.now();
const stmtUpdate = db.prepare(`
    UPDATE productos 
    SET nombre = 'Test'
    WHERE id = ?
`);
const infoUpdate = stmtUpdate.run(fakeId);
console.log('Update changes:', infoUpdate.changes);

// Simulate current db.cjs logic:
db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
    'producto', fakeId, 'UPDATE', JSON.stringify({ id: fakeId, nombre: 'Test' })
);

console.log('Sync queue after fake update:', db.prepare('SELECT count(*) as c FROM sync_queue WHERE entidad_id = ?').get(fakeId).c);

console.log('--- TEST: DELETE DE PRODUCTO INEXISTENTE ---');
const infoDelete = db.prepare('DELETE FROM productos WHERE id = ?').run(fakeId);
console.log('Delete changes:', infoDelete.changes);

// Simulate current db.cjs logic:
db.prepare('INSERT INTO sync_queue (entidad, entidad_id, operacion, datos_json) VALUES (?, ?, ?, ?)').run(
    'producto', fakeId, 'DELETE', JSON.stringify({ id: fakeId })
);

console.log('Sync queue after fake delete:', db.prepare('SELECT count(*) as c FROM sync_queue WHERE entidad_id = ?').get(fakeId).c);

// Cleanup test data from sync_queue
db.prepare('DELETE FROM sync_queue WHERE entidad_id = ?').run(fakeId);
console.log('Cleanup done.');
