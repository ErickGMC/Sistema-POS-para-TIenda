const fs = require('fs');
const path = require('path');

console.log('🧹 Limpiando el entorno de desarrollo (Eliminando base de datos local y configuración de Firebase)...');

const filesToClean = [
  path.join(__dirname, 'database', 'pos.db'),
  path.join(__dirname, 'database', 'pos.db-wal'),
  path.join(__dirname, 'database', 'pos.db-shm'),
  path.join(__dirname, 'sync', 'firebase_config.json')
];

for (const file of filesToClean) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Eliminado: ${path.basename(file)}`);
    }
  } catch (err) {
    console.error(`❌ Error eliminando ${path.basename(file)}:`, err.message);
  }
}

console.log('✨ Entorno limpio y listo para iniciar.');
