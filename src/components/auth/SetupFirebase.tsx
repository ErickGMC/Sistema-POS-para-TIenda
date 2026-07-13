import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';

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
      let parsedConfig;
      try {
        // Intento de parseo estándar de JSON
        parsedConfig = JSON.parse(jsonConfig);
      } catch {
        // Si falla, intentamos convertir el formato JS Object de Firebase a JSON válido
        // 1. Extraemos solo el objeto si pegaron "const firebaseConfig = { ... };"
        const match = jsonConfig.match(/\{[\s\S]*\}/);
        let cleanStr = match ? match[0] : jsonConfig;
        
        // 2. Convertimos claves sin comillas a claves con comillas dobles
        cleanStr = cleanStr.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // 3. Convertimos comillas simples a comillas dobles
        cleanStr = cleanStr.replace(/:\s*'([^']*)'/g, ':"$1"');
        
        // 4. Quitamos comas al final antes de cerrar llave
        cleanStr = cleanStr.replace(/,\s*}/g, '}');
        
        parsedConfig = JSON.parse(cleanStr);
      }
      
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
      if (err instanceof SyntaxError) {
        setError('El texto ingresado no es un JSON válido. Verifica que copiaste el objeto completo desde Firebase Console.');
      } else {
        setError(err.message || 'Error desconocido');
      }
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex items-center justify-center overflow-y-auto relative p-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-4xl z-10 relative">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
          
          {/* Layout de 2 columnas */}
          <div className="flex flex-col lg:flex-row">
            
            {/* Panel Izquierdo: Info y Instrucciones */}
            <div className="lg:w-[45%] p-5 lg:p-6 bg-white lg:border-r border-b lg:border-b-0 border-slate-200 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                  <Database size={24} className="text-slate-900" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Configurar Base de Datos</h1>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Vincula el sistema a tu Firebase
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-200 flex-1">
                <p className="font-semibold mb-2 flex items-center gap-1.5">
                  <ExternalLink size={12} />
                  ¿Cómo obtener las credenciales?
                </p>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-700 leading-relaxed">
                  <li>Ve a <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">Firebase Console</a> y crea un proyecto.</li>
                  <li>Ve a Configuración del Proyecto (Project Settings).</li>
                  <li>En "General", baja hasta "Tus aplicaciones" y añade una app Web (&lt;/&gt;).</li>
                  <li>Copia el objeto <code className="bg-slate-100 px-1 rounded text-blue-300">firebaseConfig</code> y pégalo en el campo de la derecha.</li>
                  <li>Habilita <strong>Firestore Database</strong>, <strong>Storage</strong> y <strong>Authentication (Email/Password)</strong>.</li>
                </ol>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex gap-2.5 text-xs text-slate-600 mt-3">
                <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <p>Esta información se guardará localmente en esta computadora de forma segura. Nunca se compartirá ni sincronizará con otros dispositivos.</p>
              </div>
            </div>

            {/* Panel Derecho: Formulario */}
            <div className="lg:w-[55%] p-5 lg:p-6 flex flex-col justify-center">
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-slate-700 ml-1 block mb-1.5">
                    Configuración de Firebase
                  </label>
                  <textarea
                    autoFocus
                    required
                    value={jsonConfig}
                    onChange={e => setJsonConfig(e.target.value)}
                    className="w-full h-44 bg-white border border-slate-350 hover:border-slate-400 focus:border-blue-500 rounded-xl p-3 text-slate-900 font-mono text-xs outline-none transition-all resize-none shadow-sm leading-relaxed"
                    placeholder={`const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcde"
};`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!!loadingMsg}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl py-3 transition-all duration-300 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <CheckCircle size={18} className={loadingMsg ? "animate-pulse" : "group-hover:scale-110 transition-transform"} />
                  {loadingMsg ? loadingMsg : 'Guardar y Continuar'}
                </button>
              </form>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
