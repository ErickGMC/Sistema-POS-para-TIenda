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
    etiquetas TEXT 
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
    anulado INTEGER DEFAULT 0
);

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

-- Tabla de Usuarios (Autenticación y RBAC)
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
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

-- Eventos Analíticos de la Tienda Web
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT
);