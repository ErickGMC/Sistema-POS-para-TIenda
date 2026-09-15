const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== INSTALADOR LOCAL DE MINIMARKET POS (LINUX) ===');

const homeDir = process.env.HOME || '/home/erick';
const targetDir = path.join(homeDir, '.local', 'share', 'minimarket-pos');
const targetAppDir = path.join(targetDir, 'app');
const targetBinDir = path.join(homeDir, '.local', 'bin');
const targetLauncher = path.join(targetBinDir, 'minimarket-pos');
const targetDesktopDir = path.join(homeDir, '.local', 'share', 'applications');
const targetDesktop = path.join(targetDesktopDir, 'minimarket-pos.desktop');
const escritorioDir = path.join(homeDir, 'Escritorio');
const desktopDir = path.join(homeDir, 'Desktop');

const releaseDir = path.join(__dirname, '..', 'release');
const unpackedSource = path.join(releaseDir, 'linux-unpacked');
const appImageSource = path.join(releaseDir, 'Minimarket POS-1.0.0.AppImage');
const iconSource = path.join(__dirname, '..', 'public', 'favicon.svg');

// 1. Matar procesos anteriores
try {
  console.log('1. Deteniendo instancias previas...');
  execSync('pkill -f "tienda-pos" || true');
} catch (e) {}

// 2. Asegurar directorios
console.log('2. Asegurando directorios de destino...');
fs.mkdirSync(targetDir, { recursive: true });
fs.mkdirSync(targetBinDir, { recursive: true });
fs.mkdirSync(targetDesktopDir, { recursive: true });

// 3. Reemplazar directorio app
console.log('3. Reemplazando app en ' + targetAppDir + '...');
if (fs.existsSync(targetAppDir)) {
  fs.rmSync(targetAppDir, { recursive: true, force: true });
}
fs.cpSync(unpackedSource, targetAppDir, { recursive: true });
console.log('   ✓ Archivos de aplicación copiados.');

// 4. Copiar AppImage e icono
if (fs.existsSync(appImageSource)) {
  console.log('4. Copiando AppImage...');
  const appImageDest = path.join(targetDir, 'minimarket-pos.AppImage');
  fs.copyFileSync(appImageSource, appImageDest);
  fs.chmodSync(appImageDest, 0o755);
  console.log('   ✓ AppImage actualizada.');
}

if (fs.existsSync(iconSource)) {
  const iconDest = path.join(targetDir, 'icon.svg');
  fs.copyFileSync(iconSource, iconDest);
  console.log('   ✓ Icono actualizado.');
}

// 5. Crear script lanzador en ~/.local/bin/minimarket-pos
console.log('5. Creando script lanzador...');
const launcherContent = `#!/bin/bash\nexec "$HOME/.local/share/minimarket-pos/app/tienda-pos" "$@"\n`;
fs.writeFileSync(targetLauncher, launcherContent, { mode: 0o755 });
console.log('   ✓ Lanzador creado en ' + targetLauncher);

// 6. Crear archivo desktop en ~/.local/share/applications/
console.log('6. Configurando entrada de escritorio...');
const desktopContent = `[Desktop Entry]
Name=Minimarket POS
GenericName=Punto de Venta
Comment=Sistema POS y Punto de Venta para Minimarket Flor
Exec=${targetLauncher} %U
Icon=${path.join(targetDir, 'icon.svg')}
Terminal=false
Type=Application
Categories=Office;Finance;
StartupWMClass=tienda-pos
`;

fs.writeFileSync(targetDesktop, desktopContent, { mode: 0o755 });
console.log('   ✓ Acceso en aplicaciones: ' + targetDesktop);

// 7. Si existe Escritorio o Desktop, colocar acceso directo
if (fs.existsSync(escritorioDir)) {
  const escritorioFile = path.join(escritorioDir, 'minimarket-pos.desktop');
  fs.writeFileSync(escritorioFile, desktopContent, { mode: 0o755 });
  console.log('   ✓ Acceso directo en Escritorio creado: ' + escritorioFile);
}
if (fs.existsSync(desktopDir)) {
  const desktopFile = path.join(desktopDir, 'minimarket-pos.desktop');
  fs.writeFileSync(desktopFile, desktopContent, { mode: 0o755 });
  console.log('   ✓ Acceso directo en Desktop creado: ' + desktopFile);
}

// 8. Actualizar base de datos de escritorio si existe el comando
try {
  execSync(`update-desktop-database "${targetDesktopDir}" 2>/dev/null || true`);
} catch (e) {}

console.log('\n🎉 ¡INSTALACIÓN Y REEMPLAZO COMPLETADOS CON ÉXITO!');
