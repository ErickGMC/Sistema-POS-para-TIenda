import React, { useState, useEffect, useRef } from 'react';
import { Scale, X, Image as ImageIcon } from 'lucide-react';

interface ModalPesajeProps {
  isOpen: boolean;
  producto: any | null;
  ticketItemId: string | null;
  pesoInicial?: string;
  onClose: () => void;
  onConfirm: (peso: number) => void;
}

export const ModalPesaje: React.FC<ModalPesajeProps> = ({
  isOpen,
  producto,
  ticketItemId,
  pesoInicial = '0.500',
  onClose,
  onConfirm,
}) => {
  const [pesoInput, setPesoInput] = useState<string>(pesoInicial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPesoInput(pesoInicial);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
    }
  }, [isOpen, pesoInicial]);

  if (!isOpen || !producto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const peso = parseFloat(pesoInput);
    if (!isNaN(peso) && peso > 0) {
      onConfirm(peso);
      onClose();
    }
  };

  const precioUnitario = Number(producto.precio) || 0;
  const pesoNum = parseFloat(pesoInput) || 0;
  const subtotalCalculado = Math.round(pesoNum * precioUnitario * 100) / 100;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-850 leading-tight">
                {ticketItemId ? 'Ajustar Peso' : 'Pesar Producto'}
              </h3>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                Venta por Peso / Granel
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ficha del Producto */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-4">
          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
            {producto.imagenLocal || producto.imagenUrl ? (
              <img
                src={producto.imagenLocal || producto.imagenUrl}
                alt={producto.nombre}
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon size={24} className="text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm truncate">{producto.nombre}</div>
            <div className="text-xs text-slate-500 mt-0.5">{producto.categoria}</div>
            <div className="text-xs font-extrabold text-emerald-700 mt-1">
              Precio: S/ {precioUnitario.toFixed(2)} / kg
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Principal de Peso */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between items-center">
              <span>Peso registrado en balanza (Kilogramos)</span>
              <span className="text-[11px] text-slate-500 font-normal">Hasta 3 decimales</span>
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="0.000"
                value={pesoInput}
                onChange={(e) => setPesoInput(e.target.value)}
                className="w-full bg-slate-50 border-2 border-emerald-500/40 focus:border-emerald-600 rounded-2xl py-3 pl-4 pr-16 text-3xl font-black text-slate-900 focus:outline-none transition-all text-center tracking-wider"
              />
              <span className="absolute right-4 font-black text-slate-400 text-lg pointer-events-none">
                KG
              </span>
            </div>
          </div>

          {/* Botones de Peso Rápido */}
          <div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Accesos rápidos de peso
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '+100 g', delta: 0.1 },
                { label: '+250 g', delta: 0.25 },
                { label: '+500 g', delta: 0.5 },
                { label: '+1.00 kg', delta: 1.0 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => {
                    const actual = parseFloat(pesoInput) || 0;
                    const nuevo = Math.round((actual + btn.delta) * 1000) / 1000;
                    setPesoInput(nuevo.toFixed(3));
                    inputRef.current?.focus();
                  }}
                  className="py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[
                { label: '¼ kg', val: '0.250' },
                { label: '½ kg', val: '0.500' },
                { label: '¾ kg', val: '0.750' },
                { label: 'Borrar', val: '' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => {
                    setPesoInput(btn.val);
                    inputRef.current?.focus();
                  }}
                  className={`py-1.5 font-bold text-xs rounded-xl transition cursor-pointer border ${
                    btn.label === 'Borrar'
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtotal en tiempo real */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-extrabold text-emerald-800 tracking-wider">
                Total Calculado
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-0.5">
                {pesoInput ? `${pesoInput} kg` : '0.000 kg'} × S/ {precioUnitario.toFixed(2)}
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700">
              S/ {subtotalCalculado.toFixed(2)}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center italic">
            Pesa en tu balanza física e ingresa el peso mostrado en pantalla.
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Confirmar Peso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalPesaje;
