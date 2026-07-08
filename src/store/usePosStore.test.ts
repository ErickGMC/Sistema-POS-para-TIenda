import { describe, it, expect, beforeEach } from 'vitest';
import { usePosStore } from './usePosStore';

// Mocks
const mockCrypto = {
  randomUUID: () => Math.random().toString(36).substring(2, 15)
};
Object.defineProperty(globalThis, 'window', {
  value: { crypto: mockCrypto }
});

const productoA = {
  id: 'prod-A',
  nombre: 'Producto A',
  descripcion: 'Desc A',
  categoria: 'A',
  precio: 10.5,
  stock: 100,
  unidadMedida: 'unidad',
  disponible: true,
  destacado: false
};

const productoB = {
  id: 'prod-B',
  nombre: 'Producto B',
  descripcion: 'Desc B',
  categoria: 'B',
  precio: 5.0,
  stock: 50,
  unidadMedida: 'kg', // Producto a granel
  disponible: true,
  destacado: false
};

describe('usePosStore', () => {
  beforeEach(() => {
    // Limpiar estado antes de cada prueba
    usePosStore.getState().limpiarCarrito();
  });

  it('debería agregar un producto por unidad y actualizar el total correctamente', () => {
    const { agregarProducto, carrito, total } = usePosStore.getState();
    expect(carrito.length).toBe(0);
    expect(total).toBe(0);

    agregarProducto(productoA as any, 1);
    
    const state1 = usePosStore.getState();
    expect(state1.carrito.length).toBe(1);
    expect(state1.carrito[0].cantidad).toBe(1);
    expect(state1.carrito[0].subtotal).toBe(10.5);
    expect(state1.total).toBe(10.5);

    // Agregar el mismo producto por unidad debería incrementar la cantidad, no crear otro item
    usePosStore.getState().agregarProducto(productoA as any, 2);
    
    const state2 = usePosStore.getState();
    expect(state2.carrito.length).toBe(1);
    expect(state2.carrito[0].cantidad).toBe(3);
    expect(state2.carrito[0].subtotal).toBe(31.5);
    expect(state2.total).toBe(31.5);
  });

  it('debería agregar productos a granel como items separados y calcular total', () => {
    const { agregarProducto } = usePosStore.getState();
    
    agregarProducto(productoB as any, 0.5); // medio kilo
    
    const state1 = usePosStore.getState();
    expect(state1.carrito.length).toBe(1);
    expect(state1.carrito[0].cantidad).toBe(0.5);
    expect(state1.carrito[0].subtotal).toBe(2.5); // 0.5 * 5.0
    expect(state1.total).toBe(2.5);

    // Otro cliente pide otro medio kilo, debería crear un item separado porque es a granel
    usePosStore.getState().agregarProducto(productoB as any, 1.5);
    
    const state2 = usePosStore.getState();
    expect(state2.carrito.length).toBe(2);
    expect(state2.carrito[1].cantidad).toBe(1.5);
    expect(state2.carrito[1].subtotal).toBe(7.5);
    expect(state2.total).toBe(10.0); // 2.5 + 7.5
  });

  it('debería actualizar la cantidad y recalcular el total', () => {
    const { agregarProducto } = usePosStore.getState();
    agregarProducto(productoA as any, 1);
    
    const state1 = usePosStore.getState();
    const idTicket = state1.carrito[0].idTicket;

    // Cambiar cantidad a 5
    usePosStore.getState().actualizarCantidad(idTicket, 5);
    
    const state2 = usePosStore.getState();
    expect(state2.carrito[0].cantidad).toBe(5);
    expect(state2.carrito[0].subtotal).toBe(52.5);
    expect(state2.total).toBe(52.5);
  });

  it('debería remover un producto y recalcular el total', () => {
    const { agregarProducto } = usePosStore.getState();
    agregarProducto(productoA as any, 1);
    agregarProducto(productoB as any, 1);
    
    const state1 = usePosStore.getState();
    expect(state1.carrito.length).toBe(2);
    expect(state1.total).toBe(15.5); // 10.5 + 5.0

    const idTicketRemover = state1.carrito[0].idTicket; // remover Producto A
    
    usePosStore.getState().removerProducto(idTicketRemover);
    
    const state2 = usePosStore.getState();
    expect(state2.carrito.length).toBe(1);
    expect(state2.carrito[0].producto.id).toBe('prod-B');
    expect(state2.total).toBe(5.0);
  });
});
