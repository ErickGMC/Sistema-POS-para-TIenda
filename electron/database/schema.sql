-- Tabla Principal de Productos
CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY, 
    codigoBarras TEXT UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL,
    precio REAL NOT NULL,
    costo REAL,
    stock REAL NOT NULL,
    unidadMedida TEXT NOT NULL,
    imagenUrl TEXT,
    thumbnailUrl TEXT,
    imagenLocal TEXT,
    thumbnailLocal TEXT,
    disponible INTEGER DEFAULT 1, 
    destacado INTEGER DEFAULT 0,
    etiquetas TEXT,
    esPrincipalWeb INTEGER DEFAULT 0,
    productoPadreId TEXT,
    etiquetaVariante TEXT,
    mostrarPrecioWeb INTEGER DEFAULT 0
);

-- Índices críticos para rendimiento ultrarrápido (<10ms)
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigoBarras);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);

-- Tabla de Ventas Locales
CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    total REAL NOT NULL,
    metodoPago TEXT NOT NULL,
    estado TEXT DEFAULT 'completada',
    clienteNombre TEXT,
    clienteDocumento TEXT,
    serie TEXT DEFAULT 'B001',
    correlativoNumero INTEGER DEFAULT 1,
    numeroTicket TEXT,
    anulado INTEGER DEFAULT 0
);

-- Índices críticos para ventas y reportes ultrarrápidos (<5ms)
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);

-- Detalle de la Venta (Ticket)
CREATE TABLE IF NOT EXISTS ventas_detalle (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY(venta_id) REFERENCES ventas(id),
    FOREIGN KEY(producto_id) REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_detalle_venta ON ventas_detalle(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_detalle_producto ON ventas_detalle(producto_id);

-- Cola de Sincronización (Motor Offline -> Online)
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad TEXT NOT NULL, 
    entidad_id TEXT NOT NULL,
    operacion TEXT NOT NULL, 
    datos_json TEXT, 
    estado_sync INTEGER DEFAULT 0, 
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    intentos INTEGER DEFAULT 0
);

-- Índice compuesto crítico para el patrón UPSERT en sync_queue:
-- Evita scans completos al buscar entradas pendientes por entidad/entidad_id.
CREATE INDEX IF NOT EXISTS idx_sync_queue_entidad_estado 
    ON sync_queue(entidad, entidad_id, estado_sync);

-- Tabla de Usuarios (Autenticación y RBAC)
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nombreCompleto TEXT DEFAULT 'Usuario',
    email TEXT,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    role TEXT NOT NULL, -- 'admin', 'colaborador'
    permisos TEXT, -- JSON array de permisos adicionales si aplica
    activo INTEGER DEFAULT 1, -- 1 = Activo, 0 = Inactivo
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para configuración general de la tienda web
CREATE TABLE IF NOT EXISTS web_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tabla para banners publicitarios de la tienda web
CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    imageUrl TEXT,
    imagenLocal TEXT,
    badgeText TEXT,
    ctaText TEXT,
    ctaActionCategory TEXT,
    active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0
);

-- Tabla de Correlativos para SUNAT (Ej. B001-00000001)
CREATE TABLE IF NOT EXISTS correlativos (
    serie TEXT PRIMARY KEY,
    siguiente_numero INTEGER DEFAULT 1
);
INSERT OR IGNORE INTO correlativos (serie, siguiente_numero) VALUES ('B001', 1);

-- Tabla para guardar listas de compra (Órdenes de Reabastecimiento)
CREATE TABLE IF NOT EXISTS compras_listas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_estimado REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente'
);

-- Detalle de las Listas de Compra
CREATE TABLE IF NOT EXISTS compras_listas_detalle (
    id TEXT PRIMARY KEY,
    lista_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad_pedir REAL NOT NULL,
    costo_unitario REAL,
    FOREIGN KEY(lista_id) REFERENCES compras_listas(id),
    FOREIGN KEY(producto_id) REFERENCES productos(id)
);

-- Tablas de Control de Caja, Turnos y Arqueo (Compatibilidad con AE_POS)
CREATE TABLE IF NOT EXISTS cajas_turnos (
    id TEXT PRIMARY KEY,
    fechaApertura TEXT NOT NULL,
    fechaCierre TEXT,
    montoInicial REAL NOT NULL,
    totalVentasEfectivo REAL DEFAULT 0.0,
    totalVentasDigital REAL DEFAULT 0.0,
    totalIngresos REAL DEFAULT 0.0,
    totalEgresos REAL DEFAULT 0.0,
    montoEsperado REAL DEFAULT 0.0,
    montoFinalReal REAL,
    diferencia REAL,
    estado TEXT DEFAULT 'abierta', -- 'abierta' | 'cerrada'
    cajero TEXT DEFAULT 'Cajero Principal',
    observaciones TEXT,
    creado_el DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cajas_movimientos (
    id TEXT PRIMARY KEY,
    turnoId TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'ingreso' | 'egreso'
    monto REAL NOT NULL,
    motivo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    FOREIGN KEY(turnoId) REFERENCES cajas_turnos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cajas_movimientos_turno ON cajas_movimientos(turnoId);

-- Tabla para metadatos de sincronización (Delta Sync)
CREATE TABLE IF NOT EXISTS sync_meta (
    clave TEXT PRIMARY KEY,
    valor TEXT
);