import https from 'https';
import { readFileSync, existsSync } from 'fs';

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

function getFirebaseToken() {
  const configPath = 'C:\\Users\\erfox\\.config\\configstore\\firebase-tools.json';
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (config.tokens && config.tokens.access_token) {
      return config.tokens.access_token;
    }
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
        console.log('Storage API Response Code:', res.statusCode);
        console.log('Storage API Response Body:', body);
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const token = getFirebaseToken();
  if (!token) {
    console.log('No access token found');
    return;
  }

  console.log('Configurando CORS en Firebase Storage con el token recién actualizado...');
  await setCors(token);
  console.log('🎉 CORS configurado exitosamente en Firebase Storage!');
}

main().catch(err => {
  console.error('❌ Error en main:', err.message);
});
