const { chromium } = require('playwright');
(async () => {
  console.log('Iniciando Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[Browser Error]:', msg.text());
  });
  page.on('pageerror', exception => console.log('[Uncaught Exception]:', exception));
  
  console.log('Navegando a localhost:5173...');
  await page.goto('http://localhost:5173');
  
  console.log('Esperando input de login...');
  await page.waitForSelector('input[type="password"]');
  
  console.log('Llenando login...');
  const inputs = await page.$$('input');
  await inputs[0].fill('admin');
  await inputs[1].fill('admin');
  
  console.log('Enviando form...');
  await page.click('button[type="submit"]');
  
  console.log('Esperando render...');
  await page.waitForTimeout(3000);
  
  console.log('Cerrando...');
  await browser.close();
})();
