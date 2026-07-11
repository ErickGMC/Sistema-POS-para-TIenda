import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  const { isLoading, loadingMessage } = useUIStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 flex flex-col items-center shadow-2xl max-w-sm w-full mx-4 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
          <Loader2 size={64} className="text-emerald-400 animate-spin relative z-10" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-wide mb-2">
          {loadingMessage || 'Cargando...'}
        </h2>
        <p className="text-slate-400 text-sm">
          Por favor, espera un momento. Este proceso puede tardar unos segundos.
        </p>
      </div>
    </div>
  );
}
