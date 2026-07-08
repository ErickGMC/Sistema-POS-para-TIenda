const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
  const dbPath = path.join(__dirname, 'electron', 'database', 'pos.db');
  const db = new Database(dbPath, { readonly: true });
  const users = db.prepare('SELECT id, username, role FROM usuarios').all();
  console.log("=== USERS IN DB ===");
  console.log(JSON.stringify(users, null, 2));
  console.log("===================");
  
  const syncQueue = db.prepare('SELECT id, entidad, operacion, intentos, estado_sync FROM sync_queue WHERE estado_sync = 0').all();
  console.log("=== SYNC QUEUE ===");
  console.log(JSON.stringify(syncQueue, null, 2));
  console.log("===================");

  app.quit();
});
