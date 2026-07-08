const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const { app: firebaseApp } = require('./firebaseSync.cjs'); // Necesito exportar app desde firebaseSync.cjs

const storage = getStorage(firebaseApp);

async function uploadImageToStorage(localPath, filename) {
    try {
        const fileBuffer = await fs.promises.readFile(localPath);
        
        // Node 18+ Uint8Array / Buffer works with uploadBytes
        const storageRef = ref(storage, `productos/${filename}`);
        
        const metadata = {
            contentType: 'image/webp',
        };

        const snapshot = await uploadBytes(storageRef, fileBuffer, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return { success: true, url: downloadURL };
    } catch (error) {
        console.error('Error subiendo imagen a Storage:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    uploadImageToStorage
};
