import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SetupFirebaseProps {
  onSuccess: () => void;
}

export default function SetupFirebase({ onSuccess }: SetupFirebaseProps) {
  const [jsonConfig, setJsonConfig] = useState('');
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonConfig.trim()) return;
    
    setLoadingMsg('Validando credenciales y conectando con la nube...');
    setError('');
    
    try {
      // Validate JSON
      const parsedConfig = JSON.parse(jsonConfig);
      
      const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
      for (const field of requiredFields) {
        if (!parsedConfig[field]) {
          throw new Error(`El JSON está incompleto. Falta el campo: ${field}`);
        }
      }

      // Send to Electron
      const result = await (window as any).electron.setFirebaseConfig(parsedConfig);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Error al guardar la configuración');
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-xl z-10 relative">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-indigo-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6">
              <Database size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight text-center">Configurar Base de Datos</h1>
            <p className="text-slate-400 mt-3 text-center text-sm leading-relaxed max-w-sm">
              Para continuar trabajando en múltiples dispositivos, debes vincular el sistema a tu base de datos en la nube (Firebase).
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start gap-3 text-sm font-medium">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1 flex justify-between">
                <span>Configuración JSON de Firebase</span>
              </label>

              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200 mb-4">
                <p className="font-semibold mb-1">¿Cómo obtener estas credenciales?</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                  <li>Ve a <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Firebase Console</a> y crea un proyecto.</li>
                  <li>Ve a Configuración del Proyecto (Project Settings).</li>
                  <li>En la pestaña "General", baja hasta "Tus aplicaciones" y añade una app Web (&lt;/&gt;).</li>
                  <li>Copia el objeto <code className="bg-slate-800 px-1 rounded text-blue-300">firebaseConfig</code> que te proporciona Firebase y pégalo aquí abajo en formato JSON.</li>
                  <li>Asegúrate de habilitar <strong>Firestore Database</strong>, <strong>Storage</strong> y <strong>Authentication (Email/Password)</strong> en tu proyecto.</li>
                </ol>
              </div>

              <div className="relative">
                <textarea
                  autoFocus
                  required
                  value={jsonConfig}
                  onChange={e => setJsonConfig(e.target.value)}
                  className="w-full h-48 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl p-4 text-white font-mono text-sm outline-none transition-all resize-none shadow-inner"
                  placeholder={`{
  "apiKey": "AIzaSy...",
  "authDomain": "tu-proyecto.firebaseapp.com",
  "projectId": "tu-proyecto",
  "storageBucket": "tu-proyecto.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcde",
  "measurementId": "G-123456"
}`}
                />
              </div>
            </div>
            
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex gap-3 text-xs text-slate-400">
              <ShieldCheck size={20} className="text-indigo-400 shrink-0" />
              <p>Esta información se guardará localmente en esta computadora de forma segura. Nunca se compartirá ni sincronizará con otros dispositivos.</p>
            </div>

            <button
              type="submit"
              disabled={!!loadingMsg}
              className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-lg rounded-xl py-3.5 mt-4 transition-all duration-300 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-wait"
            >
              <CheckCircle size={20} className={loadingMsg ? "animate-pulse" : "group-hover:scale-110 transition-transform"} />
              {loadingMsg ? loadingMsg : 'Guardar y Continuar'}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}
