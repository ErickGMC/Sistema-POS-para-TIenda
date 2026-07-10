# 🏪 Ecosistema Minimarket Flor - Sistema POS

¡Bienvenido al repositorio del **Sistema POS (Punto de Venta) y Administración Local**! 

Este proyecto no funciona de forma aislada; es la **mitad de un ecosistema completo**. Trabaja en conjunto con la [Tienda Web Pública (E-commerce)](https://github.com/ErickGMC/Tienda-web), la cual es la cara visible para los clientes. 

Ambos sistemas se sincronizan en tiempo real utilizando **Firebase (Firestore y Storage)** como puente o base de datos central en la nube. 

---

## 🏗️ Arquitectura del Sistema
- **Sistema POS (Este repositorio):** Una aplicación de escritorio construida con Electron y React. Usa SQLite (`better-sqlite3`) para funcionar ultra-rápido de manera local (incluso sin internet) y sincroniza los cambios (productos nuevos, ventas, stock) hacia Firebase en segundo plano. Es la "fuente de la verdad".
- **Tienda Web (Otro repositorio):** Una aplicación en Next.js que lee el catálogo directamente desde Firebase y permite a los usuarios hacer pedidos.

Para que **ambos sistemas se comuniquen**, DEBEN estar conectados exactamente al mismo proyecto de Firebase.

---

## 🚀 Requisitos Previos

1. **Node.js**: Debes tener Node.js instalado (v16 o superior).
2. **Git**: Para clonar el repositorio.
3. **Cuenta de Firebase (Plan Blaze)**: Es de suma importancia. Firestore requiere el **Plan Blaze (Pago por uso)**. Aunque ofrece una cuota gratuita inmensa que rara vez superarás en un minimarket estándar, el plan Blaze es un requisito técnico obligatorio para usar todas las APIs necesarias.

---

## 🔥 Configuración Obligatoria de Firebase

Antes de poder iniciar el POS por primera vez, **DEBES** configurar correctamente tu proyecto en Firebase Console. Sigue estos pasos al pie de la letra para evitar errores de conexión ("permission-denied"):

### Paso 1: Crear el Proyecto
1. Ve a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto nuevo.
2. Actualiza el proyecto al **Plan Blaze** en la esquina inferior izquierda (Facturación).
3. Agrega una **Aplicación Web** a tu proyecto para obtener el objeto de Configuración (el JSON con tu `apiKey`, `projectId`, etc.). Guarda ese código, lo necesitarás al abrir el POS.

### Paso 2: Habilitar Authentication y Crear tu Administrador
1. En el menú izquierdo de Firebase, ve a **Authentication** y habilítalo.
2. Ve a la pestaña **Sign-in method** y activa el proveedor de **Correo electrónico/Contraseña**.
3. Ve a la pestaña **Users (Usuarios)** y presiona "Agregar Usuario".
4. Crea tu usuario de acceso (ejemplo: `admin@minimarket.com` con contraseña `admin123`). **Este es el correo que usarás para loguearte en el POS.**
5. Copia el **UID (User ID)** que Firebase le asignó a este usuario.

### Paso 3: Habilitar Firestore Database
1. En el menú izquierdo, ve a **Firestore Database** y haz clic en "Crear base de datos".
2. Empieza en "Modo de prueba" y elige la región más cercana a ti.
3. Ahora **DEBES** crear manualmente a tu usuario en la base de datos para que el sistema lo reconozca:
   - Haz clic en "Iniciar colección".
   - ID de la colección: `usuarios`
   - **ID del documento: Pega el UID que copiaste en el Paso 2.**
   - Agrega los siguientes campos al documento:
     - `username` (string): `tu-correo` (ej. admin@minimarket.com)
     - `role` (string): `admin`
     - `permisos` (string): `["all"]`
     - `activo` (boolean): `true`

### Paso 4: Reglas de Seguridad de Firestore
Tus ventas y usuarios son privados, pero tus productos deben ser públicos para la tienda web.
En Firestore Database, ve a la pestaña **Reglas (Rules)**, borra lo que hay y pega exactamente esto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Los productos y banners son públicos (solo lectura)
    match /productos/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /banners/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Colecciones Privadas: Solo personal logueado
    match /usuarios/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /ventas/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /compras_listas/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /web_config/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Paso 5: Reglas de Seguridad de Storage (Imágenes)
En el menú izquierdo, ve a **Storage** y habilítalo. Ve a la pestaña **Reglas (Rules)** y pega esto:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Cualquier persona puede ver las fotos de los productos
    match /productos/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Para banners de la tienda web
    match /banners/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 💻 Instalación y Uso del POS

1. Clona el repositorio:
   ```bash
   git clone [URL_DEL_REPOSITORIO]
   ```
2. Instala las dependencias:
   ```bash
   cd tienda-pos
   npm install
   ```
3. Ejecuta la aplicación en modo desarrollo:
   ```bash
   npm run dev
   ```

### Sincronización Inicial (Primer Uso)
Al abrir el programa por primera vez, verás una pantalla de **Configuración de Firebase**.
1. Pega ahí el **JSON de Configuración** que obtuviste en el Paso 1 de Firebase.
2. El sistema validará la conexión y te enviará al **Login**.
3. Inicia sesión con el **Correo y Contraseña** del usuario que creaste en el Paso 2 de Authentication.
4. Una vez ingreses, el sistema te mostrará un mensaje de **"Descargando base de datos..."**. La primera vez será casi instantáneo porque está vacío, pero preparará todo tu sistema local.

¡Listo! Ya puedes empezar a crear productos desde el POS. Estos productos se subirán automáticamente a Firebase y tu Tienda Web podrá leerlos de inmediato.

---

## 🛠️ Comandos Adicionales

- `npm run build`: Empaqueta la aplicación para distribución en Windows (genera un instalador `.exe` en la carpeta `dist/`).
