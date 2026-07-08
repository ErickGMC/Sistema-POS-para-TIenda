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

Si deseas clonar y usar este ecosistema para tu propio negocio, necesitarás:
1. **Node.js** (v18 o superior).
2. Una cuenta en [Firebase Console](https://console.firebase.google.com/).
3. Crear un proyecto nuevo en Firebase.
4. Habilitar **Firestore Database** y **Firebase Storage** en tu proyecto.
5. Habilitar **Firebase Authentication** (Proveedor de Email/Contraseña).

---

## ⚙️ Configuración Paso a Paso

### 1. Preparar Firebase
En tu consola de Firebase, registra una "Aplicación Web" (</>). Firebase te proporcionará un bloque de código con tus credenciales de configuración. Mantenlo a la mano.

### 2. Instalar el Sistema POS
Clona este repositorio e instala las dependencias:
```bash
git clone https://github.com/ErickGMC/Sistema-POS-para-TIenda.git
cd Sistema-POS-para-TIenda
npm install
```

### 3. Ejecutar y Vincular a la Nube
Inicia la aplicación en modo desarrollo:
```bash
npm run dev
```

Al abrir por primera vez, **la pantalla inicial te pedirá las credenciales de tu Firebase**. Debes pegar **únicamente el objeto JSON** (las llaves) que Firebase te entregó en el paso 1. 

**Ejemplo de formato que debes pegar:**
```json
{
  "apiKey": "AIzaSyD0GPWoxJAxMvK6u8ZE1F24CXxJRYvdoxo",
  "authDomain": "mi-tienda.firebaseapp.com",
  "projectId": "mi-tienda",
  "storageBucket": "mi-tienda.firebasestorage.app",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcde",
  "measurementId": "G-123456"
}
```

La aplicación guardará este código localmente en tu computadora de forma segura.

### 4. Ingreso Inicial o Sincronización

- **Si es una instalación nueva (Base de datos vacía):** El sistema creará un usuario administrador local por defecto. 
  - **Usuario:** `admin`
  - **Contraseña:** `admin`
- **Si estás instalando en una segunda computadora:** Una vez dentro del sistema (usando el admin por defecto), ve a la barra lateral izquierda y haz clic en el botón **"Descargar Base de Datos"**. Esto copiará todo tu inventario desde Firebase hacia esta computadora.

---

## 🛠 Compilar la Aplicación (.exe)

Para generar el instalador de Windows y poder distribuirlo a los cajeros o administradores:
```bash
npm run dist
```
Encontrarás el instalador empaquetado dentro de la carpeta `release/`.
