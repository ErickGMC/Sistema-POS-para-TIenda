import React, { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';

interface ModalItemPersonalizadoProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (nombre: string, precio: number, cantidad: number) => void;
}

export const ModalItemPersonalizado: React.FC<ModalItemPersonalizadoProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(precio);
    const c = parseFloat(cantidad);
    if (!nombre.trim() || isNaN(p) || p < 0 || isNaN(c) || c <= 0) return;

    onAdd(nombre.trim(), p, c);
    setNombre('');
    setPrecio('');
    setCantidad('1');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <PlusCircle className="text-indigo-600" size={22} />
            Agregar Servicio / Ítem Libre
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Ingresa cualquier producto o servicio fuera del catálogo (ej: Delivery, Empaque de Regalo). No afecta el stock de la base de datos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Servicio / Ítem</label>
            <input
              type="text"
              required
              placeholder="Ej: Servicio de Delivery / Envío"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-medium text-slate-800 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Precio Unit. (S/)</label>
              <input
                type="number"
                step="0.10"
                min="0"
                required
                placeholder="0.00"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-800 focus:border-indigo-500 outline-none text-center"
              />
            </div>
          </div>

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
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Agregar a Cesta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalItemPersonalizado;
