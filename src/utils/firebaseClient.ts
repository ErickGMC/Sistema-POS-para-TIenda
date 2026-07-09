import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

export const getFirebaseApp = async () => {
  // Solo inicializar si no hay apps ya inicializadas
  if (getApps().length === 0) {
    // Pedir la configuración a Electron (donde está guardada en electron-store)
    const configString = await (window as any).electron.getFirebaseConfig();
    
    if (!configString) {
      throw new Error('No Firebase configuration found');
    }

    const config = JSON.parse(configString);
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
