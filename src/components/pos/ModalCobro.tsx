import React, { useState, useEffect } from 'react';
import { Banknote, CheckCircle2, X } from 'lucide-react';

interface ModalCobroProps {
  isOpen: boolean;
  total: number;
  cargandoCobro: boolean;
  errorCobro?: string;
  clienteNombreInicial?: string;
  clienteDocumentoInicial?: string;
  clienteTelefonoInicial?: string;
  onClose: () => void;
  onConfirm: (data: {
    metodoPago: 'efectivo' | 'tarjeta' | 'yape' | 'plin';
    montoRecibido: number;
    clienteNombre: string;
    clienteDocumento: string;
    clienteTelefono: string;
  }) => void;
}

export const ModalCobro: React.FC<ModalCobroProps> = ({
  isOpen,
  total,
  cargandoCobro,
  errorCobro = '',
  clienteNombreInicial = '',
  clienteDocumentoInicial = '',
  clienteTelefonoInicial = '',
  onClose,
  onConfirm,
}) => {
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'yape' | 'plin'>('efectivo');
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [clienteNombre, setClienteNombre] = useState(clienteNombreInicial);
  const [clienteDocumento, setClienteDocumento] = useState(clienteDocumentoInicial);
  const [clienteTelefono, setClienteTelefono] = useState(clienteTelefonoInicial);

  useEffect(() => {
    if (isOpen) {
      setMontoRecibido('');
      setClienteNombre(clienteNombreInicial);
      setClienteDocumento(clienteDocumentoInicial);
      setClienteTelefono(clienteTelefonoInicial);
    }
  }, [isOpen, clienteNombreInicial, clienteDocumentoInicial, clienteTelefonoInicial]);

  if (!isOpen) return null;

  const numMonto = parseFloat(montoRecibido) || 0;
  const vuelto = metodoPago === 'efectivo' ? Math.max(0, numMonto - total) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (metodoPago === 'efectivo' && numMonto < total) return;

    onConfirm({
      metodoPago,
      montoRecibido: metodoPago === 'efectivo' ? numMonto : total,
      clienteNombre: clienteNombre.trim(),
      clienteDocumento: clienteDocumento.trim(),
      clienteTelefono: clienteTelefono.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-[500px] bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 hover:text-slate-900 transition z-10 cursor-pointer"
        >
          <X size={18} />
        </button>

        <h3 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Banknote className="text-emerald-600" />
          Finalizar Transacción
        </h3>
        <p className="text-slate-600 text-xs mb-6">
          Completa el método de pago y la información opcional para el ticket SUNAT.
        </p>

        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 mb-6 flex justify-between items-center">
          <span className="text-slate-600 font-medium">TOTAL A PAGAR</span>
          <span className="text-3xl font-black text-emerald-600">S/ {total.toFixed(2)}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorCobro && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{errorCobro}</span>
            </div>
          )}

          {/* Selector de Método de Pago */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 ml-1">
              Método de Pago
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['efectivo', 'tarjeta', 'yape', 'plin'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodoPago(m)}
                  className={`py-3.5 px-2 rounded-xl text-xs font-black text-center border capitalize transition-all cursor-pointer ${
                    metodoPago === m
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-350 shadow-sm'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Si es Efectivo, mostrar cálculo de vuelto */}
          {metodoPago === 'efectivo' && (
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1 ml-1">Monto Recibido</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-600 text-sm font-bold">S/</span>
                  <input
                    required
                    type="number"
                    min={total}
                    step="0.1"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder="Ej: 50.00"
                    className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-xl p-2.5 pl-8 text-slate-900 text-lg font-black focus:border-emerald-500 outline-none shadow-sm transition"
                  />
                </div>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-650 mb-1">Vuelto a entregar</span>
                <div
                  className={`text-2xl font-black p-2 bg-white border border-slate-300 rounded-xl text-center ${
                    vuelto > 0 ? 'text-amber-600' : 'text-slate-500'
                  }`}
                >
                  S/ {vuelto.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Datos de Cliente & Contacto */}
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 shadow-sm space-y-2.5">
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider ml-1">
              Datos del Cliente & WhatsApp (Opcional)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <input
                  type="text"
                  placeholder="DNI / RUC"
                  maxLength={11}
                  value={clienteDocumento}
                  onChange={(e) => setClienteDocumento(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-xl p-3 text-sm text-slate-900 focus:border-blue-500 outline-none shadow-sm transition"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Nombre o Razón Social"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-xl p-3 text-sm text-slate-900 focus:border-blue-500 outline-none shadow-sm transition"
                />
              </div>
            </div>
            <div className="col-span-3">
              <input
                type="tel"
                placeholder="📲 Celular / WhatsApp (ej: 51987654321)"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:border-emerald-500 outline-none shadow-sm transition"
              />
            </div>
          </div>

          {/* Botón de Confirmar y Finalizar */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={cargandoCobro}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 size={20} />
              {cargandoCobro ? 'PROCESANDO VENTA...' : 'CONFIRMAR VENTA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCobro;
