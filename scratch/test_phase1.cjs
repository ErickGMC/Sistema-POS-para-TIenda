const { app } = require('electron');
const { 
    crearUsuario, 
    login, 
    eliminarUsuario, 
    db 
} = require('../electron/database/db.cjs');
const crypto = require('crypto');

app.whenReady().then(async () => {
    try {
        console.log('\n--- FASE 1: PRUEBAS DE AUTENTICACION Y USUARIOS ---');

        // Limpiar para la prueba (solo borramos usuarios test)
        db.prepare("DELETE FROM usuarios WHERE username LIKE 'testuser%'").run();
        
        console.log('\n1. Prueba de Creacion y Login Local:');
        const userId = crypto.randomUUID();
        const userData = {
            id: userId,
            username: 'testuser1',
            role: 'colaborador',
            permisos: ['ventas'],
            activo: 1
        };
        const password = 'mypassword123';
        
        // Crear usuario
        const resCreate = crearUsuario(userData, password);
        console.log(' - Crear Usuario:', resCreate.success ? 'EXITO' : 'FALLO (' + resCreate.error + ')');
        
        // Verificar login correcto
        const resLoginOk = login('testuser1', 'mypassword123');
        console.log(' - Login Correcto:', resLoginOk.success ? 'EXITO' : 'FALLO (' + resLoginOk.error + ')');
        
        // Verificar login incorrecto
        const resLoginFail = login('testuser1', 'wrongpassword');
        console.log(' - Login Incorrecto (debe fallar):', !resLoginFail.success ? 'EXITO' : 'FALLO');

        console.log('\n2. Restricciones de Seguridad (Eliminar único admin):');
        // Buscar el ID del admin por defecto
        const admin = db.prepare("SELECT * FROM usuarios WHERE role = 'admin' LIMIT 1").get();
        if (admin) {
            const adminCount = db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE role = 'admin'").get().c;
            console.log(` - Cantidad de admins: ${adminCount}`);
            if (adminCount === 1) {
                const resDeleteAdmin = eliminarUsuario(admin.id);
                console.log(' - Eliminar unico admin (debe fallar):', !resDeleteAdmin.success ? 'EXITO (' + resDeleteAdmin.error + ')' : 'FALLO (Se eliminó al admin!)');
            } else {
                console.log(' - No se probó eliminar admin porque hay más de 1.');
            }
        }

        console.log('\n3. Sincronización de Usuarios (sync_queue):');
        // Verificar que el usuario testuser1 está en la sync_queue
        const syncReg = db.prepare("SELECT * FROM sync_queue WHERE entidad = 'usuario' AND entidad_id = ?").get(userId);
        if (syncReg) {
            console.log(' - Registro en sync_queue encontrado:', 'EXITO');
            const data = JSON.parse(syncReg.datos_json);
            console.log(' - Contiene password en texto plano para Firebase?:', data.password === password ? 'EXITO' : 'FALLO');
        } else {
            console.log(' - Registro en sync_queue no encontrado:', 'FALLO');
        }
        
        // Limpieza final
        eliminarUsuario(userId);

        console.log('\n--- FIN DE LA FASE 1 ---');
    } catch (e) {
        console.error('Error durante FASE 1:', e);
    }
    app.quit();
});
