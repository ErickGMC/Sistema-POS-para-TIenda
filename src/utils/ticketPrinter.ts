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

  const correlativo = `B001-${(venta.id || "").toString().toUpperCase().slice(0, 8)}`;
  
  const fechaStr = venta.fecha_creacion 
    ? new Date(venta.fecha_creacion).toLocaleString("es-PE")
    : new Date().toLocaleString("es-PE");

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
        <meta name="viewport" content="width=4in, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          @page {
            size: 4in 6in !important;
            margin: 0 !important;
          }
          @media print {
            html, body {
              width: 4in !important;
              height: 6in !important;
              margin: 0 !important;
              padding: 10px !important;
            }
          }
          html, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            width: 4in;
            height: 6in;
            margin: 0 auto;
            padding: 12px;
            color: #000;
            background-color: #fff;
            font-size: 11px;
            line-height: 1.35;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
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
