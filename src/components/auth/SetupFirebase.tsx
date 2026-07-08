import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SetupFirebaseProps {
  onSuccess: () => void;
}

export default function SetupFirebase({ onSuccess }: SetupFirebaseProps) {
  const [jsonConfig, setJsonConfig] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonConfig.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Validate JSON
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(jsonConfig);
      } catch (err) {
        throw new Error('El texto ingresado no es un JSON válido. Asegúrate de copiar el objeto completo.');
      }

      // Check for required fields roughly
      const requiredKeys = ['apiKey', 'projectId', 'authDomain'];
      for (const key of requiredKeys) {
        if (!parsedConfig[key]) {
          throw new Error(`Falta la propiedad requerida: ${key}. Por favor verifica el formato.`);
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
      setLoading(false);
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
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-lg rounded-xl py-3.5 mt-4 transition-all duration-300 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              <CheckCircle size={20} className="group-hover:scale-110 transition-transform" />
              {loading ? 'Validando...' : 'Guardar y Continuar'}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}
