# Sistema POS (Administración Local)

Esta es la aplicación de Punto de Venta (POS) y administración para el Minimarket Flor. Está construida usando **Electron**, **React**, y **Vite**. Cuenta con una base de datos local súper rápida (`better-sqlite3`) y se sincroniza en segundo plano con **Firebase**.

## 🚀 Instalación y Configuración

Si has descargado este repositorio para usarlo por tu cuenta, los datos de los productos y clientes se guardarán localmente en tu computadora. Sin embargo, para sincronizar estos datos con la nube y con tu propia tienda web, debes conectar la aplicación a tu propio proyecto de Firebase.

### 1. Requisitos previos
- Node.js (v18+)
- Una cuenta de [Firebase](https://firebase.google.com/) con un proyecto creado.
- Firestore Database y Firebase Storage habilitados.

### 2. Configurar Firebase por primera vez
1. Instala las dependencias y ejecuta la aplicación en modo desarrollo:
   ```bash
   npm install
   npm run dev
   ```
2. Al abrir la aplicación por primera vez, el sistema detectará que no hay una configuración de nube activa y te mostrará una **pantalla de Configuración de Base de Datos**.
3. En la consola de Firebase de tu proyecto, ve a la configuración y copia el fragmento JSON de las credenciales web.
4. Pega ese código JSON directamente en la aplicación. La aplicación validará el formato y lo guardará de manera local y segura.

Ejemplo del código que te pedirá la app:
```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "tu-proyecto.firebaseapp.com",
  "projectId": "tu-proyecto",
  "storageBucket": "tu-proyecto.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcde",
  "measurementId": "G-123456"
}
```

### 3. Usuario por Defecto y Descarga desde la Nube
Una vez configurado Firebase, si tu base de datos local SQLite está vacía, el sistema creará automáticamente un usuario administrador local para que puedas iniciar sesión por primera vez:
- **Usuario:** `admin`
- **Contraseña:** `admin`

Si ya tenías información previamente guardada en tu Firebase (por ejemplo, si acabas de formatear tu PC o estás instalando el POS en una segunda computadora), puedes ir a la barra lateral izquierda y usar el botón **"Descargar Base de Datos"**. Esto copiará todo tu catálogo de la nube hacia el almacenamiento local del dispositivo.

## 🛠 Compilar la Aplicación (Generar .exe)

Para crear un instalador empaquetado para Windows:
```bash
npm run dist
```
El instalador generado se encontrará en la carpeta `release/`.
