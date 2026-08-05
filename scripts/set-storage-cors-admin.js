/**
 * Configurar CORS de Firebase Storage usando firebase-admin con credenciales de gcloud
 * Ejecutar: node scripts/set-storage-cors-admin.js
 */

const { execSync } = require('child_process');
const https = require('https');

// Obtener token de firebase CLI
let token;
try {
  // Intentar usar gcloud si está disponible
  token = execSync('gcloud auth print-access-token 2>&1', { encoding: 'utf8' }).trim();
} catch (e) {
  console.log('⚠️  gcloud no disponible, intentando con firebase-tools...');
  try {
    // Obtener token via firebase tools
    const result = execSync(
      'npx firebase-tools --project minimarket-flor-8d7f9 apps:list 2>&1',
      { encoding: 'utf8', cwd: __dirname }
    );
    console.log('Firebase tools result:', result.substring(0, 200));
  } catch (e2) {
    console.error('No se pudo obtener token:', e2.message);
  }
}

if (!token || token.includes('ERROR')) {
  console.log('\n📋 INSTRUCCIONES MANUALES para configurar CORS:\n');
  console.log('Opción 1 (Recomendada): Consola de Google Cloud');
  console.log('1. Ve a: https://console.cloud.google.com/storage/browser/minimarket-flor-8d7f9.firebasestorage.app');
  console.log('2. Haz clic en "..." → "Edit CORS configuration"');
  console.log('3. Pega el contenido de cors.json\n');
  console.log('Opción 2: Instalar Google Cloud SDK');
  console.log('1. Descarga: https://cloud.google.com/sdk/docs/install');
  console.log('2. Ejecuta: gcloud auth login');
  console.log('3. Ejecuta: gsutil cors set cors.json gs://minimarket-flor-8d7f9.firebasestorage.app\n');
  process.exit(0);
}

const bucket = 'minimarket-flor-8d7f9.firebasestorage.app';
const corsConfig = {
  cors: [
    {
      origin: ['*'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: ['Content-Type', 'Access-Control-Allow-Origin', 'Authorization'],
      maxAgeSeconds: 3600
    }
  ]
};

const data = JSON.stringify(corsConfig);
const options = {
  hostname: 'storage.googleapis.com',
  path: `/storage/v1/b/${encodeURIComponent(bucket)}?fields=cors`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('🔧 Configurando CORS en Firebase Storage...');
const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ CORS configurado exitosamente!');
    } else {
      console.error(`❌ Error HTTP ${res.statusCode}:`, body.substring(0, 500));
    }
  });
});
req.on('error', e => console.error('Error de red:', e.message));
req.write(data);
req.end();
