import https from 'https';
import { readFileSync, existsSync } from 'fs';

const PROJECT_ID = 'minimarket-flor-8d7f9';

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

async function getBanners(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/banners?pageSize=100`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function updateBannerField(token, docName, updateMaskFields, fields) {
  return new Promise((resolve, reject) => {
    const maskParams = updateMaskFields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/${docName}?${maskParams}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const payload = JSON.stringify({ fields });

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const token = getFirebaseToken();
  if (!token) {
    console.error('No token found');
    return;
  }

  console.log('🖼️ Inspeccionando banners en Firestore...');
  const res = await getBanners(token);
  const documents = res.documents || [];
  console.log(`Encontrados ${documents.length} banners en Firestore.\n`);

  let updatedCount = 0;

  for (const doc of documents) {
    const fields = doc.fields || {};
    const title = fields.title?.stringValue || 'Sin Título';
    const imageUrl = fields.imageUrl?.stringValue;
    const imagenUrl = fields.imagenUrl?.stringValue;
    const imagenLocal = fields.imagenLocal?.stringValue;

    console.log(`- Banner: "${title}"`);
    console.log(`  imageUrl:  ${imageUrl || 'NO TIENE'}`);
    console.log(`  imagenUrl: ${imagenUrl || 'NO TIENE'}`);

    const targetUrl = imageUrl || imagenUrl || (imagenLocal && (imagenLocal.startsWith('http://') || imagenLocal.startsWith('https://')) ? imagenLocal : null);

    if (targetUrl) {
      let needsUpdate = false;
      if (!fields.imageUrl?.stringValue || !fields.imagenUrl?.stringValue) {
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`  ⚡ Sincronizando imageUrl / imagenUrl para "${title}"...`);
        await updateBannerField(token, doc.name, ['imageUrl', 'imagenUrl'], {
          ...fields,
          imageUrl: { stringValue: targetUrl },
          imagenUrl: { stringValue: targetUrl }
        });
        updatedCount++;
        console.log(`  ✅ Banner actualizado con éxito.`);
      }
    }
    console.log('');
  }

  console.log(`🎉 Proceso completado. ${updatedCount} banners fueron corregidos con simetría de imagen.`);
}

main().catch(err => console.error('Error:', err.message));
