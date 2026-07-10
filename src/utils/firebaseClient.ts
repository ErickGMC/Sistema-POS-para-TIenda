import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

export const getFirebaseApp = async () => {
  if (getApps().length === 0) {
    // Pedir la configuración a Electron (donde está guardada localmente)
    const config = await (window as any).electron.getFirebaseConfig();
    
    if (!config) {
      throw new Error('No Firebase configuration found');
    }

    // IPC de Electron ya deserializa el objeto automáticamente — no necesita JSON.parse
    return initializeApp(config);
  }
  return getApp();
};

export const getDb = async () => {
  if (!firestoreInstance) {
    const app = await getFirebaseApp();
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
};
