import { describe, it, expect } from 'vitest';
import { esProductoPorPeso, formatearCantidad, formatearPeso } from './weightHelper';

describe('weightHelper', () => {
  it('identifica correctamente unidades de peso', () => {
    expect(esProductoPorPeso('kg')).toBe(true);
    expect(esProductoPorPeso('KG')).toBe(true);
    expect(esProductoPorPeso('Kg')).toBe(true);
    expect(esProductoPorPeso('kilo')).toBe(true);
    expect(esProductoPorPeso('kilogramo')).toBe(true);
    expect(esProductoPorPeso('g')).toBe(true);
    expect(esProductoPorPeso('gr')).toBe(true);
    expect(esProductoPorPeso('granel')).toBe(true);
    expect(esProductoPorPeso('peso')).toBe(true);

    expect(esProductoPorPeso('unidad')).toBe(false);
    expect(esProductoPorPeso('und')).toBe(false);
    expect(esProductoPorPeso('litro')).toBe(false);
    expect(esProductoPorPeso(undefined)).toBe(false);
    expect(esProductoPorPeso(null)).toBe(false);
  });

  it('formatea cantidades con 3 decimales para peso y enteros para unidades', () => {
    expect(formatearCantidad(0.65, 'kg')).toBe('0.650');
    expect(formatearCantidad(1.234, 'kg')).toBe('1.234');
    expect(formatearCantidad(2, 'unidad')).toBe('2');
    expect(formatearCantidad(1.5, 'unidad')).toBe('1.50');
  });

  it('formatea etiquetas de peso con unidad kg', () => {
    expect(formatearPeso(0.75)).toBe('0.750 kg');
    expect(formatearPeso(1)).toBe('1.000 kg');
  });
});
