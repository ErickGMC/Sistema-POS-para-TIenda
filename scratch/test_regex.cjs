const firebaseStr = `const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcde",
};`;

let jsonConfig = firebaseStr;
const match = jsonConfig.match(/\{[\s\S]*\}/);
let cleanStr = match ? match[0] : jsonConfig;

// Convertimos claves sin comillas a claves con comillas dobles
cleanStr = cleanStr.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

// Convertimos comillas simples a comillas dobles
cleanStr = cleanStr.replace(/:\s*'([^']*)'/g, ':"$1"');

// Quitamos comas al final antes de cerrar llave
cleanStr = cleanStr.replace(/,\s*}/g, '}');

console.log(JSON.parse(cleanStr));
