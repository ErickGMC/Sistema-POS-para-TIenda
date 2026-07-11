const { app } = require('electron');
const { 
    db, 
    crearProducto, 
    guardarListaCompra, 
    obtenerListasCompras, 
    eliminarListaCompra,
    crearBanner,
    actualizarBanner,
    eliminarBanner
} = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 5: MÓDULOS SECUNDARIOS (LISTAS Y BANNERS) ---');
        
        // --- 1. LISTAS DE COMPRA ---
        console.log('\n1. Módulo: Listas de Reabastecimiento (Compras)');
        
        // Limpieza previa
        db.prepare("DELETE FROM compras_listas_detalle").run();
        db.prepare("DELETE FROM compras_listas").run();
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'lista_compra'").run();

        const prodId = crypto.randomUUID();
        crearProducto({ id: prodId, nombre: 'Producto Lista', categoria: 'Test', precio: 10, stock: 5 });

        const lista = { id: crypto.randomUUID(), nombre: 'Pedido Semana 1', total_estimado: 50 };
        const detallesLista = [{ id: crypto.randomUUID(), producto_id: prodId, cantidad_pedir: 10, costo_unitario: 5 }];

        const resLista = guardarListaCompra(lista, detallesLista);
        console.log(' - Guardar Lista de Compra:', resLista.success ? 'EXITO' : 'FALLO (' + resLista.error + ')');

        const listasLocales = obtenerListasCompras();
        console.log(` - Lista guardada recuperable con JOIN (Esperado: 1, Actual: ${listasLocales.listas.length}):`, listasLocales.success && listasLocales.listas.length === 1 ? 'EXITO' : 'FALLO');

        const syncLista = db.prepare("SELECT * FROM sync_queue WHERE entidad = 'lista_compra' AND entidad_id = ?").get(lista.id);
        console.log(' - Registro de sync generado para la nube:', syncLista ? 'EXITO' : 'FALLO');
        
        const resEliminarLista = eliminarListaCompra(lista.id);
        console.log(' - Eliminar Lista (Atomicidad):', resEliminarLista.success ? 'EXITO' : 'FALLO');

        // --- 2. BANNERS Y TIENDA WEB ---
        console.log('\n2. Módulo: Tienda Web (Banners)');

        // Limpieza previa
        db.prepare("DELETE FROM banners").run();
        db.prepare("DELETE FROM sync_queue WHERE entidad = 'banner'").run();

        const bannerData = {
            title: 'Oferta 2x1',
            subtitle: 'Prueba Web',
            imagenLocal: 'data:image/jpeg;base64,...',
            active: true,
            priority: 1
        };

        const resBanner = crearBanner(bannerData);
        console.log(' - Crear Banner:', resBanner.success ? 'EXITO' : 'FALLO (' + resBanner.error + ')');

        const resUpdateBanner = actualizarBanner({ id: resBanner.id, title: 'Oferta 3x2', active: false });
        console.log(' - Actualizar Banner:', resUpdateBanner.success ? 'EXITO' : 'FALLO (' + resUpdateBanner.error + ')');

        const syncBanners = db.prepare("SELECT COUNT(*) as c FROM sync_queue WHERE entidad = 'banner' AND entidad_id = ?").get(resBanner.id).c;
        console.log(` - Cola de sincronización acumulada (Esperado: 2, Actual: ${syncBanners}):`, syncBanners === 2 ? 'EXITO' : 'FALLO');

        const resDelBanner = eliminarBanner(resBanner.id);
        console.log(' - Eliminar Banner:', resDelBanner.success ? 'EXITO' : 'FALLO');

        // Limpieza final
        db.prepare("DELETE FROM productos WHERE id = ?").run(prodId);

        console.log('\n--- FIN DE LA FASE 5 ---');
    } catch (e) {
        console.error('Error durante FASE 5:', e);
    }
    app.quit();
});
