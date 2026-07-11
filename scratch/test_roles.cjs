const { app } = require('electron');
const { db, crearUsuario, login, eliminarUsuario } = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 3: SIMULACRO DE ROLES (CAJERO VS ADMIN) ---');
        
        const cajeroId = crypto.randomUUID();
        const permisosCajero = ['ventas:cobrar', 'ventas:historial']; // Sin permisos de inventario o web
        
        console.log('\n1. Configurando Cajero de prueba...');
        crearUsuario({
            id: cajeroId,
            username: 'cajero_test',
            role: 'colaborador',
            permisos: permisosCajero,
            activo: 1
        }, 'cajero123');

        console.log('\n2. Simulando Login...');
        const logRes = login('cajero_test', 'cajero123');
        if (logRes.success && logRes.user) {
            console.log(' - Login de cajero:', 'EXITO');
            
            const p = logRes.user.permisos;
            const isArray = Array.isArray(p);
            console.log(` - Permisos son devueltos como Array:`, isArray ? 'EXITO' : 'FALLO');
            console.log(` - Cantidad de permisos (Esperado: 2, Actual: ${p.length}):`, p.length === 2 ? 'EXITO' : 'FALLO');
            
            // Simulación de validación Frontend
            const canSell = p.includes('ventas:cobrar');
            const canConfigWeb = p.includes('web:configurar');
            
            console.log(` - Cajero puede cobrar (Esperado: true, Actual: ${canSell}):`, canSell === true ? 'EXITO' : 'FALLO');
            console.log(` - Cajero puede configurar web (Esperado: false, Actual: ${canConfigWeb}):`, canConfigWeb === false ? 'EXITO' : 'FALLO');
            
        } else {
            console.log(' - Login de cajero:', 'FALLO');
        }

        // Limpieza
        eliminarUsuario(cajeroId);
        db.prepare("DELETE FROM sync_queue WHERE entidad_id = ?").run(cajeroId);

        console.log('\n--- FIN DE LA PRUEBA DE ROLES ---');
    } catch (e) {
        console.error('Error durante FASE 3:', e);
    }
    app.quit();
});
