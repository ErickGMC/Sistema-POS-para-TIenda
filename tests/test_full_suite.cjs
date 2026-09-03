const { app } = require('electron');
const path = require('path');
const db = require('../electron/database/db.cjs');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS INTEGRALES DE TIENDA-POS');
  console.log('================================================================');
  
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------
    // TEST 1: Creación y Búsqueda de Producto
    // ---------------------------------------------------------------
    console.log('\n📦 [Test Suite 1: Módulo de Productos e Inventario]');
    const testProdId = 'test-prod-' + Date.now();
    const testBarcode = '775' + Math.floor(100000000 + Math.random() * 900000000);
    
    const prodData = {
      id: testProdId,
      codigoBarras: testBarcode,
      nombre: 'Producto de Prueba Automatizada',
      descripcion: 'Descripción de prueba E2E',
      categoria: 'Abarrotes',
      precio: 15.50,
      costo: 10.00,
      stock: 50,
      unidadMedida: 'unidad',
      disponible: true,
      destacado: true,
      etiquetas: ['prueba', 'e2e']
    };

    const createRes = db.crearProducto(prodData);
    assert(createRes.success === true, 'db.crearProducto() debe responder success: true');

    const searchByCode = db.buscarProductoPorCodigo(testBarcode);
    assert(searchByCode && searchByCode.id === testProdId, 'db.buscarProductoPorCodigo() debe encontrar el producto recién creado');
    assert(searchByCode && searchByCode.stock === 50, 'El stock inicial debe ser 50');

    // ---------------------------------------------------------------
    // TEST 2: Actualización de Producto y UPSERT en Sync Queue
    // ---------------------------------------------------------------
    console.log('\n🔄 [Test Suite 2: Actualización de Producto y Sync Queue]');
    const updatedProd = { ...prodData, precio: 18.00, stock: 45 };
    const updateRes = db.actualizarProducto(updatedProd);
    assert(updateRes.success === true, 'db.actualizarProducto() debe actualizar exitosamente');

    const searchUpdated = db.buscarProductoPorCodigo(testBarcode);
    assert(searchUpdated && searchUpdated.precio === 18.00, 'El precio debe haberse actualizado a 18.00');

    // ---------------------------------------------------------------
    // TEST 3: Transacción de Venta Atómica con Correlativo B001
    // ---------------------------------------------------------------
    console.log('\n💳 [Test Suite 3: Transacción de Venta Atómica y Stock]');
    const ventaParams = {
      total: 36.00,
      metodoPago: 'efectivo',
      clienteNombre: 'Cliente Test',
      clienteDocumento: '12345678'
    };

    const ventaDetalle = [
      {
        id: 'det-' + Date.now(),
        producto_id: testProdId,
        cantidad: 2,
        precio_unitario: 18.00,
        subtotal: 36.00
      }
    ];

    const ventaRes = db.guardarVenta(ventaParams, ventaDetalle);
    assert(ventaRes.success === true && ventaRes.ventaId, `db.guardarVenta() debe generar una venta exitosa con ID: ${ventaRes.ventaId}`);
    assert(ventaRes.ventaId && ventaRes.ventaId.startsWith('B001-'), 'El ID de la boleta debe tener serie correlativa B001-XXXXXXXX');

    // Verificar reducción automática de stock
    const prodAfterSale = db.buscarProductoPorCodigo(testBarcode);
    assert(prodAfterSale && prodAfterSale.stock === 43, `El stock debe haberse reducido de 45 a 43 (Actual: ${prodAfterSale ? prodAfterSale.stock : 'null'})`);

    // ---------------------------------------------------------------
    // TEST 4: Historial de Ventas y Carga de Detalles
    // ---------------------------------------------------------------
    console.log('\n📋 [Test Suite 4: Consulta de Ventas y Filtros]');
    const ventasResult = db.obtenerVentas({ ticketId: ventaRes.ventaId });
    assert(ventasResult.success === true && ventasResult.ventas.length === 1, 'db.obtenerVentas() debe retornar la venta filtrada por ID');
    assert(ventasResult.ventas[0].detalles.length === 1, 'La venta debe incluir sus detalles asociados en la consulta');
    assert(ventasResult.ventas[0].detalles[0].producto_id === testProdId, 'El producto en el detalle debe coincidir');

    // ---------------------------------------------------------------
    // TEST 5: Anulación de Venta y Reversión de Stock
    // ---------------------------------------------------------------
    console.log('\n↩️ [Test Suite 5: Anulación de Venta y Reversión de Stock]');
    const anularRes = db.anularVenta(ventaRes.ventaId);
    assert(anularRes.success === true, 'db.anularVenta() debe procesarse exitosamente');

    const prodAfterAnular = db.buscarProductoPorCodigo(testBarcode);
    assert(prodAfterAnular && prodAfterAnular.stock === 45, `El stock debe restaurarse a 45 tras la anulación (Actual: ${prodAfterAnular ? prodAfterAnular.stock : 'null'})`);

    // Verificar que no se pueda volver a anular
    const reAnularRes = db.anularVenta(ventaRes.ventaId);
    assert(reAnularRes.success === false, 'No debe permitir anular una venta ya anulada');

    // ---------------------------------------------------------------
    // TEST 6: Protección de Integridad Referencial
    // ---------------------------------------------------------------
    console.log('\n🛡️ [Test Suite 6: Integridad Referencial]');
    const deleteWithSales = db.eliminarProducto(testProdId);
    assert(deleteWithSales.success === false && deleteWithSales.error === 'TIENE_VENTAS', 'No debe permitir borrar un producto con ventas registradas');

    // ---------------------------------------------------------------
    // TEST 7: Autenticación y RBAC (scrypt)
    // ---------------------------------------------------------------
    console.log('\n🔐 [Test Suite 7: Autenticación y RBAC]');
    const testUsername = 'test_colaborador_' + Date.now();
    const testPassword = 'Password123!';
    const userCreate = db.crearUsuario({
      id: 'usr-' + Date.now(),
      username: testUsername,
      role: 'colaborador',
      permisos: ['pos', 'ventas'],
      activo: true
    }, testPassword);
    assert(userCreate.success === true, 'db.crearUsuario() debe crear usuario con hash seguro');

    const loginSuccess = db.login(testUsername, testPassword);
    assert(loginSuccess.success === true && loginSuccess.user.username === testUsername, 'db.login() con credenciales correctas debe autenticar');
    assert(loginSuccess.user && !loginSuccess.user.password_hash, 'El objeto retornado de login NO debe exponer el password_hash');

    const loginWrongPass = db.login(testUsername, 'WrongPass123');
    assert(loginWrongPass.success === false, 'db.login() con contraseña incorrecta debe fallar');

    // ---------------------------------------------------------------
    // TEST 8: Web Config y Banners
    // ---------------------------------------------------------------
    console.log('\n🌐 [Test Suite 8: Configuración Web y Banners]');
    const configSave = db.guardarWebConfig('empresa_test', { ruc: '20123456789', nombre: 'Minimarket Test' });
    assert(configSave.success === true, 'db.guardarWebConfig() debe guardar correctamente');

    const configGet = db.obtenerWebConfig();
    assert(configGet.success === true && configGet.config.empresa_test && configGet.config.empresa_test.ruc === '20123456789', 'db.obtenerWebConfig() debe recuperar los datos');

    const bannerId = 'banner-' + Date.now();
    const bannerCreate = db.crearBanner({
      id: bannerId,
      title: 'Promoción de Verano Test',
      subtitle: '20% de descuento',
      active: true,
      priority: 1
    });
    assert(bannerCreate.success === true, 'db.crearBanner() debe crear banner');

    const bannerGet = db.obtenerBanners();
    assert(bannerGet.success === true && bannerGet.banners.some(b => b.id === bannerId), 'db.obtenerBanners() debe incluir el banner creado');

    const bannerDelete = db.eliminarBanner(bannerId);
    assert(bannerDelete.success === true, 'db.eliminarBanner() debe eliminar banner');

    // ---------------------------------------------------------------
    // TEST 9: Listas de Compras / Reabastecimiento
    // ---------------------------------------------------------------
    console.log('\n🛒 [Test Suite 9: Listas de Compra / Reabastecimiento]');
    const listaId = 'lista-' + Date.now();
    const listaSave = db.guardarListaCompra(
      { id: listaId, nombre: 'Orden Reabastecimiento Test', total_estimado: 150.00 },
      [{ id: 'det-l-1', producto_id: testProdId, cantidad_pedir: 10, costo_unitario: 10.00 }]
    );
    assert(listaSave.success === true, 'db.guardarListaCompra() debe guardar la lista');

    const listasGet = db.obtenerListasCompras();
    assert(listasGet.success === true && listasGet.listas.some(l => l.id === listaId), 'db.obtenerListasCompras() debe retornar la lista con sus detalles');

    const listaDelete = db.eliminarListaCompra(listaId);
    assert(listaDelete.success === true, 'db.eliminarListaCompra() debe eliminar la lista');

    // ---------------------------------------------------------------
    // TEST 10: Control de Caja, Turnos y Movimientos de Efectivo
    // ---------------------------------------------------------------
    console.log('\n💵 [Test Suite 10: Control de Turnos y Movimientos de Caja]');
    // Si hubiese un turno residual abierto, cerrarlo primero
    const residual = db.obtenerTurnoActual();
    if (residual.success && residual.turno) {
      db.cerrarTurno(residual.turno.id, residual.turno.montoEsperado, 'Cierre previo de prueba');
    }

    const abrirRes = db.abrirTurno(100.00, 'Cajero Test');
    assert(abrirRes.success === true, 'db.abrirTurno() debe abrir turno con monto inicial');
    assert(abrirRes.turno && abrirRes.turno.montoInicial === 100.00, 'El monto inicial debe ser 100.00');

    const turnoAct = db.obtenerTurnoActual();
    assert(turnoAct.success === true && turnoAct.turno !== null, 'db.obtenerTurnoActual() debe retornar el turno activo');

    const ingRes = db.registrarMovimientoCaja(turnoAct.turno.id, 'ingreso', 50.00, 'Cambio inicial');
    assert(ingRes.success === true, 'db.registrarMovimientoCaja() debe registrar ingreso');

    const egRes = db.registrarMovimientoCaja(turnoAct.turno.id, 'egreso', 20.00, 'Pago de delivery');
    assert(egRes.success === true, 'db.registrarMovimientoCaja() debe registrar egreso');

    const turnoConMovs = db.obtenerTurnoActual();
    // Monto esperado: 100 (inicial) + 50 (ingreso) - 20 (egreso) = 130
    assert(turnoConMovs.turno.montoEsperado === 130.00, `El monto esperado debe ser 130.00 (Actual: ${turnoConMovs.turno.montoEsperado})`);
    assert(turnoConMovs.turno.movimientos.length === 2, 'Debe registrar 2 movimientos en el turno');

    // Cierre cuadrado
    const cierreRes = db.cerrarTurno(turnoConMovs.turno.id, 130.00, 'Caja cuadrada');
    assert(cierreRes.success === true, 'db.cerrarTurno() debe cerrar el turno');
    assert(cierreRes.turno.diferencia === 0.00, `La diferencia debe ser 0.00 (Actual: ${cierreRes.turno.diferencia})`);
    assert(cierreRes.turno.estado === 'cerrada', 'El estado del turno debe ser cerrada');

    const historialTurnos = db.obtenerHistorialTurnos(5);
    assert(historialTurnos.success === true && historialTurnos.turnos.length > 0, 'db.obtenerHistorialTurnos() debe retornar el historial');

  } catch (err) {
    console.error('CRITICAL ERROR IN SUITE:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 RESUMEN FINAL: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log('================================================================\n');

  if (failed === 0) {
    console.log('🎉 TODOS LOS MÓDULOS DEL BACKEND SQLITE FUNCIONAN A LA PERFECCIÓN.');
  }

  if (app) app.quit();
}

if (app) {
  app.whenReady().then(runTestSuite);
} else {
  runTestSuite();
}
