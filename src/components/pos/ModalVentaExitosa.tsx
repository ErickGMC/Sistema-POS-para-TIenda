import React, { useState } from 'react';
import { CheckCircle2, FileText, Phone, MessageCircle, X } from 'lucide-react';

interface ModalVentaExitosaProps {
  venta: any | null;
  clienteTelefono?: string;
  onClose: () => void;
  onPrintPdf: (venta: any) => void;
  onSendWhatsApp: (phone: string, venta: any) => void;
}

export const ModalVentaExitosa: React.FC<ModalVentaExitosaProps> = ({
  venta,
  clienteTelefono = '',
  onClose,
  onPrintPdf,
  onSendWhatsApp,
}) => {
  const [waPhone, setWaPhone] = useState(clienteTelefono);

  if (!venta) return null;

  const handleSendWa = () => {
    const phone = waPhone || clienteTelefono;
    if (phone.trim()) {
      onSendWhatsApp(phone.trim(), venta);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-[480px] bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 hover:text-slate-900 transition z-10 cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Venta Exitosa!</h3>
          <p className="text-slate-600 mb-6">
            El ticket <strong className="text-emerald-600">{venta.id}</strong> se ha guardado correctamente.
          </p>

          <div className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 mb-5 text-center">
            <span className="block text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">
              Monto Cobrado
            </span>
            <span className="text-4xl font-black text-emerald-600">
              S/ {Number(venta.total).toFixed(2)}
            </span>
          </div>

          <div className="w-full space-y-3 mb-6">
            <button
              onClick={() => onPrintPdf(venta)}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <FileText size={20} />
              📲 Generar / Enviar Ticket PDF (Ficha 4x6)
            </button>

            <div className="w-full text-left pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                <Phone size={14} /> Enviar Texto por WhatsApp
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-3.5 text-slate-400 text-sm font-semibold">+</span>
                  <input
                    type="text"
                    placeholder="Ej: 51999999999"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded-xl p-3 pl-8 text-slate-900 focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] outline-none transition-all shadow-sm font-bold text-sm"
                  />
                </div>
                <button
                  onClick={handleSendWa}
                  className="bg-[#25D366] hover:bg-[#20b858] text-slate-950 font-black px-4 rounded-xl flex items-center justify-center transition-colors shadow-md shadow-[#25D366]/20 cursor-pointer"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            ✓ Finalizar (Nueva Venta)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalVentaExitosa;
