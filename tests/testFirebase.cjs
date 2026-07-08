const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyD0GPWoxJAxMvK6u8ZE1F24CXxJRYvdoxo",
  authDomain: "minimarket-flor-8d7f9.firebaseapp.com",
  projectId: "minimarket-flor-8d7f9",
  storageBucket: "minimarket-flor-8d7f9.firebasestorage.app",
  messagingSenderId: "519884713211",
  appId: "1:519884713211:web:294f2cc23a85f0915cd45e",
  measurementId: "G-RR67HZRXFE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

async function run() {
  try {
    console.log('Logging in...');
    const userCredential = await signInWithEmailAndPassword(auth, 'admin@minimarketflor.com', 'admin123'); // Assuming default admin login for test
    console.log('Logged in as', userCredential.user.uid);
    
    fs.writeFileSync('dummy.txt', 'hello world');
    const fileBuffer = fs.readFileSync('dummy.txt');
    const storageRef = ref(storage, `productos/dummy.txt`);
    
    console.log('Uploading...');
    const snapshot = await uploadBytes(storageRef, new Uint8Array(fileBuffer), { contentType: 'text/plain' });
    console.log('Uploaded!');
    const url = await getDownloadURL(snapshot.ref);
    console.log('URL:', url);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit();
}

run();
