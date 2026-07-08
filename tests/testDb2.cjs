const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
    try {
        const dbPath = path.join(__dirname, '../electron/database/pos.db');
        const db = new Database(dbPath);
        
        try {
            const errors = db.prepare('SELECT id, entidad, operacion, length(datos_json) as len, intentos FROM sync_queue WHERE estado_sync = 0').all();
            console.log('PENDING SYNC QUEUE:', JSON.stringify(errors, null, 2));
        } catch(e) {
            console.log('SYNC QUEUE ERRORS TABLE ISSUE:', e.message);
        }
    } catch (e) {
        console.error('INIT ERROR:', e);
    }
    app.quit();
});
