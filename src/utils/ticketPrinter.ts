import type { EmpresaConfig } from "../components/web/WebAdmin";
import { useUIStore } from '../store/useUIStore';

export interface TicketVenta {
  id: string;
  total: number;
  metodoPago?: string;
  fecha_creacion?: string | Date;
  clienteNombre?: string;
  clienteDocumento?: string;
}

export interface TicketDetalle {
  id?: string;
  nombre: string;
  cantidad: number;
  precio: number;
}

export function generarHtmlTicket(
  venta: TicketVenta,
  detalle: TicketDetalle[],
  empresa: EmpresaConfig,
  general: any
): string {
  const nombreComercial = empresa.nombreComercial || general.nombreTienda || "MINIMARKET FLOR";
  const razonSocial = empresa.razonSocial || "NEGOCIACIONES DE TIENDA S.A.C.";
  const ruc = empresa.ruc || "10000000000";
  const direccion = empresa.direccionFiscal || general.ubicacion || "Dirección no especificada";
  const telefono = empresa.telefono || general.whatsapp || "";
  const leyenda = empresa.leyenda || "Representación impresa de la Boleta de Venta Electrónica. ¡Gracias por su compra!";

  // Si ya viene con formato de serie/ticket (ej. B001-00000001 o M001-00000001), respetarlo
  const rawId = (venta.id || "").toString().trim().toUpperCase();
  const correlativo = rawId.includes('-') 
    ? rawId 
    : `B001-${rawId.padStart(8, '0').slice(-8)}`;
  
  const fechaStr = venta.fecha_creacion 
    ? new Date(venta.fecha_creacion).toLocaleString("es-PE", { timeZone: "America/Lima" })
    : new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });

  const metodoPago = (venta.metodoPago || "efectivo").toUpperCase();

  // Cálculos SUNAT
  const total = Number(venta.total);
  const baseImponible = total / 1.18;
  const igv = total - baseImponible;

  const filasDetalle = detalle
    .map(
      (item) => `
    <tr>
      <td style="padding: 3px 0; font-size: 11px;">${item.cantidad.toFixed(2)}</td>
      <td style="padding: 3px 0; font-size: 11px; max-width: 140px; word-wrap: break-word;">${item.nombre}</td>
      <td style="padding: 3px 0; text-align: right; font-size: 11px;">S/ ${Number(item.precio).toFixed(2)}</td>
      <td style="padding: 3px 0; text-align: right; font-size: 11px;">S/ ${(item.cantidad * item.precio).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket ${correlativo}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 76mm !important;
              margin: 0 auto !important;
              padding: 4px !important;
            }
          }
          html, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 8px;
            color: #000;
            background-color: #fff;
            font-size: 11px;
            line-height: 1.35;
            box-sizing: border-box;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .font-bold {
            font-weight: bold;
          }
          .title {
            font-size: 16px;
            font-weight: 900;
            color: #4f46e5;
            margin: 2px 0;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 10px;
            margin: 1px 0;
            color: #475569;
          }
          .divider {
            border-top: 1px dashed #cbd5e1;
            margin: 6px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            border-bottom: 1.5px solid #cbd5e1;
            padding: 4px 0;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
          }
          .totals-table td {
            padding: 2px 0;
          }
          .footer {
            margin-top: 8px;
            font-size: 9px;
            text-align: center;
            color: #64748b;
            border-top: 1px dashed #cbd5e1;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div>
          <div class="text-center">
            <div class="title">${nombreComercial}</div>
            <div class="subtitle">${razonSocial}</div>
            <div class="subtitle">RUC: ${ruc}</div>
            <div class="subtitle">${direccion}</div>
            ${telefono ? `<div class="subtitle">Tlf: ${telefono}</div>` : ""}
          </div>

          <div class="divider"></div>

          <div>
            <div class="font-bold" style="color:#3730a3; font-size:12px;">BOLETA DE VENTA ELECTRÓNICA</div>
            <div>CORRELATIVO: <strong>${correlativo}</strong></div>
            <div>FECHA EMISIÓN: ${fechaStr}</div>
            <div>MÉTODO PAGO: <strong>${metodoPago}</strong></div>
            <div class="divider"></div>
            <div>CLIENTE: <strong>${venta.clienteNombre || "PÚBLICO GENERAL"}</strong></div>
            ${venta.clienteDocumento ? `<div>DOC/DNI/RUC: ${venta.clienteDocumento}</div>` : ""}
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">CANT</th>
                <th style="width: 50%;">DESCRIPCIÓN</th>
                <th style="width: 18%; text-align: right;">P.U.</th>
                <th style="width: 20%; text-align: right;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${filasDetalle}
            </tbody>
          </table>
        </div>

        <div>
          <div class="divider"></div>

          <table class="totals-table">
            <tr>
              <td style="width: 60%; font-size: 10px; color: #475569;">OP. GRAVADA</td>
              <td style="width: 40%; text-align: right; font-size: 10px; color: #475569;">S/ ${baseImponible.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="font-size: 10px; color: #475569;">I.G.V. (18%)</td>
              <td style="text-align: right; font-size: 10px; color: #475569;">S/ ${igv.toFixed(2)}</td>
            </tr>
            <tr class="font-bold" style="font-size: 14px; background:#f1f5f9;">
              <td style="padding: 6px 8px; font-size: 13px;">TOTAL A PAGAR</td>
              <td style="padding: 6px 8px; text-align: right; font-size: 14px; color:#0f172a;">S/ ${total.toFixed(2)}</td>
            </tr>
          </table>

          <div class="footer">
            <p style="margin:0 0 2px 0;">${leyenda}</p>
            <p style="margin:0;">Representación impresa Ficha 4x6 (288pt x 432pt)</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function imprimirTicket(
  venta: TicketVenta,
  detalle: TicketDetalle[],
  empresa: EmpresaConfig,
  general: any
) {
  const html = generarHtmlTicket(venta, detalle, empresa, general);
  try {
    const res = await (window as any).electron.imprimirSilencioso(html);
    if (!res.success) {
      console.error("Error al imprimir silenciosamente:", res.error);
      await useUIStore.getState().showAlert("Error en la impresora. Revisa la conexión de la impresora predeterminada.", "Error de Impresión");
    }
  } catch (err) {
    console.error("Error de IPC al imprimir:", err);
    await useUIStore.getState().showAlert("No se pudo conectar con el sistema de impresión.", "Error de Conexión");
  }
}

export function generarHtmlCierreCaja(
  turno: any,
  empresa: EmpresaConfig,
  general: any
): string {
  const nombreComercial = empresa.nombreComercial || general.nombreTienda || "MINIMARKET FLOR";
  const ruc = empresa.ruc || "10000000000";
  const direccion = empresa.direccionFiscal || general.ubicacion || "Dirección no especificada";

  const apertura = turno.fechaApertura
    ? new Date(turno.fechaApertura).toLocaleString("es-PE", { timeZone: "America/Lima" })
    : "-";
  const cierre = turno.fechaCierre
    ? new Date(turno.fechaCierre).toLocaleString("es-PE", { timeZone: "America/Lima" })
    : new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });

  const dif = Number(turno.diferencia || 0);
  const estadoDif = dif === 0 ? "CUADRADA (S/ 0.00)" : dif > 0 ? `SOBRANTE (+S/ ${dif.toFixed(2)})` : `FALTANTE (-S/ ${Math.abs(dif).toFixed(2)})`;
  const colorDif = dif === 0 ? "#059669" : dif > 0 ? "#2563eb" : "#dc2626";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Corte Z - Turno ${turno.id ? turno.id.slice(0, 8) : ''}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          @media print {
            html, body { width: 76mm !important; margin: 0 auto !important; padding: 4px !important; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 76mm; margin: 0 auto; padding: 8px; color: #000; font-size: 11px; line-height: 1.35;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .border-b { border-bottom: 1px dashed #64748b; }
          .my-2 { margin: 6px 0; }
        </style>
      </head>
      <body>
        <div class="text-center font-bold" style="font-size: 13px;">${nombreComercial}</div>
        <div class="text-center" style="font-size: 10px;">RUC: ${ruc}</div>
        <div class="text-center" style="font-size: 9px; color: #475569;">${direccion}</div>
        
        <div class="border-b my-2"></div>
        <div class="text-center font-bold" style="font-size: 12px; letter-spacing: 0.5px;">
          *** CIERRE DE CAJA (CORTE Z) ***
        </div>
        <div class="text-center" style="font-size: 10px; color: #64748b;">ID Turno: ${turno.id || '-'}</div>
        <div class="border-b my-2"></div>

        <div style="font-size: 10px;">
          <div><strong>Cajero:</strong> ${turno.cajero || 'Cajero Principal'}</div>
          <div><strong>Apertura:</strong> ${apertura}</div>
          <div><strong>Cierre:</strong> ${cierre}</div>
        </div>

        <div class="border-b my-2"></div>
        <div class="font-bold" style="margin-bottom: 4px;">RESUMEN DE EFECTIVO</div>
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td>Fondo Inicial:</td>
            <td class="text-right">S/ ${Number(turno.montoInicial || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Ventas Efectivo (+):</td>
            <td class="text-right">S/ ${Number(turno.totalVentasEfectivo || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Ingresos Efectivo (+):</td>
            <td class="text-right">S/ ${Number(turno.totalIngresos || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Egresos / Gastos (-):</td>
            <td class="text-right">S/ ${Number(turno.totalEgresos || 0).toFixed(2)}</td>
          </tr>
          <tr class="font-bold" style="background: #f1f5f9;">
            <td style="padding: 4px 0;">EFECTIVO ESPERADO:</td>
            <td class="text-right" style="padding: 4px 0;">S/ ${Number(turno.montoEsperado || 0).toFixed(2)}</td>
          </tr>
        </table>

        <div class="border-b my-2"></div>
        <div class="font-bold" style="margin-bottom: 4px;">ARQUEO FÍSICO CONTADO</div>
        <table style="width: 100%; font-size: 11px;">
          <tr class="font-bold">
            <td>Monto Real en Caja:</td>
            <td class="text-right">S/ ${Number(turno.montoFinalReal || 0).toFixed(2)}</td>
          </tr>
          <tr class="font-bold">
            <td>Diferencia / Descuadre:</td>
            <td class="text-right" style="color: ${colorDif};">${estadoDif}</td>
          </tr>
        </table>

        <div class="border-b my-2"></div>
        <div class="font-bold" style="margin-bottom: 4px;">VENTAS DIGITALES (SIN EFECTIVO)</div>
        <table style="width: 100%; font-size: 11px;">
          <tr>
            <td>Digital (Yape/Plin/Tarjeta):</td>
            <td class="text-right">S/ ${Number(turno.totalVentasDigital || 0).toFixed(2)}</td>
          </tr>
          <tr class="font-bold" style="background: #f8fafc;">
            <td style="padding: 4px 0;">TOTAL VENTAS TURNO:</td>
            <td class="text-right" style="padding: 4px 0;">S/ ${(Number(turno.totalVentasEfectivo || 0) + Number(turno.totalVentasDigital || 0)).toFixed(2)}</td>
          </tr>
        </table>

        ${turno.observaciones ? `
          <div class="border-b my-2"></div>
          <div style="font-size: 10px;"><strong>Observaciones:</strong> ${turno.observaciones}</div>
        ` : ''}

        <div style="margin-top: 25px; text-align: center; font-size: 10px;">
          <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto 4px auto;"></div>
          Firma Responsable
        </div>

        <div class="text-center" style="margin-top: 15px; font-size: 9px; color: #64748b;">
          Minimarket Flor POS - Comprobante de Control Interno
        </div>
      </body>
    </html>
  `;
}

export async function imprimirCierreCaja(
  turno: any,
  empresa: EmpresaConfig,
  general: any
) {
  const html = generarHtmlCierreCaja(turno, empresa, general);
  try {
    const res = await (window as any).electron.imprimirSilencioso(html);
    if (!res.success) {
      console.error("Error al imprimir corte Z:", res.error);
      await useUIStore.getState().showAlert("Error al imprimir el reporte de cierre.", "Error de Impresión");
    }
  } catch (err) {
    console.error("Error de IPC al imprimir corte Z:", err);
    await useUIStore.getState().showAlert("No se pudo conectar con el sistema de impresión.", "Error de Conexión");
  }
}
