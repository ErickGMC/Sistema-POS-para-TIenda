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

async function getProducts(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/productos?pageSize=300`,
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

async function updateProductField(token, docName, updateMaskFields, fields) {
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

  console.log('📦 Inspeccionando productos en Firestore...');
  const res = await getProducts(token);
  const documents = res.documents || [];
  console.log(`Encontrados ${documents.length} productos en Firestore.\n`);

  let updatedCount = 0;

  for (const doc of documents) {
    const fields = doc.fields || {};
    const nombre = fields.nombre?.stringValue || 'Sin Nombre';
    const imagenUrl = fields.imagenUrl?.stringValue;
    const imageUrl = fields.imageUrl?.stringValue;

    console.log(`- Producto: "${nombre}"`);
    console.log(`  imagenUrl: ${imagenUrl || 'NO TIENE'}`);
    console.log(`  imageUrl:  ${imageUrl || 'NO TIENE'}`);

    const targetUrl = imagenUrl || imageUrl;

    if (targetUrl) {
      let needsUpdate = false;
      const newFields = { ...fields };

      if (!fields.imagenUrl?.stringValue && targetUrl) {
        newFields.imagenUrl = { stringValue: targetUrl };
        needsUpdate = true;
      }
      if (!fields.imageUrl?.stringValue && targetUrl) {
        newFields.imageUrl = { stringValue: targetUrl };
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`  ⚡ Actualizando sincronía imagenUrl/imageUrl para "${nombre}"...`);
        await updateProductField(token, doc.name, ['imagenUrl', 'imageUrl'], {
          ...fields,
          imagenUrl: { stringValue: targetUrl },
          imageUrl: { stringValue: targetUrl }
        });
        updatedCount++;
        console.log(`  ✅ Actualizado exitosamente.`);
      }
    }
    console.log('');
  }

  console.log(`🎉 Proceso completado. ${updatedCount} productos fueron corregidos con simetría imagenUrl / imageUrl.`);
}

main().catch(err => console.error('Error:', err.message));
