import React, { useState } from 'react';
import { usePosStore } from '../../store/usePosStore';
import type { PagoParcial, MetodoPago } from '../../store/usePosStore';
import { CreditCard, CheckCircle, X, Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (pagos: PagoParcial[]) => void;
}

export const PagosMixtosModal: React.FC<Props> = ({ isOpen, onClose, onConfirmar }) => {
  const { total } = usePosStore();
  const [pagos, setPagos] = useState<PagoParcial[]>([
    { metodo: 'efectivo', monto: 0 },
    { metodo: 'yape', monto: 0 },
  ]);

  if (!isOpen) return null;

  const totalIngresado = pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
  const pendiente = Math.max(0, Math.round(((total - totalIngresado) + Number.EPSILON) * 100) / 100);
  const vuelto = Math.max(0, Math.round(((totalIngresado - total) + Number.EPSILON) * 100) / 100);

  const handleMontoChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    const nuevosPagos = [...pagos];
    nuevosPagos[index].monto = num;
    setPagos(nuevosPagos);
  };

  const handleMetodoChange = (index: number, metodo: MetodoPago) => {
    const nuevosPagos = [...pagos];
    nuevosPagos[index].metodo = metodo;
    setPagos(nuevosPagos);
  };

  const agregarFila = () => {
    setPagos([...pagos, { metodo: 'tarjeta', monto: pendiente }]);
  };

  const removerFila = (index: number) => {
    if (pagos.length <= 1) return;
    setPagos(pagos.filter((_, i) => i !== index));
  };

  const handleConfirmar = () => {
    if (totalIngresado < total) {
      alert(`Monto insuficiente. Falta cubir S/ ${pendiente.toFixed(2)}`);
      return;
    }
    onConfirmar(pagos.filter(p => p.monto > 0));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Dividir Pago (Pago Mixto)</h3>
              <p className="text-xs text-slate-400">Combina Efectivo, Yape, Plin y Tarjeta</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Banner */}
        <div className="p-4 bg-emerald-950/30 border-b border-emerald-900/40 flex justify-between items-center px-6">
          <span className="text-sm text-emerald-200 font-medium">Total a Cobrar:</span>
          <span className="text-2xl font-black text-emerald-400">S/ {total.toFixed(2)}</span>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {pagos.map((p, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
              <select
                value={p.metodo}
                onChange={(e) => handleMetodoChange(idx, e.target.value as MetodoPago)}
                className="bg-slate-800 text-slate-200 text-sm rounded-lg border border-slate-700 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="yape">📱 Yape</option>
                <option value="plin">📱 Plin</option>
                <option value="tarjeta">💳 Tarjeta</option>
              </select>

              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">S/</span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={p.monto || ''}
                  onChange={(e) => handleMontoChange(idx, e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 text-white font-bold pl-8 pr-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {pagos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerFila(idx)}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={agregarFila}
            className="w-full py-2.5 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800/40 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Añadir otro método de pago
          </button>
        </div>

        {/* Footer Summary */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Total Ingresado:</span>
            <span className={`font-bold ${totalIngresado >= total ? 'text-emerald-400' : 'text-amber-400'}`}>
              S/ {totalIngresado.toFixed(2)}
            </span>
          </div>

          {pendiente > 0 ? (
            <div className="flex justify-between items-center text-sm text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 font-semibold">
              <span>Falta Cubrir:</span>
              <span>S/ {pendiente.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between items-center text-sm text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 font-semibold">
              <span>Vuelto a entregar:</span>
              <span>S/ {vuelto.toFixed(2)}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={totalIngresado < total}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Confirmar Pago Mixto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
