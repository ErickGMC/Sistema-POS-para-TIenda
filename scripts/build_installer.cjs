const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('--- GENERADOR DE INSTALADOR WINDOWS (NSIS) ---');

const tempOutputDir = path.join(os.tmpdir(), 'minimarket-pos-builder-output');
const finalOutputDir = path.join(__dirname, '../release');

console.log(`1. Limpiando directorios temporales...`);
if (fs.existsSync(tempOutputDir)) {
  fs.rmSync(tempOutputDir, { recursive: true, force: true });
}
if (!fs.existsSync(finalOutputDir)) {
  fs.mkdirSync(finalOutputDir, { recursive: true });
}

console.log(`2. Compilando Vite bundle...`);
execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log(`3. Ejecutando electron-builder hacia directorio local sin bloqueo de OneDrive...`);
const builderCmd = `npx electron-builder --win --x64 --config.directories.output="${tempOutputDir}"`;
execSync(builderCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log(`4. Copiando instalador generado a la carpeta release/...`);
const files = fs.readdirSync(tempOutputDir);
for (const file of files) {
  const src = path.join(tempOutputDir, file);
  const dest = path.join(finalOutputDir, file);
  console.log(`   -> Copiando ${file}...`);
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('✅ INSTALADOR GENERADO EXITOSAMENTE');
console.log(`Ubicación del instalador: ${finalOutputDir}`);
const exes = fs.readdirSync(finalOutputDir).filter(f => f.endsWith('.exe'));
console.log(`Archivos ejecutables:`, exes);

process.exit(0);
