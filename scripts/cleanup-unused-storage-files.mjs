import https from 'https';
import { readFileSync, existsSync } from 'fs';

const PROJECT_ID = 'minimarket-flor-8d7f9';
const BUCKET = 'minimarket-flor-8d7f9.firebasestorage.app';

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

// 1. Obtener todos los documentos de Firestore (productos y banners)
async function getFirestoreDocuments(token, collectionName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=500`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body).documents || []);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 2. Listar todos los archivos en Firebase Storage
async function listStorageFiles(token) {
  return new Promise((resolve, reject) => {
    const bucketEncoded = encodeURIComponent(BUCKET);
    const options = {
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${bucketEncoded}/o`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body).items || []);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 3. Eliminar un archivo específico de Firebase Storage
async function deleteStorageFile(token, objectName) {
  return new Promise((resolve, reject) => {
    const bucketEncoded = encodeURIComponent(BUCKET);
    const objectEncoded = encodeURIComponent(objectName);
    const options = {
      hostname: 'storage.googleapis.com',
      path: `/storage/v1/b/${bucketEncoded}/o/${objectEncoded}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const token = getFirebaseToken();
  if (!token) {
    console.error('❌ No se encontró token de autenticación en Firebase CLI');
    return;
  }

  console.log('🔍 Leyendo referencias activas desde Firestore...');
  const productosDocs = await getFirestoreDocuments(token, 'productos');
  const bannersDocs = await getFirestoreDocuments(token, 'banners');

  const activeUrls = new Set();
  const activeFileNames = new Set();

  // Extraer URLs de productos
  productosDocs.forEach(doc => {
    const fields = doc.fields || {};
    const img1 = fields.imagenUrl?.stringValue;
    const img2 = fields.imageUrl?.stringValue;
    if (img1) activeUrls.add(img1);
    if (img2) activeUrls.add(img2);
  });

  // Extraer URLs de banners
  bannersDocs.forEach(doc => {
    const fields = doc.fields || {};
    const img1 = fields.imageUrl?.stringValue;
    const img2 = fields.imagenUrl?.stringValue;
    if (img1) activeUrls.add(img1);
    if (img2) activeUrls.add(img2);
  });

  console.log(`📌 Encontradas ${activeUrls.size} URLs de imágenes activas en Firestore.`);

  console.log('📂 Escaneando archivos en Firebase Storage...');
  const storageFiles = await listStorageFiles(token);
  console.log(`📦 Encontrados ${storageFiles.length} archivos en total en Firebase Storage.\n`);

  let deletedCount = 0;
  let keptCount = 0;

  for (const file of storageFiles) {
    const fileName = file.name; // Ej: productos/ABA-Z1IN.webp o banners/GEN-UTJD.webp
    
    // Verificar si alguna URL activa contiene el nombre de este archivo o si el archivo está en uso
    const inUse = Array.from(activeUrls).some(url => {
      // Decodificar la URL para hacer match con el nombre del archivo en Storage
      const decodedUrl = decodeURIComponent(url);
      return decodedUrl.includes(fileName) || url.includes(encodeURIComponent(fileName));
    });

    if (inUse) {
      console.log(`  ✅ EN USO: ${fileName}`);
      keptCount++;
    } else {
      console.log(`  🗑️ SIN USO (Obsoleto): ${fileName}`);
      try {
        await deleteStorageFile(token, fileName);
        console.log(`     -> Archivo eliminado exitosamente.`);
        deletedCount++;
      } catch (delErr) {
        console.error(`     -> Error eliminando archivo:`, delErr.message);
      }
    }
  }

  console.log('\n========================================');
  console.log(`🎉 LIMPIEZA COMPLETADA`);
  console.log(`- Archivos activos conservados: ${keptCount}`);
  console.log(`- Archivos huérfanos/sin uso eliminados: ${deletedCount}`);
  console.log('========================================\n');
}

main().catch(err => console.error('❌ Error:', err.message));
