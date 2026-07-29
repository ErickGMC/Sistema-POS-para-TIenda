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

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'mixto';

export interface PagoParcial {
  metodo: MetodoPago | string;
  monto: number;
}

interface PosState {
  carrito: ItemCarrito[];
  total: number;
  modoPago: MetodoPago | string;
  pagosMixtos: PagoParcial[];
  montoRecibido: number;
  clienteNombre: string;
  clienteDocumento: string;
  clienteTelefono: string;
  isProcessing: boolean;

  agregarProducto: (producto: Producto, cantidad?: number) => void;
  agregarItemPersonalizado: (nombre: string, precio: number, cantidad?: number) => void;
  removerProducto: (idTicket: string) => void;
  actualizarCantidad: (idTicket: string, cantidad: number) => void;
  actualizarPrecioItem: (idTicket: string, precio: number) => void;
  limpiarCarrito: () => void;
  setModoPago: (modo: MetodoPago | string) => void;
  setMontoRecibido: (monto: number) => void;
  setPagosMixtos: (pagos: PagoParcial[]) => void;
  setClienteNombre: (nombre: string) => void;
  setClienteDocumento: (doc: string) => void;
  setClienteTelefono: (tel: string) => void;
  setIsProcessing: (val: boolean) => void;
  getVuelto: () => number;
  getTotalMixto: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  carrito: [],
  total: 0,
  modoPago: 'efectivo',
  pagosMixtos: [],
  montoRecibido: 0,
  clienteNombre: '',
  clienteDocumento: '',
  clienteTelefono: '',
  isProcessing: false,

  agregarProducto: (producto, cantidad = 1) =>
    set((state) => {
      let nuevoCarrito;
      const existenteIndex = state.carrito.findIndex((item) => item.producto.id === producto.id);

      if (existenteIndex >= 0 && (producto.unidadMedida === 'unidad' || producto.unidadMedida === 'und')) {
        nuevoCarrito = [...state.carrito];
        nuevoCarrito[existenteIndex] = {
          ...nuevoCarrito[existenteIndex],
          cantidad: nuevoCarrito[existenteIndex].cantidad + cantidad,
          subtotal: (nuevoCarrito[existenteIndex].cantidad + cantidad) * producto.precio,
        };
      } else {
        const nuevoItem: ItemCarrito = {
          idTicket: window.crypto.randomUUID(),
          producto,
          cantidad,
          subtotal: cantidad * producto.precio,
        };
        nuevoCarrito = [...state.carrito, nuevoItem];
      }

      const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
      return { carrito: nuevoCarrito, total: nuevoTotal };
    }),

  agregarItemPersonalizado: (nombre, precio, cantidad = 1) =>
    set((state) => {
      const customProd: Producto = {
        id: `custom-${window.crypto.randomUUID()}`,
        nombre: nombre && nombre.trim() ? nombre.trim() : 'Servicio / Ítem Libre',
        descripcion: 'Servicio / Ítem personalizado',
        categoria: 'Servicios/Varios',
        precio: Math.max(0, precio),
        stock: 999999,
        unidadMedida: 'unidad',
        disponible: true,
        destacado: false,
      };

      const nuevoItem: ItemCarrito = {
        idTicket: window.crypto.randomUUID(),
        producto: customProd,
        cantidad: Math.max(1, cantidad),
        subtotal: Math.max(1, cantidad) * customProd.precio,
      };

      const nuevoCarrito = [...state.carrito, nuevoItem];
      const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
      return { carrito: nuevoCarrito, total: nuevoTotal };
    }),

  removerProducto: (idTicket) =>
    set((state) => {
      const nuevoCarrito = state.carrito.filter((item) => item.idTicket !== idTicket);
      const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
      return { carrito: nuevoCarrito, total: nuevoTotal };
    }),

  actualizarCantidad: (idTicket, cantidad) =>
    set((state) => {
      if (cantidad <= 0) {
        const nuevoCarrito = state.carrito.filter((item) => item.idTicket !== idTicket);
        return { carrito: nuevoCarrito, total: nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0) };
      }
      const nuevoCarrito = state.carrito.map((item) => {
        if (item.idTicket === idTicket) {
          return { ...item, cantidad, subtotal: cantidad * item.producto.precio };
        }
        return item;
      });
      const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
      return { carrito: nuevoCarrito, total: nuevoTotal };
    }),

  actualizarPrecioItem: (idTicket, precio) =>
    set((state) => {
      const nuevoPrecio = Math.max(0, precio);
      const nuevoCarrito = state.carrito.map((item) => {
        if (item.idTicket === idTicket) {
          return {
            ...item,
            producto: { ...item.producto, precio: nuevoPrecio },
            subtotal: item.cantidad * nuevoPrecio,
          };
        }
        return item;
      });
      const nuevoTotal = nuevoCarrito.reduce((acc, item) => acc + item.subtotal, 0);
      return { carrito: nuevoCarrito, total: nuevoTotal };
    }),

  limpiarCarrito: () =>
    set({
      carrito: [],
      total: 0,
      montoRecibido: 0,
      clienteNombre: '',
      clienteDocumento: '',
      clienteTelefono: '',
      pagosMixtos: [],
      modoPago: 'efectivo',
    }),

  setModoPago: (modo) => set({ modoPago: modo }),
  setMontoRecibido: (monto) => set({ montoRecibido: monto }),
  setPagosMixtos: (pagos) => set({ pagosMixtos: pagos }),
  setClienteNombre: (nombre) => set({ clienteNombre: nombre }),
  setClienteDocumento: (doc) => set({ clienteDocumento: doc }),
  setClienteTelefono: (tel) => set({ clienteTelefono: tel }),
  setIsProcessing: (val) => set({ isProcessing: val }),

  getVuelto: () => {
    const { montoRecibido, total } = get();
    return Math.max(0, montoRecibido - total);
  },

  getTotalMixto: () => {
    return get().pagosMixtos.reduce((acc, p) => acc + p.monto, 0);
  },
}));
