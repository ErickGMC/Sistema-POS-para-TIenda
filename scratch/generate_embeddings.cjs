/**
 * generate_embeddings.cjs
 * =====================================================================
 * Script de migración en lote para generar y guardar vectores de embeddings
 * en todos los productos existentes de Firestore.
 *
 * Usa Firebase Admin SDK (bypasea las reglas de seguridad de Firestore).
 * Usa Google Gemini API (gemini-embedding-001) para generar los embeddings.
 *
 * USO:
 *   node scratch/generate_embeddings.cjs
 *
 * PREREQUISITOS:
 *   - Archivo electron/sync/firebase_config.json con las credenciales de Firebase.
 *   - Las credenciales ADC de Firebase (Application Default Credentials) configuradas,
 *     o bien el archivo de clave de servicio (service account key).
 *
 * DIMENSIONES:
 *   - gemini-embedding-001 produce 3072 dims pero truncamos a 768 para
 *     cumplir el límite de Firestore Vector Search (máx. 2048 dims).
 *   - El índice vectorial en Firestore está configurado para 768 dims.
 * =====================================================================
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// ── Configuración ────────────────────────────────────────────────────────────

const configPath = path.join(__dirname, '../electron/sync/firebase_config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ No se encontró firebase_config.json en:', configPath);
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.error('❌ Falta la variable de entorno GEMINI_API_KEY');
  process.exit(1);
}
const EMBEDDING_MODEL = 'gemini-embedding-001';
// Firestore acepta máximo 2048 dims; usamos 768 para eficiencia y compatibilidad con el índice
const EMBEDDING_DIMS = 768;
// Pausa entre requests para no saturar la API (ms)
const RATE_LIMIT_MS = 200;

// ── Inicializar Firebase Admin SDK ───────────────────────────────────────────
initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId,
});
const db = getFirestore();

// ── Inicializar Gemini ────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

// ── Funciones auxiliares ──────────────────────────────────────────────────────

/**
 * Parsea el campo etiquetas de Firestore que puede estar sobre-escapado
 * (JSON serializado múltiples veces por el POS). Retorna siempre un string[].
 */
function parsearEtiquetas(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(e => typeof e === 'string');
  if (typeof raw === 'object') return Object.values(raw).filter(e => typeof e === 'string');
  // Puede estar JSON-escapado múltiples veces
  let val = raw;
  for (let i = 0; i < 6; i++) {
    try {
      val = JSON.parse(val);
      if (Array.isArray(val)) return val.filter(e => typeof e === 'string');
      if (typeof val !== 'string') return [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Construye el texto enriquecido para el embedding.
 * Es CLAVE que este formato sea detallado para que la búsqueda semántica sea precisa.
 */
function construirTextoRAG(producto) {
  const partes = [
    `Producto: ${producto.nombre}`,
    `Categoría: ${producto.categoria || 'Sin categoría'}`,
  ];

  if (producto.descripcion && producto.descripcion.trim()) {
    partes.push(`Descripción: ${producto.descripcion.trim()}`);
  }

  const etiquetas = parsearEtiquetas(producto.etiquetas);
  if (etiquetas.length > 0) {
    partes.push(`Etiquetas: ${etiquetas.join(', ')}`);
  }

  if (producto.unidadMedida && producto.unidadMedida !== 'unidad') {
    partes.push(`Unidad: ${producto.unidadMedida}`);
  }

  partes.push(`Disponible: ${producto.disponible ? 'Sí' : 'No'}`);

  if (producto.precio != null && producto.precio > 0) {
    partes.push(`Precio: S/ ${Number(producto.precio).toFixed(2)}`);
  }

  return partes.join('. ');
}

/**
 * Genera el embedding de un texto usando Gemini gemini-embedding-001.
 * @returns Array de floats (truncado a EMBEDDING_DIMS).
 */
async function generarEmbedding(texto) {
  const result = await embeddingModel.embedContent(texto);
  // Truncar a las primeras EMBEDDING_DIMS dimensiones
  return result.embedding.values.slice(0, EMBEDDING_DIMS);
}

/**
 * Pausa de N milisegundos.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Script Principal ─────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando generación de embeddings para productos...\n');
  console.log(`   Modelo de Embeddings : ${EMBEDDING_MODEL}`);
  console.log(`   Dimensiones          : ${EMBEDDING_DIMS} (truncado del máximo del modelo)\n`);

  // 1. Leer todos los productos con Admin SDK
  console.log('📦 Leyendo productos de Firestore...');
  const snap = await db.collection('productos').get();
  const productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`📊 Total de productos encontrados: ${productos.length}\n`);

  if (productos.length === 0) {
    console.log('⚠️  No hay productos en Firestore. Termina el script.');
    process.exit(0);
  }

  let exitosos = 0;
  let errores = 0;
  let yaTeníanEmbedding = 0;

  for (let i = 0; i < productos.length; i++) {
    const producto = productos[i];
    const progress = `[${i + 1}/${productos.length}]`;

    // Saltar si ya tiene embedding válido de las dimensiones correctas
    if (
      producto.embedding &&
      Array.isArray(producto.embedding) &&
      producto.embedding.length === EMBEDDING_DIMS
    ) {
      console.log(`⏭️  ${progress} Saltando (ya tiene embedding de ${EMBEDDING_DIMS} dims): ${producto.nombre}`);
      yaTeníanEmbedding++;
      continue;
    }

    try {
      // 2. Construir texto enriquecido
      const textoRAG = construirTextoRAG(producto);
      console.log(`🔤 ${progress} Procesando: ${producto.nombre}`);
      console.log(`   Texto RAG: "${textoRAG.substring(0, 80)}..."`);

      // 3. Generar embedding (truncado a EMBEDDING_DIMS)
      const embedding = await generarEmbedding(textoRAG);

      // 4. Guardar en Firestore con Admin SDK (usa FieldValue de admin)
      await db.collection('productos').doc(producto.id).update({
        texto_rag: textoRAG,
        embedding: FieldValue.vector(embedding),
      });

      console.log(`   ✅ Guardado exitosamente (${embedding.length} dims)`);
      exitosos++;

      // Rate limiting
      await sleep(RATE_LIMIT_MS);

    } catch (err) {
      console.error(`   ❌ Error procesando "${producto.nombre}":`, err.message);
      errores++;
    }
  }

  // ── Reporte Final ────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📈 REPORTE FINAL DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Embeddings generados exitosamente : ${exitosos}`);
  console.log(`⏭️  Productos que ya tenían embedding : ${yaTeníanEmbedding}`);
  console.log(`❌ Errores                           : ${errores}`);
  console.log(`📊 Total procesados                  : ${productos.length}`);
  console.log('='.repeat(60));

  if (exitosos > 0) {
    console.log('\n🎉 ¡Migración completada! Los productos ya están listos para búsqueda semántica.');
    console.log('   Verifica el índice vectorial en:');
    console.log('   https://console.firebase.google.com/project/minimarket-flor-8d7f9/firestore/indexes\n');
  } else if (errores > 0) {
    console.log('\n⚠️  La migración tuvo errores. Revisa los logs anteriores.\n');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Error fatal en el script:', err);
  process.exit(1);
});
