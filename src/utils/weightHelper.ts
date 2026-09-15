/**
 * Utilidades para manejo de productos vendidos por peso / a granel.
 */

const UNIDADES_PESO = new Set([
  'kg',
  'kilo',
  'kilos',
  'kilogramo',
  'kilogramos',
  'g',
  'gr',
  'gramo',
  'gramos',
  'granel',
  'peso',
]);

/**
 * Determina si una unidad de medida corresponde a un producto vendido por peso/balanza.
 */
export function esProductoPorPeso(unidadMedida?: string | null): boolean {
  if (!unidadMedida) return false;
  const normalizada = unidadMedida.trim().toLowerCase();
  return UNIDADES_PESO.has(normalizada);
}

/**
 * Formatea una cantidad respetando hasta 3 decimales para peso (gramos)
 * o enteros para unidades sin decimales innecesarios.
 * Ej: 1.000 -> "1"
 * Ej: 0.650 -> "0.650"
 * Ej: 1.25 -> "1.250"
 */
export function formatearCantidad(cantidad: number, unidadMedida?: string): string {
  if (isNaN(cantidad)) return '0';
  if (esProductoPorPeso(unidadMedida)) {
    return cantidad.toFixed(3);
  }
  return Number.isInteger(cantidad) ? cantidad.toString() : cantidad.toFixed(2);
}

/**
 * Formatea una etiqueta de peso legible para tickets y vistas.
 * Ej: 0.65 kg -> "0.650 kg" o 1 kg -> "1.000 kg"
 */
export function formatearPeso(pesoEnKg: number): string {
  if (isNaN(pesoEnKg)) return '0.000 kg';
  return `${pesoEnKg.toFixed(3)} kg`;
}
