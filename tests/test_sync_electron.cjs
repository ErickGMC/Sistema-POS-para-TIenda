const { sincronizarCola, loginConFirebase } = require('./electron/sync/firebaseSync.cjs');
const { db } = require('./electron/database/db.cjs');

async function testSync() {
    console.log("Attempting to login to Firebase with admin...");
    const loginRes = await loginConFirebase('admin', 'admin123');
    console.log("Login result:", loginRes);
    
    console.log("Checking pending syncs...");
    const pendientes = db.prepare('SELECT * FROM sync_queue WHERE estado_sync = 0').all();
    console.log(`Pending records: ${pendientes.length}`);
    
    if (pendientes.length > 0) {
        console.log("Attempting sync...");
        await sincronizarCola();
        console.log("Sync attempt finished.");
    } else {
        console.log("No pending records.");
    }
    process.exit(0);
}

testSync().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
