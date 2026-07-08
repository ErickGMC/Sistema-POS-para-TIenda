import type { EmpresaConfig } from "../components/web/WebAdmin";

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
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm;
            margin: 0;
            padding: 8px 4px;
            color: #000;
            background-color: #fff;
            font-size: 11px;
            line-height: 1.3;
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
            font-size: 15px;
            font-weight: bold;
            margin: 4px 0;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 11px;
            margin: 2px 0;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            border-bottom: 1px dashed #000;
            padding: 4px 0;
            font-size: 11px;
            text-align: left;
          }
          .totals-table td {
            padding: 2px 0;
          }
          .footer {
            margin-top: 12px;
            font-size: 9px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${nombreComercial}</div>
          <div class="subtitle">${razonSocial}</div>
          <div class="subtitle">RUC: ${ruc}</div>
          <div class="subtitle">${direccion}</div>
          ${telefono ? `<div class="subtitle">Tlf: ${telefono}</div>` : ""}
        </div>

        <div class="divider"></div>

        <div>
          <div class="font-bold">BOLETA DE VENTA ELECTRÓNICA</div>
          <div>CORRELATIVO: ${correlativo}</div>
          <div>FECHA EMISIÓN: ${fechaStr}</div>
          <div>MÉTODO PAGO: ${metodoPago}</div>
          <div class="divider"></div>
          <div>CLIENTE: ${venta.clienteNombre || "PÚBLICO GENERAL"}</div>
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

        <div class="divider"></div>

        <table class="totals-table">
          <tr>
            <td style="width: 60%; font-size: 11px;">OP. GRAVADA</td>
            <td style="width: 40%; text-align: right; font-size: 11px;">S/ ${baseImponible.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="font-size: 11px;">I.G.V. (18%)</td>
            <td style="text-align: right; font-size: 11px;">S/ ${igv.toFixed(2)}</td>
          </tr>
          <tr class="font-bold" style="font-size: 12px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
            <td style="padding: 4px 0; font-size: 12px;">TOTAL A PAGAR</td>
            <td style="padding: 4px 0; text-align: right; font-size: 12px;">S/ ${total.toFixed(2)}</td>
          </tr>
        </table>

        <div class="footer">
          <p>${leyenda}</p>
          <p style="margin-top: 6px;">Representación impresa generada por FLOR POS</p>
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
      alert("Error en la impresora. Revisa la conexión de la impresora predeterminada.");
    }
  } catch (err) {
    console.error("Error de IPC al imprimir:", err);
    alert("No se pudo conectar con el sistema de impresión.");
  }
}
