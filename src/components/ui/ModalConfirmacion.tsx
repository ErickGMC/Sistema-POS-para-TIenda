import { AlertTriangle } from 'lucide-react';

interface ModalConfirmacionProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ModalConfirmacion({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: ModalConfirmacionProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-650 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-305 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium text-sm shadow-sm transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
