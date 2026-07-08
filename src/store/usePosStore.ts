import { create } from 'zustand';

export interface Producto {
  id: string;
  codigoBarras?: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  costo?: number;
  stock: number;
  unidadMedida: string;
  imagenUrl?: string;
  imagenLocal?: string;
  disponible: boolean;
  destacado: boolean;
  etiquetas?: string[] | string;
}

export interface ItemCarrito {
  idTicket: string;
  producto: Producto;
  cantidad: number;
  subtotal: number;
}

interface PosState {
  carrito: ItemCarrito[];
  total: number;
  modoPago: string;
  agregarProducto: (producto: Producto, cantidad?: number) => void;
  removerProducto: (idTicket: string) => void;
  actualizarCantidad: (idTicket: string, cantidad: number) => void;
  limpiarCarrito: () => void;
  setModoPago: (modo: string) => void;
}

export const usePosStore = create<PosState>((set) => ({
  carrito: [],
  total: 0,
  modoPago: 'efectivo',
  
  agregarProducto: (producto, cantidad = 1) => set((state) => {
    // Si ya existe y se pesa por unidad, sumar cantidad.
    // Si es peso (ej 0.5 kg), puede que queramos un item separado o sumar.
    // Por simplicidad, agregamos como item separado o buscamos existente si es unidad.
    
    let nuevoCarrito;
    const existenteIndex = state.carrito.findIndex(item => item.producto.id === producto.id);
    
    if (existenteIndex >= 0 && producto.unidadMedida === 'unidad') {
      nuevoCarrito = [...state.carrito];
      nuevoCarrito[existenteIndex].cantidad += cantidad;
      nuevoCarrito[existenteIndex].subtotal = nuevoCarrito[existenteIndex].cantidad * producto.precio;
    } else {
      const nuevoItem: ItemCarrito = {
        idTicket: window.crypto.randomUUID(),
        producto,
        cantidad,
        subtotal: cantidad * producto.precio
      };
      nuevoCarrito = [...state.carrito, nuevoItem];
    }
    
    const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
    return { carrito: nuevoCarrito, total: nuevoTotal };
  }),
  
  removerProducto: (idTicket) => set((state) => {
    const nuevoCarrito = state.carrito.filter(item => item.idTicket !== idTicket);
    const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
    return { carrito: nuevoCarrito, total: nuevoTotal };
  }),
  
  actualizarCantidad: (idTicket, cantidad) => set((state) => {
    const nuevoCarrito = state.carrito.map(item => {
      if (item.idTicket === idTicket) {
        return { ...item, cantidad, subtotal: cantidad * item.producto.precio };
      }
      return item;
    });
    const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
    return { carrito: nuevoCarrito, total: nuevoTotal };
  }),
  
  limpiarCarrito: () => set({ carrito: [], total: 0 }),
  
  setModoPago: (modo) => set({ modoPago: modo })
}));
