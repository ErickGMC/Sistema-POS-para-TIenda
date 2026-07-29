/**
 * Utilidades financieras, desglose de IGV y redondeo monetario estricto para POS Dual (Desktop).
 */

/**
 * Redondea un monto a 2 decimales con precisión IEEE 754 para evitar imprecisiones de coma flotante.
 */
export const redondear2Decimales = (monto: number): number => {
  const num = Number(monto) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calcula el desglose de IGV (18% incluido en el total) de manera simétrica.
 */
export const calcularDesgloseIGV = (totalConIGV: number) => {
  const total = redondear2Decimales(totalConIGV);
  const subtotal = redondear2Decimales(total / 1.18);
  const igv = redondear2Decimales(total - subtotal);
  return { subtotal, igv, total };
};

/**
 * Valida disponibilidad de stock dentro de una transacción atómica.
 */
export const validarStockDisponible = (stockActual: number, cantidadSolicitada: number, nombreProducto: string) => {
  if (stockActual < cantidadSolicitada) {
    throw new Error(`Stock insuficiente para "${nombreProducto}". Disponible: ${stockActual}, Solicitado: ${cantidadSolicitada}`);
  }
};
