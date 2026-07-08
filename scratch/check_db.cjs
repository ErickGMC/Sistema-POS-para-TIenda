const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'electron', 'database', 'pos.db');
console.log('Ruta DB:', dbPath);

try {
    const db = new Database(dbPath);
    const queue = db.prepare('SELECT * FROM sync_queue ORDER BY fecha_creacion DESC LIMIT 10').all();
    console.log('Últimos 10 registros de sync_queue:');
    console.log(JSON.stringify(queue, null, 2));
    
    const countPending = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE estado_sync = 0').get().count;
    console.log('Cantidad pendiente:', countPending);
    
    const countSuccess = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE estado_sync = 1').get().count;
    console.log('Cantidad exitosa:', countSuccess);
} catch (e) {
    console.error('Error leyendo DB:', e);
}
