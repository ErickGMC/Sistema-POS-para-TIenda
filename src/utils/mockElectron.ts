if (typeof window !== 'undefined' && !(window as any).electron) {
  console.warn('Electron context not found. Injecting browser mock for E2E testing.');
  
  // In-memory mock DB
  const mockProducts = [
    { id: '1', nombre: 'Arroz Integral Costeño 1kg', codigoBarras: '7750101', precio: 4.80, costo: 3.50, stock: 45, unidadMedida: 'unidades', categoria: 'Abarrotes', destacado: true, disponible: true },
    { id: '2', nombre: 'Aceite Primor Premium 1L', codigoBarras: '7750202', precio: 11.50, costo: 9.00, stock: 20, unidadMedida: 'unidades', categoria: 'Abarrotes', destacado: true, disponible: true },
    { id: '3', nombre: 'Coca Cola Sin Azúcar 1.5L', codigoBarras: '7750303', precio: 5.50, costo: 4.00, stock: 8, unidadMedida: 'unidades', categoria: 'Bebidas', destacado: true, disponible: true },
    { id: '4', nombre: 'Detergente Opal Ultra 1kg', codigoBarras: '7750404', precio: 9.90, costo: 7.20, stock: 15, unidadMedida: 'unidades', categoria: 'Aseo y limpieza', destacado: false, disponible: true }
  ];

  const mockUsers = [
    { id: 'admin-id', username: 'admin', role: 'admin', permisos: [], activo: true },
    { id: 'colab-id', username: 'cajero', role: 'colaborador', permisos: ['ventas:cobrar', 'ventas:historial'], activo: true }
  ];

  const mockWebConfig = {
    general: {
      nombreTienda: 'Minimarket Flor (Demo)',
      descripcionTienda: 'Tu minimarket de confianza, ahora con demostración en el navegador.',
      whatsapp: '51970560023',
      emailContacto: 'contacto@minimarketflor.com',
      ubicacion: 'Av. Las Palmas 543, Lima',
      horarioAtencion: 'Lunes a Domingo: 8:00 AM - 10:00 PM',
      mostrarPrecios: true
    },
    empresa: {
      ruc: '20608754123',
      razonSocial: 'Minimarket Flor S.A.C.',
      nombreComercial: 'Minimarket Flor',
      direccionFiscal: 'Av. Las Palmas 543, Lima',
      telefono: '01 555-5555',
      leyenda: 'Representación impresa de la Boleta de Venta Electrónica. ¡Gracias por tu compra!'
    },
    comunidad: {
      avisoGlobal: '¡Nuevos servicios a domicilio disponibles! Consulta al WhatsApp.',
      telefonos: [
        { id: '1', nombre: 'Serenazgo', numero: '01 444-4444' },
        { id: '2', nombre: 'Bomberos', numero: '116' }
      ],
      anuncios: [
        { id: '1', nombre: 'Gas Express', descripcion: 'Reparto de gas a domicilio', telefono: '999888777' }
      ],
      avisos: [
        { id: '1', titulo: 'Corte de Luz Programado', contenido: 'Este jueves no habrá luz de 2 PM a 5 PM.', fecha: '14/07/2026' }
      ]
    }
  };

  const mockBanners = [
    { id: 'b1', title: '¡Grandes Descuentos en Abarrotes!', subtitle: 'Hasta 20% de descuento en aceites y fideos seleccionados.', active: true, priority: 1, ctaText: 'Ver catálogo', ctaActionCategory: 'Abarrotes' }
  ];

  const mockVentas = [
    { id: 'TKT-0001', total: 21.80, subtotal: 18.47, igv: 3.33, descuento: 0, fecha: '2026-07-12 10:24:15', metodoPago: 'Efectivo', clienteDni: '12345678', clienteNombre: 'Juan Pérez', estado: 'completada', detalles: [{ producto_nombre: 'Aceite Primor Premium 1L', cantidad: 1, precioUnitario: 11.50, subtotal: 11.50 }, { producto_nombre: 'Arroz Integral Costeño 1kg', cantidad: 2, precioUnitario: 4.80, subtotal: 9.60 }] }
  ];

  const mockListas = [
    { id: 'L-001', titulo: 'Pedido de Abarrotes del Lunes', costoAproximado: 250.00, itemsCount: 4, fecha: '12/07/2026 15:30', estado: 'completada', detalles_json: JSON.stringify([{ id: '1', nombre: 'Arroz Integral Costeño 1kg', cantidad: 50 }, { id: '2', nombre: 'Aceite Primor Premium 1L', cantidad: 10 }]) }
  ];

  (window as any).electron = {
    openExternal: async (url: string) => console.log('Mock openExternal:', url),
    buscarProductoPorCodigo: async (codigo: string) => mockProducts.find(p => p.codigoBarras === codigo) || null,
    buscarProductosPorNombre: async (nombre: string) => mockProducts.filter(p => p.nombre.toLowerCase().includes(nombre.toLowerCase())),
    obtenerTodosProductos: async () => mockProducts,
    crearProducto: async (p: any) => { mockProducts.push(p); return { success: true }; },
    actualizarProducto: async (p: any) => {
      const idx = mockProducts.findIndex(x => x.id === p.id);
      if (idx !== -1) mockProducts[idx] = { ...mockProducts[idx], ...p };
      return { success: true };
    },
    eliminarProducto: async (id: string) => {
      const idx = mockProducts.findIndex(x => x.id === id);
      if (idx !== -1) mockProducts.splice(idx, 1);
      return { success: true };
    },
    guardarVenta: async (venta: any, detalle: any) => {
      mockVentas.unshift({ ...venta, detalles: detalle });
      return { success: true, ticketId: venta.id };
    },
    obtenerVentas: async (filtros: any) => {
      let filtered = [...mockVentas];
      if (filtros?.ticketId) filtered = filtered.filter(v => v.id.includes(filtros.ticketId));
      if (filtros?.metodoPago && filtros.metodoPago !== 'TODOS') filtered = filtered.filter(v => v.metodoPago === filtros.metodoPago);
      return filtered;
    },
    login: async (username: string, _pass: string) => {
      const u = mockUsers.find(x => x.username === username);
      if (u) return { success: true, user: u };
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    },
    obtenerUsuarios: async () => mockUsers,
    crearUsuario: async (data: any) => { mockUsers.push(data.userData); return { success: true }; },
    actualizarUsuario: async (data: any) => {
      const idx = mockUsers.findIndex(x => x.id === data.userData.id);
      if (idx !== -1) mockUsers[idx] = { ...mockUsers[idx], ...data.userData };
      return { success: true };
    },
    eliminarUsuario: async (id: string) => {
      const idx = mockUsers.findIndex(x => x.id === id);
      if (idx !== -1) mockUsers.splice(idx, 1);
      return { success: true };
    },
    procesarImagenLocal: async () => ({ success: true, base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }),
    imprimirSilencioso: async () => ({ success: true }),
    getFirebaseConfig: async () => ({
      apiKey: "mock-api-key",
      authDomain: "mock-domain.firebaseapp.com",
      projectId: "mock-project",
      storageBucket: "mock-bucket.appspot.com",
      appId: "1:mock:web:app"
    }),
    setFirebaseConfig: async () => ({ success: true }),
    descargarDatosDesdeNube: async () => ({ success: true }),
    startManualSync: async () => ({ success: true }),
    forzarSincronizacion: async () => ({ success: true }),
    obtenerEstadoSync: async () => ({ success: true, pendingCount: 0 }),
    onSyncCompleted: () => () => {},
    onSyncError: () => () => {},
    onSyncStatus: () => () => {},
    obtenerWebConfig: async () => ({ success: true, config: mockWebConfig }),
    guardarWebConfig: async (key: string, value: any) => {
      (mockWebConfig as any)[key] = value;
      return { success: true };
    },
    obtenerBanners: async () => ({ success: true, banners: mockBanners }),
    crearBanner: async (b: any) => { mockBanners.push(b); return { success: true }; },
    actualizarBanner: async (b: any) => {
      const idx = mockBanners.findIndex(x => x.id === b.id);
      if (idx !== -1) mockBanners[idx] = { ...mockBanners[idx], ...b };
      return { success: true };
    },
    eliminarBanner: async (id: string) => {
      const idx = mockBanners.findIndex(x => x.id === id);
      if (idx !== -1) mockBanners.splice(idx, 1);
      return { success: true };
    },
    obtenerAnalytics: async () => ({ success: true, events: [] }),
    obtenerDashboardData: async () => ({
      success: true,
      ventas: mockVentas,
      stock: mockProducts.filter(p => p.stock <= 10),
      analytics: []
    }),
    guardarListaCompra: async (lista: any, detalles: any) => {
      mockListas.unshift({ ...lista, detalles_json: JSON.stringify(detalles) });
      return { success: true };
    },
    obtenerListasCompras: async () => mockListas,
    eliminarListaCompra: async (id: string) => {
      const idx = mockListas.findIndex(x => x.id === id);
      if (idx !== -1) mockListas.splice(idx, 1);
      return { success: true };
    }
  };
}
export {};
