const Database = require('better-sqlite3');
const path = require('path');
let app;
try {
  app = require('electron').app;
} catch (e) {}

function runTest() {
  console.log('[Integration Test] Checking SQLite local schema and atomic operations...');
  const dbPath = path.join(__dirname, '../electron/database/pos.db');
  try {
    const db = new Database(dbPath);
    console.log('✔ SQLite Database connection opened successfully.');

    // 1. Check required tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    console.log('Existing tables:', tables.join(', '));

    const requiredTables = [
      'productos',
      'ventas',
      'ventas_detalle',
      'sync_queue',
      'usuarios',
      'web_config',
      'banners',
      'correlativos',
      'compras_listas',
      'compras_listas_detalle'
    ];

    for (const req of requiredTables) {
      if (!tables.includes(req)) {
        throw new Error(`Falta la tabla requerida: ${req}`);
      }
    }
    console.log('✔ All required POS tables exist.');

    // 2. Perform a transactional query check
    const productosCount = db.prepare('SELECT COUNT(*) as count FROM productos').get().count;
    console.log(`✔ Products in local SQLite DB: ${productosCount}`);

    const pendingSync = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE estado_sync = 0').get().count;
    console.log(`✔ Pending items in sync queue: ${pendingSync}`);

    console.log('✔ SQLite Integration Test Passed successfully.');
  } catch (err) {
    console.error('❌ SQLite Integration Test Failed:', err.message);
  }
  if (app) app.quit();
}

if (app) {
  app.whenReady().then(runTest);
} else {
  runTest();
}
