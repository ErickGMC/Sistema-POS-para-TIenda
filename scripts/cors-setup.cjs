/**
 * Script para obtener el token de Firebase CLI y configurar CORS en Firebase Storage
 * Ejecutar: node scripts/cors-setup.js
 */

const { execSync, spawn } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

const BUCKET = 'minimarket-flor-8d7f9.firebasestorage.app';

const CORS_CONFIG = {
  cors: [
    {
      origin: ['*'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Access-Control-Allow-Origin',
        'Authorization',
        'x-goog-resumable'
      ],
      maxAgeSeconds: 3600
    }
  ]
};

/**
 * Intenta obtener un token de acceso usando firebase CLI
 * que ya está autenticado con erickmartinezc@gmail.com
 */
async function getFirebaseToken() {
  // Buscar el token almacenado por firebase CLI en %APPDATA%
  const possiblePaths = [
    path.join(process.env.APPDATA || '', 'firebase', 'config.json'),
    path.join(process.env.HOME || '', '.config', 'firebase', 'config.json'),
    path.join(process.env.HOME || '', '.config', 'firebase', 'credentials.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('Encontrado:', p);
      const content = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log('Keys:', Object.keys(content).join(', '));
    }
  }

  // Intentar con google-auth-library si está disponible en node_modules
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/devstorage.full_control']
    });
    const token = await auth.getAccessToken();
    return token;
  } catch (e) {
    console.log('google-auth-library no disponible:', e.message);
  }

  return null;
}

async function setCors(token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(CORS_CONFIG);
    const bucketEncoded = encodeURIComponent(BUCKET);
    
    const options = {
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${bucketEncoded}?fields=cors`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ CORS configurado exitosamente en Firebase Storage!');
          console.log('Configuración:', JSON.stringify(JSON.parse(body).cors, null, 2));
          resolve(true);
        } else {
          console.error(`❌ Error HTTP ${res.statusCode}:`, body.substring(0, 300));
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Configurando CORS en Firebase Storage...\n');
  
  const token = await getFirebaseToken();
  
  if (!token) {
    console.log('\n❌ No se pudo obtener un token de autenticación automáticamente.\n');
    console.log('=== INSTRUCCIONES MANUALES ===\n');
    console.log('Ve a esta URL en tu navegador:');
    console.log('https://console.cloud.google.com/storage/browser/minimarket-flor-8d7f9.firebasestorage.app?project=minimarket-flor-8d7f9\n');
    console.log('1. Haz clic en los "..." (tres puntos) del bucket');
    console.log('2. Selecciona "Edit CORS configuration"');
    console.log('3. Pega este JSON:\n');
    console.log(JSON.stringify(CORS_CONFIG.cors, null, 2));
    console.log('\n=============================');
    return;
  }

  try {
    await setCors(token);
  } catch (e) {
    console.error('Error configurando CORS:', e.message);
  }
}

main();
