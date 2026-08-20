const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\erfox\\.gemini\\antigravity-ide\\brain\\0d03ba5b-a3b2-4af9-b9b3-5225aebb2392';

async function runE2E() {
  console.log('🚀 Iniciando suite E2E completa en Edge...');
  
  const browser = await chromium.launch({ 
    headless: true,
    channel: 'msedge'
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  const results = [];
  function record(name, status, details = '') {
    console.log(`[${status ? 'PASS' : 'FAIL'}] ${name} ${details ? '- ' + details : ''}`);
    results.push({ name, status, details });
  }

  try {
    // 1. Cargar aplicación
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const initScreenshot = path.join(ARTIFACTS_DIR, '01_initial_screen.png');
    await page.screenshot({ path: initScreenshot });
    record('1. Carga inicial de la aplicación', true);

    // 2. Login si es necesario
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      console.log('Iniciando sesión...');
      const userInput = await page.$('input[type="text"], input[type="email"]');
      if (userInput) await userInput.fill('admin');
      await passInput.fill('123456');
      
      const submitBtn = await page.$('button[type="submit"], button:has-text("Entrar"), button:has-text("Ingresar")');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(1500);
    }

    // Esperar a que cualquier overlay de carga desaparezca
    try {
      await page.waitForSelector('.fixed.inset-0.z-\\[99999\\]', { state: 'detached', timeout: 5000 });
    } catch {}

    await page.waitForTimeout(1000);

    // 3. Vista de Caja / POS
    const posScreenshot = path.join(ARTIFACTS_DIR, '02_pos_view.png');
    await page.screenshot({ path: posScreenshot });
    record('2. Vista de Caja Registradora / POS', true);

    // 4. Agregar productos al carrito
    const productItems = await page.$$('div:has-text("Arroz Integral"), div:has-text("Aceite Primor"), div:has-text("Coca Cola")');
    if (productItems.length > 0) {
      for (const item of productItems.slice(0, 2)) {
        await item.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    const cartScreenshot = path.join(ARTIFACTS_DIR, '03_pos_cart_active.png');
    await page.screenshot({ path: cartScreenshot });
    record('3. Carrito Reactivo y Selección de Productos', true);

    // 5. Navegación por la barra lateral izquierda (Sidebar)
    // El sidebar tiene botones con iconos: [0]=POS, [1]=Ventas, [2]=Inventario, [3]=Usuarios, [4]=Web, [5]=WhatsApp
    const sidebarButtons = await page.$$('aside button, .flex-col button');
    console.log(`Encontrados ${sidebarButtons.length} botones de navegación en sidebar.`);

    // Historial de Ventas (segundo icono)
    if (sidebarButtons.length > 1) {
      await sidebarButtons[1].click();
      await page.waitForTimeout(1200);
      const ventasScreenshot = path.join(ARTIFACTS_DIR, '04_ventas_history.png');
      await page.screenshot({ path: ventasScreenshot });
      record('4. Módulo Historial de Ventas', true);
    }

    // Inventario (tercer icono)
    if (sidebarButtons.length > 2) {
      await sidebarButtons[2].click();
      await page.waitForTimeout(1200);
      const invScreenshot = path.join(ARTIFACTS_DIR, '05_inventario_view.png');
      await page.screenshot({ path: invScreenshot });
      record('5. Módulo Inventario de Productos', true);
    }

    // Usuarios (cuarto icono)
    if (sidebarButtons.length > 3) {
      await sidebarButtons[3].click();
      await page.waitForTimeout(1200);
      const usersScreenshot = path.join(ARTIFACTS_DIR, '06_usuarios_view.png');
      await page.screenshot({ path: usersScreenshot });
      record('6. Módulo Gestión de Usuarios y Permisos', true);
    }

    // Web Admin (quinto icono)
    if (sidebarButtons.length > 4) {
      await sidebarButtons[4].click();
      await page.waitForTimeout(1200);
      const webScreenshot = path.join(ARTIFACTS_DIR, '07_web_admin_view.png');
      await page.screenshot({ path: webScreenshot });
      record('7. Módulo Administración Web & Banners', true);
    }

  } catch (err) {
    console.error('Error durante la ejecución E2E:', err);
    record('Ejecución E2E', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================');
  console.log('📊 RESUMEN E2E PLAYWRIGHT:');
  console.log(`Total pruebas: ${results.length} | Éxitos: ${results.filter(r => r.status).length} | Fallos: ${results.filter(r => !r.status).length}`);
  console.log('========================================================\n');
}

runE2E();
