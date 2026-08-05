/**
 * Script para configurar CORS en Firebase Storage
 * Ejecutar con: node scripts/set-storage-cors.js
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const https = require('https');

// Usar las credenciales de la aplicación por defecto (Application Default Credentials)
// O pasar el serviceAccountKey.json si se tiene
let app;
try {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/devstorage.read_write'
  });

  auth.getAccessToken().then(token => {
    const bucket = 'minimarket-flor-8d7f9.firebasestorage.app';
    const corsConfig = [
      {
        origin: ['*'],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        responseHeader: [
          'Content-Type',
          'Access-Control-Allow-Origin',
          'x-goog-meta-*',
          'Authorization'
        ],
        maxAgeSeconds: 3600
      }
    ];

    const data = JSON.stringify(corsConfig);
    const options = {
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${encodeURIComponent(bucket)}/corsConfiguration`,
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
          console.log('✅ CORS configurado exitosamente en Firebase Storage');
          console.log(JSON.parse(body));
        } else {
          console.error('❌ Error:', res.statusCode, body);
        }
      });
    });

    req.on('error', e => console.error('Error de red:', e));
    req.write(data);
    req.end();
  }).catch(err => {
    console.error('Error obteniendo token:', err.message);
    console.log('\n⚠️  Para configurar CORS manualmente:');
    console.log('1. Instala gsutil: https://cloud.google.com/storage/docs/gsutil_install');
    console.log('2. Ejecuta: gsutil cors set cors.json gs://minimarket-flor-8d7f9.firebasestorage.app');
  });
} catch (e) {
  console.error('Error:', e.message);
}
