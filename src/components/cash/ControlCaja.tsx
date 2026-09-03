import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  PlusCircle, 
  MinusCircle, 
  Clock, 
  Printer, 
  History, 
  Calculator, 
  FileText,
  RefreshCw,
  X,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { imprimirCierreCaja } from '../../utils/ticketPrinter';

interface TurnoCaja {
  id: string;
  fechaApertura: string;
  fechaCierre?: string | null;
  montoInicial: number;
  totalVentasEfectivo: number;
  totalVentasDigital: number;
  totalIngresos: number;
  totalEgresos: number;
  montoEsperado: number;
  montoFinalReal?: number | null;
  diferencia?: number | null;
  estado: 'abierta' | 'cerrada';
  cajero: string;
  observaciones?: string | null;
  movimientos?: MovimientoCaja[];
}

interface MovimientoCaja {
  id: string;
  turnoId: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  motivo: string;
  fecha: string;
}

const DENOMINACIONES_BILLETES = [200, 100, 50, 20, 10];
const DENOMINACIONES_MONEDAS = [5, 2, 1, 0.50, 0.20, 0.10];

export default function ControlCaja() {
  const { user } = useAuthStore();
  const { showConfirm } = useUIStore();
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [turnoActual, setTurnoActual] = useState<TurnoCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pestaña, setPestaña] = useState<'actual' | 'historial'>('actual');
  const [historialTurnos, setHistorialTurnos] = useState<TurnoCaja[]>([]);

  // Modales
  const [modalApertura, setModalApertura] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState<'ingreso' | 'egreso' | null>(null);
  const [modalCierre, setModalCierre] = useState(false);

  // Formulario Apertura
  const [fondoInicial, setFondoInicial] = useState<string>('50');
  const [cajeroApertura, setCajeroApertura] = useState<string>(user?.username || 'Cajero Principal');

  // Formulario Movimiento
  const [montoMovimiento, setMontoMovimiento] = useState<string>('');
  const [motivoMovimiento, setMotivoMovimiento] = useState<string>('');

  // Formulario Cierre / Arqueo
  const [modoArqueo, setModoArqueo] = useState<'desglose' | 'directo'>('desglose');
  const [montoDirecto, setMontoDirecto] = useState<string>('');
  const [conteoBilletes, setConteoBilletes] = useState<Record<number, number>>({});
  const [conteoMonedas, setConteoMonedas] = useState<Record<number, number>>({});
  const [observacionesCierre, setObservacionesCierre] = useState<string>('');
  const [imprimirTicketAlCerrar, setImprimirTicketAlCerrar] = useState<boolean>(true);

  // Cargar estado inicial
  const cargarTurnoActual = useCallback(async () => {
    setCargando(true);
    try {
      const res = await (window as any).electron.obtenerTurnoActual();
      if (res && res.success) {
        setTurnoActual(res.turno);
      } else {
        setTurnoActual(null);
      }
    } catch (err) {
      console.error('Error cargando turno:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarHistorial = useCallback(async () => {
    try {
      const res = await (window as any).electron.obtenerHistorialTurnos(30);
      if (res && res.success) {
        setHistorialTurnos(res.turnos || []);
      }
    } catch (err) {
      console.error('Error cargando historial de turnos:', err);
    }
  }, []);

  useEffect(() => {
    cargarTurnoActual();
  }, [cargarTurnoActual]);

  useEffect(() => {
    if (pestaña === 'historial') {
      cargarHistorial();
    }
  }, [pestaña, cargarHistorial]);

  // Manejador Apertura de Turno
  const handleAbrirTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(fondoInicial);
    if (isNaN(monto) || monto < 0) {
      showToast('Ingresa un monto de fondo inicial válido.', 'error');
      return;
    }

    try {
      const res = await (window as any).electron.abrirTurno(monto, cajeroApertura.trim() || 'Cajero');
      if (res.success) {
        showToast('Turno de caja abierto correctamente.', 'success');
        setModalApertura(false);
        setTurnoActual(res.turno);
        cargarTurnoActual();
      } else {
        showToast(res.error || 'No se pudo abrir el turno.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al conectar con la base de datos.', 'error');
    }
  };

  // Manejador Registro de Movimiento
  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActual) return;

    const monto = parseFloat(montoMovimiento);
    if (isNaN(monto) || monto <= 0) {
      showToast('El monto debe ser mayor a S/ 0.00', 'error');
      return;
    }
    if (!motivoMovimiento.trim()) {
      showToast('Debes ingresar un motivo o justificación.', 'error');
      return;
    }

    try {
      const res = await (window as any).electron.registrarMovimientoCaja({
        turnoId: turnoActual.id,
        tipo: modalMovimiento,
        monto,
        motivo: motivoMovimiento.trim()
      });

      if (res.success) {
        showToast(`Movimiento de ${modalMovimiento} registrado.`, 'success');
        setModalMovimiento(null);
        setMontoMovimiento('');
        setMotivoMovimiento('');
        cargarTurnoActual();
      } else {
        showToast(res.error || 'Error al registrar movimiento.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error registrando movimiento.', 'error');
    }
  };

  // Cálculo Arqueo Físico
  const calcularTotalDesglose = () => {
    let total = 0;
    DENOMINACIONES_BILLETES.forEach(den => {
      total += den * (conteoBilletes[den] || 0);
    });
    DENOMINACIONES_MONEDAS.forEach(den => {
      total += den * (conteoMonedas[den] || 0);
    });
    return Math.round(total * 100) / 100;
  };

  const totalRealContado = modoArqueo === 'desglose' 
    ? calcularTotalDesglose() 
    : (parseFloat(montoDirecto) || 0);

  const diferenciaArqueo = turnoActual 
    ? Math.round((totalRealContado - turnoActual.montoEsperado) * 100) / 100 
    : 0;

  // Manejador Cierre de Turno
  const handleCerrarTurno = async () => {
    if (!turnoActual) return;

    const confirm = await showConfirm(
      `¿Estás seguro de cerrar el turno de caja?\n\n• Monto Esperado: S/ ${turnoActual.montoEsperado.toFixed(2)}\n• Monto Real Contado: S/ ${totalRealContado.toFixed(2)}\n• Descuadre: ${diferenciaArqueo >= 0 ? '+S/ ' : '-S/ '}${Math.abs(diferenciaArqueo).toFixed(2)}`,
      'Confirmar Cierre y Arqueo'
    );
    if (!confirm) return;

    try {
      const res = await (window as any).electron.cerrarTurno({
        turnoId: turnoActual.id,
        montoFinalReal: totalRealContado,
        observaciones: observacionesCierre.trim()
      });

      if (res.success) {
        showToast('Turno de caja cerrado exitosamente.', 'success');
        const turnoCerrado = res.turno;
        
        if (imprimirTicketAlCerrar) {
          try {
            const confRes = await (window as any).electron.obtenerWebConfig();
            const configObj = confRes && confRes.config ? confRes.config : {};
            await imprimirCierreCaja(turnoCerrado, configObj.empresa || {}, configObj.general || {});
          } catch (pErr) {
            console.error('Error al imprimir corte Z:', pErr);
          }
        }

        setModalCierre(false);
        setConteoBilletes({});
        setConteoMonedas({});
        setMontoDirecto('');
        setObservacionesCierre('');
        setTurnoActual(null);
        cargarHistorial();
        setPestaña('historial');
      } else {
        showToast(res.error || 'Error al cerrar el turno.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error en el cierre de turno.', 'error');
    }
  };

  const imprimirCorteZHistorial = async (turno: TurnoCaja) => {
    try {
      const confRes = await (window as any).electron.obtenerWebConfig();
      const configObj = confRes && confRes.config ? confRes.config : {};
      await imprimirCierreCaja(turno, configObj.empresa || {}, configObj.general || {});
      showToast('Enviado a la impresora térmica.', 'success');
    } catch (err) {
      showToast('Error al imprimir corte Z.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header Superior */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Wallet size={24} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Control de Turnos y Arqueo de Caja
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gestión de flujo de efectivo, egresos menores y balance cuadriculado por turno
            </p>
          </div>
        </div>

        {/* Pestañas & Estado */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPestaña('actual')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pestaña === 'actual'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Turno en Curso
            </button>
            <button
              onClick={() => setPestaña('historial')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                pestaña === 'historial'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={14} />
              Historial de Cortes
            </button>
          </div>

          <button
            onClick={() => { cargarTurnoActual(); if (pestaña === 'historial') cargarHistorial(); }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Refrescar datos"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-y-auto p-6">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mb-2" />
            <span className="text-xs font-semibold">Consultando estado de caja...</span>
          </div>
        ) : pestaña === 'actual' ? (
          turnoActual ? (
            /* VISTA: TURNO ACTIVO */
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Banner de Estado del Turno */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/15 backdrop-blur-xs rounded-xl">
                    <Unlock size={28} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-xs font-bold tracking-wide uppercase">
                        Caja Abierta
                      </span>
                      <span className="text-emerald-100 text-xs font-medium">
                        ID: {turnoActual.id.slice(0, 8)}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black mt-1">
                      Cajero: {turnoActual.cajero}
                    </h2>
                    <p className="text-emerald-100 text-xs flex items-center gap-1.5 mt-0.5">
                      <Clock size={13} />
                      Apertura: {new Date(turnoActual.fechaApertura).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setModalMovimiento('ingreso'); setMontoMovimiento(''); setMotivoMovimiento(''); }}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
                  >
                    <PlusCircle size={16} />
                    Ingreso Efectivo
                  </button>

                  <button
                    onClick={() => { setModalMovimiento('egreso'); setMontoMovimiento(''); setMotivoMovimiento(''); }}
                    className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
                  >
                    <MinusCircle size={16} />
                    Gasto / Retiro
                  </button>

                  <button
                    onClick={() => setModalCierre(true)}
                    className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock size={16} />
                    Arqueo y Cierre
                  </button>
                </div>
              </div>

              {/* Grid de Balances y Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-slate-500 text-xs font-semibold">Fondo Inicial</span>
                  <p className="text-xl font-black text-slate-800 mt-1">
                    S/ {turnoActual.montoInicial.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">Apertura</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
                  <span className="text-emerald-700 text-xs font-semibold">Ventas Efectivo (+)</span>
                  <p className="text-xl font-black text-emerald-600 mt-1">
                    S/ {turnoActual.totalVentasEfectivo.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-emerald-600/80 font-medium">Caja física</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-teal-100 bg-teal-50/20 shadow-xs">
                  <span className="text-teal-700 text-xs font-semibold">Ingresos Extra (+)</span>
                  <p className="text-xl font-black text-teal-600 mt-1">
                    S/ {turnoActual.totalIngresos.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-teal-600/80 font-medium">Sencillo / Aportes</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-rose-100 bg-rose-50/20 shadow-xs">
                  <span className="text-rose-700 text-xs font-semibold">Gastos / Egresos (-)</span>
                  <p className="text-xl font-black text-rose-600 mt-1">
                    S/ {turnoActual.totalEgresos.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-rose-600/80 font-medium">Compras menores</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 shadow-xs">
                  <span className="text-indigo-700 text-xs font-semibold">Ventas Digitales</span>
                  <p className="text-xl font-black text-indigo-600 mt-1">
                    S/ {turnoActual.totalVentasDigital.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-indigo-600/80 font-medium">Yape / Tarjetas</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-md">
                  <span className="text-emerald-100 text-xs font-semibold">Efectivo Esperado</span>
                  <p className="text-2xl font-black mt-1">
                    S/ {turnoActual.montoEsperado.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-emerald-100 font-medium">Debe haber en caja</span>
                </div>
              </div>

              {/* Movimientos del Turno */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText size={16} className="text-slate-500" />
                    Movimientos del Turno (Efectivo)
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    {turnoActual.movimientos?.length || 0} movimientos registrados
                  </span>
                </div>

                {turnoActual.movimientos && turnoActual.movimientos.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {turnoActual.movimientos.map((m: MovimientoCaja) => (
                      <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            m.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {m.tipo === 'ingreso' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{m.motivo}</p>
                            <span className="text-xs text-slate-400">
                              {new Date(m.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} • {m.tipo.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-base font-black ${
                            m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {m.tipo === 'ingreso' ? '+' : '-'} S/ {m.monto.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    No se han registrado ingresos ni retiros de efectivo en este turno.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VISTA: CAJA CERRADA */
            <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-100">
                <Lock size={32} />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-800">Caja Registradora Cerrada</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Actualmente no hay ningún turno de caja abierto. Para comenzar a realizar ventas y registrar movimientos de dinero, debes abrir un nuevo turno con un fondo inicial en efectivo.
                </p>
              </div>

              <button
                onClick={() => setModalApertura(true)}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock size={18} />
                Abrir Turno de Caja
              </button>
            </div>
          )
        ) : (
          /* VISTA: HISTORIAL DE CORTES Z */
          <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History size={16} className="text-slate-500" />
                Historial de Cortes de Caja (Corte Z)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Últimos 30 turnos cerrados
              </span>
            </div>

            {historialTurnos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">ID / Cajero</th>
                      <th className="p-3.5">Apertura / Cierre</th>
                      <th className="p-3.5 text-right">Fondo Inicial</th>
                      <th className="p-3.5 text-right">Ventas Efectivo</th>
                      <th className="p-3.5 text-right">Ventas Digital</th>
                      <th className="p-3.5 text-right">Esperado</th>
                      <th className="p-3.5 text-right">Real Contado</th>
                      <th className="p-3.5 text-center">Diferencia</th>
                      <th className="p-3.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historialTurnos.map((t: TurnoCaja) => {
                      const dif = t.diferencia || 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800">{t.cajero}</span>
                            <div className="text-xs text-slate-400">{t.id.slice(0, 8)}</div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-500">
                            <div>Ap: {new Date(t.fechaApertura).toLocaleDateString()} {new Date(t.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div>Ci: {t.fechaCierre ? `${new Date(t.fechaCierre).toLocaleDateString()} ${new Date(t.fechaCierre).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Abierta'}</div>
                          </td>
                          <td className="p-3.5 text-right font-medium text-slate-700">
                            S/ {t.montoInicial.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-medium text-emerald-600">
                            S/ {t.totalVentasEfectivo.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-medium text-indigo-600">
                            S/ {t.totalVentasDigital.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-800">
                            S/ {t.montoEsperado.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900">
                            S/ {(t.montoFinalReal ?? 0).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            {t.estado === 'cerrada' ? (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                dif === 0 
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : dif > 0 
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-rose-100 text-rose-700'
                              }`}>
                                {dif === 0 ? 'Cuadrada' : dif > 0 ? `+S/ ${dif.toFixed(2)}` : `-S/ ${Math.abs(dif).toFixed(2)}`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                                Abierta
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => imprimirCorteZHistorial(t)}
                              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                              title="Reimprimir Ticket de Cierre (Corte Z)"
                            >
                              <Printer size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No hay historial de turnos cerrados todavía.
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: APERTURA DE TURNO */}
      {modalApertura && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Unlock size={20} className="text-emerald-600" />
                Apertura de Turno de Caja
              </h3>
              <button 
                onClick={() => setModalApertura(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAbrirTurno} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cajero Responsable
                </label>
                <input
                  type="text"
                  value={cajeroApertura}
                  onChange={(e) => setCajeroApertura(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fondo Inicial de Caja (Soles)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={fondoInicial}
                    onChange={(e) => setFondoInicial(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                
                {/* Atajos Rápidos de Fondo */}
                <div className="flex gap-2 mt-2">
                  {[20, 50, 100, 150].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFondoInicial(val.toString())}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      S/ {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalApertura(false)}
                  className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRO DE MOVIMIENTO (INGRESO / EGRESO) */}
      {modalMovimiento && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                {modalMovimiento === 'ingreso' ? (
                  <PlusCircle size={20} className="text-emerald-600" />
                ) : (
                  <MinusCircle size={20} className="text-rose-600" />
                )}
                Registrar {modalMovimiento === 'ingreso' ? 'Ingreso de Efectivo' : 'Gasto / Retiro Menor'}
              </h3>
              <button 
                onClick={() => setModalMovimiento(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegistrarMovimiento} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a {modalMovimiento === 'ingreso' ? 'Ingresar' : 'Retirar'} (Soles)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0.10"
                    value={montoMovimiento}
                    onChange={(e) => setMontoMovimiento(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo o Justificación
                </label>
                <input
                  type="text"
                  value={motivoMovimiento}
                  onChange={(e) => setMotivoMovimiento(e.target.value)}
                  placeholder={modalMovimiento === 'ingreso' ? 'Ej: Aporte de sencillo' : 'Ej: Compra de bolsas, pago de delivery...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />

                {/* Sugerencias de motivos comunes */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(modalMovimiento === 'ingreso' 
                    ? ['Cambio/Sencillo', 'Aporte de caja', 'Cobro pendiente']
                    : ['Compra de bolsas', 'Pago delivery', 'Retiro de dueño', 'Almuerzo / refrigerio']
                  ).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setMotivoMovimiento(sug)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalMovimiento(null)}
                  className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer ${
                    modalMovimiento === 'ingreso'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  Registrar {modalMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ARQUEO DE CAJA Y CIERRE DE TURNO */}
      {modalCierre && turnoActual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <Calculator size={20} className="text-emerald-600" />
                  Arqueo Físico y Cierre de Turno
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Cuenta el efectivo real en caja para compararlo con el balance del sistema
                </p>
              </div>
              <button 
                onClick={() => setModalCierre(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de modo: Desglose por Billetes/Monedas vs Monto Directo */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModoArqueo('desglose')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  modoArqueo === 'desglose' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                Conteo por Billetes y Monedas
              </button>
              <button
                type="button"
                onClick={() => setModoArqueo('directo')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  modoArqueo === 'directo' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                Ingreso Directo de Total
              </button>
            </div>

            {modoArqueo === 'desglose' ? (
              <div className="space-y-4">
                {/* Billetes */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Billetes (Soles)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {DENOMINACIONES_BILLETES.map((den) => (
                      <div key={den} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-xs font-extrabold text-slate-700">S/ {den}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={conteoBilletes[den] || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setConteoBilletes((prev: Record<number, number>) => ({ ...prev, [den]: val }));
                          }}
                          className="w-full text-center mt-1 py-1 font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                          S/ {((conteoBilletes[den] || 0) * den).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monedas */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                    Monedas (Soles)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                    {DENOMINACIONES_MONEDAS.map((den) => (
                      <div key={den} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-xs font-extrabold text-slate-700">S/ {den >= 1 ? den : den.toFixed(2)}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={conteoMonedas[den] || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setConteoMonedas((prev: Record<number, number>) => ({ ...prev, [den]: val }));
                          }}
                          className="w-full text-center mt-1 py-1 font-bold text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                          S/ {((conteoMonedas[den] || 0) * den).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto Total en Efectivo Contado Físicamente
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={montoDirecto}
                    onChange={(e) => setMontoDirecto(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Comparación y Balance de Arqueo */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Efectivo Esperado (Sistema):</span>
                <span className="font-bold text-slate-800">S/ {turnoActual.montoEsperado.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Efectivo Real Contado:</span>
                <span className="font-black text-slate-900 text-base">S/ {totalRealContado.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Diferencia / Descuadre:</span>
                <span className={`text-base font-black px-3 py-1 rounded-xl ${
                  diferenciaArqueo === 0 
                    ? 'bg-emerald-100 text-emerald-700'
                    : diferenciaArqueo > 0 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-rose-100 text-rose-700'
                }`}>
                  {diferenciaArqueo === 0 
                    ? '¡Caja Cuadrada Exacta!' 
                    : diferenciaArqueo > 0 
                      ? `Sobrante: +S/ ${diferenciaArqueo.toFixed(2)}` 
                      : `Faltante: -S/ ${Math.abs(diferenciaArqueo).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observaciones de Cierre (Opcional)
              </label>
              <textarea
                value={observacionesCierre}
                onChange={(e) => setObservacionesCierre(e.target.value)}
                placeholder="Indica motivos de faltante, sobrante o notas para el siguiente turno..."
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Checkbox Imprimir Ticket */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="imprimirTicketCheck"
                checked={imprimirTicketAlCerrar}
                onChange={(e) => setImprimirTicketAlCerrar(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="imprimirTicketCheck" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                <Printer size={14} className="text-slate-500" />
                Imprimir comprobante físico de cierre de caja (Corte Z)
              </label>
            </div>

            {/* Botones */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setModalCierre(false)}
                className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCerrarTurno}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                Confirmar y Cerrar Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-3 ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-rose-600 text-white shadow-rose-500/20'
        }`}>
          {toastMessage.type === 'success' ? <Check size={18} /> : <X size={18} />}
          <span className="font-bold text-xs">{toastMessage.msg}</span>
        </div>
      )}
    </div>
  );
}
