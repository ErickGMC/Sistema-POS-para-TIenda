const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
  const dbPath = path.join(__dirname, 'electron', 'database', 'pos.db');
  const db = new Database(dbPath);
  
  // Delete the admin user
  const result = db.prepare('DELETE FROM usuarios WHERE username = ?').run('admin');
  console.log("Deleted admin from usuarios:", result.changes);
  
  // Delete from sync_queue
  const result2 = db.prepare('DELETE FROM sync_queue WHERE entidad = ? AND entidad_id = ?').run('usuario', 'admin-default-id');
  console.log("Deleted admin from sync_queue:", result2.changes);

  app.quit();
});
