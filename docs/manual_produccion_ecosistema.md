# Manual Integral de Producción y Operaciones: Ecosistema Minimarket Flor

Bienvenido al manual oficial de despliegue, arquitectura y operación del ecosistema comercial de 3 sistemas unificados para **Minimarket Flor**.

---

## 1. Arquitectura General del Ecosistema

El ecosistema está compuesto por 3 soluciones tecnológicas independientes pero perfectamente sincronizadas en tiempo real:

```
                  ┌─────────────────────────────────────────┐
                  │          Google Cloud / Firebase         │
                  │   - Cloud Firestore (Base Central)       │
                  │   - Firebase Storage (Hero Images)      │
                  │   - Firebase Auth (Usuarios y Roles)    │
                  └──────────────┬──────────────────┬───────┘
                                 │                  │
                Sincronización   │                  │  Lectura Pública
                Bidireccional    │                  │  y Webhooks
                                 ▼                  ▼
     ┌───────────────────────────────┐   ┌──────────────────────────────┐
     │      1. Desktop POS (PC)      │   │    3. E-Commerce Web         │
     │   (Sistema-POS-para-TIenda)   │   │       (Tienda-web)           │
     │ - Electron + React + SQLite   │   │ - Next.js 16 (App Router)    │
     │ - 100% Offline-First          │   │ - RAG Vectorial Nativo 768d  │
     │ - Arqueo y Control de Caja    │   │ - Asistente y Combos con IA  │
     │ - Impresión Térmica 80mm/58mm │   │ - Modo Vitrina / Precios     │
     └───────────────────────────────┘   └──────────────────────────────┘
                                 ▲
                Sincronización   │
                en Tiempo Real   │
                                 ▼
     ┌───────────────────────────────┐
     │      2. Mobile POS (Tablet)   │
     │          (AE_POS)             │
     │ - Android Nativo (Kotlin)     │
     │ - Room SQLite Offline-First   │
     │ - Escaneo de Barras por SKU   │
     │ - Arqueo y Pagos Mixtos       │
     └───────────────────────────────┘
```

---

## 2. Componentes y Funcionalidades Clave

### A. Catálogo Inteligente: Familias y Presentaciones con Código de Barras
- **Ahorro de Costos en Firebase Storage**: Cada familia de productos (ej. *"Inca Kola"*) requiere únicamente **1 sola imagen principal representativa**.
- **Herencia en Cascada**: Todas las presentaciones hijas (ej. *"Lata 355ml"*, *"Botella 1L"*, *"3 Litros"*) heredan automáticamente la imagen de la familia en las pantallas de cobro y búsquedas del POS tanto en PC como en Android, sin subir archivos redundantes ni consumir cuota de almacenamiento.
- **SKUs Independientes para el POS**: Cada presentación cuenta con su propio código de barras, precio de venta, costo y stock físico individual. Al escanear el código de barras, el POS descuenta el inventario exacto y permite emitir reportes de ventas desglosados por SKU.

### B. Control de Visibilidad de Precios en Web (2 Niveles)
1. **Nivel Maestro (Global)**: Desde el POS Desktop (`Control de Tienda Web` / `WebAdmin`), el administrador puede activar o desactivar el interruptor *"Mostrar Precios en Web"*. Al desactivarlo, toda la web opera en **Modo Vitrina / Catálogo**, ocultando precios y guiando a los clientes a consultar directamente por WhatsApp.
2. **Nivel Específico (Por Producto / Familia)**: En la pestaña `Inventario`, cada producto o familia dispone de una casilla *"Mostrar Precio en la Web"*, permitiendo ocultar precios de artículos selectos aun cuando la tienda web tenga los precios encendidos.

### C. Módulo de Turnos, Arqueo de Caja y Flujos de Efectivo
- **Paridad Total PC y Android**: Ambos sistemas registran turnos de caja en SQLite local y en las colecciones `caja_turnos` y `caja_movimientos` de Firestore.
- **Imputación Automática**: Las ventas en efectivo o digital actualizan en tiempo real el saldo de caja (`totalVentasEfectivo`, `totalVentasDigital`), y las anulaciones descuentan los fondos automáticamente.
- **Calculadora de Desglose Físico**: Soporta billetes peruanos (S/ 200, 100, 50, 20, 10) y monedas (S/ 5, 2, 1, 0.50, 0.20, 0.10) para arqueos ciegos rápidos con detección inmediata de sobrantes o faltantes.
- **Corte Z Térmico**: Impresión física de comprobantes de cierre en rollos continuos de 58mm y 80mm con timeout de seguridad.

