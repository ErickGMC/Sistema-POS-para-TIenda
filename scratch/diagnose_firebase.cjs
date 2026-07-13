const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const fs = require('fs');
const path = require('path');

// Intentar leer la configuración de Firebase guardada en el sistema
function getFirebaseConfig() {
    try {
        const { app: eApp } = require('electron');
        // fallback si no estamos en electron
        const configDir = eApp ? eApp.getPath('userData') : __dirname;
        const configPath = path.join(configDir, 'firebase_config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch {}
    
    // Fallback local en tienda-pos
    const localPath = path.join(__dirname, '../electron/sync/firebase_config.json');
    if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }
    
    // Intenta buscar en AppData directamente
    const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.config');
    const appDataPath = path.join(appData, 'Minimarket POS', 'firebase_config.json');
    if (fs.existsSync(appDataPath)) {
        return JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
    }
    
    return null;
}

async function testConnection() {
    const config = getFirebaseConfig();
    if (!config) {
        console.error("No se encontró ningún archivo firebase_config.json guardado.");
        process.exit(1);
    }
    
    console.log("Configuración de Firebase encontrada para el proyecto:", config.projectId);
    const app = initializeApp(config);
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    console.log("\n--- PRUEBA 1: Lectura Pública (Colección 'productos') ---");
    try {
        const prodSnap = await getDocs(query(collection(db, 'productos'), limit(1)));
        console.log("✅ Lectura pública exitosa. Documentos encontrados:", prodSnap.size);
    } catch (e) {
        console.error("❌ Falló la lectura pública de 'productos':", e.message);
    }
    
    console.log("\n--- PRUEBA 2: Lectura Protegida sin Autenticación (Colección 'usuarios') ---");
    try {
        await getDocs(query(collection(db, 'usuarios'), limit(1)));
        console.log("⚠️ ¡Lectura de 'usuarios' permitida sin autenticación! (Esto es un riesgo de seguridad)");
    } catch (e) {
        console.log("✅ Lectura de 'usuarios' bloqueada correctamente para usuarios no autenticados. Detalle:", e.message);
    }

    // Si pasamos credenciales como argumentos por consola, probamos autenticación
    const args = process.argv.slice(2);
    if (args.length >= 2) {
        const email = args[0];
        const pass = args[1];
        console.log(`\n--- PRUEBA 3: Iniciando sesión con: ${email} ---`);
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, pass);
            console.log("✅ Login exitoso en Firebase Auth. UID:", userCred.user.uid);
            
            console.log("\n--- PRUEBA 4: Lectura Protegida con Autenticación (Colección 'usuarios') ---");
            try {
                const userSnap = await getDocs(query(collection(db, 'usuarios'), limit(1)));
                console.log("✅ Lectura de 'usuarios' exitosa con autenticación. Documentos encontrados:", userSnap.size);
            } catch (e) {
                console.error("❌ Falló la lectura de 'usuarios' a pesar de estar autenticado:", e.message);
                console.error("👉 Esto confirma que las reglas de Firestore en la consola web están bloqueando al usuario logueado.");
            }
        } catch (e) {
            console.error("❌ Falló el login en Firebase Auth:", e.message);
        }
    } else {
        console.log("\n💡 Para probar la lectura autenticada, ejecuta este script pasando el correo y contraseña como argumentos:");
        console.log("   node scratch/diagnose_firebase.cjs tu_correo@gmail.com tu_contraseña");
    }
}

testConnection();
