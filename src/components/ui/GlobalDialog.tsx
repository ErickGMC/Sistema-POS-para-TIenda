import { useUIStore } from '../../store/useUIStore';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function GlobalDialog() {
  const { dialog, closeDialog } = useUIStore();

  if (!dialog.isOpen) return null;

  const isConfirm = dialog.type === 'confirm';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            isConfirm 
              ? 'bg-blue-50 border border-blue-100 text-blue-600' 
              : 'bg-amber-50 border border-amber-100 text-amber-600'
          }`}>
            {isConfirm ? <HelpCircle size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {dialog.title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mt-2 whitespace-pre-line">
              {dialog.message}
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          {isConfirm ? (
            <>
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-500/10 transition transform active:scale-[0.98] cursor-pointer"
              >
                Confirmar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => closeDialog(true)}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-500/10 transition transform active:scale-[0.98] text-center cursor-pointer"
            >
              Aceptar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