### D. Motor RAG Vectorial y Asistente con IA (Tienda Web)
- **Búsqueda Semántica Multimodal (Nivel 2)**: Integra recuperación híbrida vectorial (768 dimensiones) y evaluación ontológica en español para responder a consultas complejas como *"algo para la resaca"*, *"desayuno nutritivo"* o *"ingredientes para lomo saltado"*.
- **Combos Inteligentes con Fallback de Alta Disponibilidad**: Si la API de Gemini no está disponible o se agotan los créditos, el endpoint `/api/combos-ia` aplica un fallback algorítmico que arma el combo con los productos más convenientes en stock, garantizando **cero caídas (100% uptime)** para los clientes.
- **Revalidación Instantánea**: Al modificar productos o banners desde el POS, se dispara un webhook a `/api/revalidate` que purga tanto las páginas estáticas de Next.js como la memoria RAM del motor RAG en menos de 2 segundos.

---

## 3. Guía de Instalación y Puesta en Marcha

### Sistema 1: Desktop POS (`Sistema-POS-para-TIenda`)

#### Requisitos Previos:
- Node.js 20+ LTS instalado.
- Impresora térmica USB o de red instalada en el sistema operativo (opcional para tickets físicos).

#### Ejecución en Desarrollo:
```bash
cd Minimarket/Sistema-POS-para-TIenda
npm install
npm run dev
```

#### Compilación de Producción:
```bash
npm run build
```
Para generar el instalador ejecutable de Windows (`.exe` NSIS):
```bash
npm run dist
```
El instalador generado se ubicará en la carpeta `release/`.

---

### Sistema 2: Mobile POS (`AE_POS`)

#### Requisitos Previos:
- Dispositivo o Tablet Android con Android 8.0 (API 26) o superior.
- Conexión Wi-Fi para la primera sincronización con Firestore.

#### Compilación del APK:
```bash
cd Minimarket/AE_POS
./gradlew assembleDebug
```
El archivo ejecutable se genera en:
`Minimarket/AE_POS/app/build/outputs/apk/debug/app-debug.apk`

#### Instalación en Tablet:
1. Copiar `app-debug.apk` a la tablet mediante cable USB, Google Drive o WhatsApp.
2. Habilitar *"Instalar aplicaciones de fuentes desconocidas"* en los ajustes de Android.
3. Abrir el APK para instalar. Al iniciar sesión por primera vez, el sistema descargará el catálogo completo de productos y categorías a la base SQLite local.

---

### Sistema 3: Tienda Web (`Tienda-web`)

#### Requisitos Previos:
- Node.js 20+ LTS.
- Cuenta en Vercel, Firebase App Hosting o servidor VPS con Docker.

#### Variables de Entorno (`.env.local`):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=minimarket-flor-8d7f9.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=minimarket-flor-8d7f9
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=minimarket-flor-8d7f9.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=846830704944
NEXT_PUBLIC_FIREBASE_APP_ID=1:846830704944:web:...

# IA y Embeddings (Opcional, cuenta con fallback automático)
GEMINI_API_KEY=AIzaSy...
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_GENERATIVE_MODEL=gemini-2.5-flash
EMBED_SECRET=super_secret_pos_key_2026
```

#### Ejecución de Pruebas:
```bash
cd Minimarket/Tienda-web
npm test -- --run
```

#### Compilación y Despliegue de Producción:
```bash
npm run build
npm start
```

---

## 4. Auditoría de Seguridad y Permisos

1. **Reglas de Firestore (`firestore.rules`)**:
   - `productos`, `banners`, `web_config`: Lectura pública para la web; escritura restringida a usuarios autenticados con rol `admin` o permisos específicos (`inventario:modificar`, `web:configurar`).
   - `ventas`, `ventas_detalle`, `caja_turnos`, `caja_movimientos`: Acceso restringido exclusivamente a empleados activos autenticados en el POS.
2. **Reglas de Storage (`storage.rules`)**:
   - Lectura pública de `/productos/` y `/banners/`.
   - Subida y eliminación bloqueada a usuarios anónimos.
3. **Resiliencia ante Fallos de Conexión**:
   - Si la tienda se queda sin internet, las ventas en PC y Tablet se siguen registrando de forma ininterrumpida en SQLite local. Al regresar la conexión, la cola `sync_queue` sincroniza los cambios pendientes automáticamente sin duplicar registros ni perder correlativos.
