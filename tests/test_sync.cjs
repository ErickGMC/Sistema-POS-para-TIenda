require('dotenv').config && require('dotenv').config();
const { app, loginConFirebase, sincronizarCola } = require('./electron/sync/firebaseSync.cjs');

async function test() {
    console.log("Logging in...");
    const res = await loginConFirebase('admin@minimarketflor.com', 'admin123'); // or whichever user exists
    console.log("Login result:", res);
    
    console.log("Testing sync...");
    await sincronizarCola();
    console.log("Done");
    process.exit(0);
}

test().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
