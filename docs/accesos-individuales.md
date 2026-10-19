# Acceso por profesional y contraseña

Reemplaza la cuenta institucional compartida por cuentas personales con los mismos permisos. Se elige un nombre y se escribe su contraseña. No hay registro público de usuarios.

## Comportamiento

- El nombre de la cuenta se ve en el encabezado de todas las pantallas.
- Cambiar usuario cierra únicamente la sesión del navegador actual. La navegación respeta el aviso de consulta pendiente y su borrador.
- Se conserva el timeout por inactividad de 25 minutos.
- Las nuevas consultas y cargas quedan atribuidas automáticamente al profesional vinculado a la sesión.
- No se pregunta quién atendió ni quién registra. La cuenta representa al responsable.
- Una consulta puede contener solamente signos vitales: se exige al menos un dato, no un motivo escrito.
- Editar una consulta, antecedente, patología, medicación o resultado conserva su responsable original. La auditoría del cambio usa la cuenta del editor. Las bajas conservan su confirmación, sin selector.
- Se conservan los IDs de profesionales y todas las atribuciones históricas. No se recrea el catálogo.
- Los borradores nuevos se separan por profesional y paciente. Los anteriores con autor se recuperan solo por ese profesional. Los anteriores sin autor requieren confirmar su recuperación en la cuenta actual; los de otra persona se conservan sin mostrarse.

## Preparación antes de publicar

Estos pasos los realiza el administrador en Supabase; no están ejecutados por el frontend ni por CI. Primero comprobar respaldo y probar las migraciones en una copia/entorno de pruebas con el esquema vigente. Estas migraciones son incrementales; el repositorio todavía no contiene el esquema histórico completo.

1. Ejecutar `supabase/migrations/202610190001_preparar_accesos_individuales.sql` en SQL Editor. Es compatible con la aplicación anterior.
2. En Authentication > Users, crear una cuenta por cada profesional con correo y contraseña propios, y correo confirmado. No reutilizar la cuenta compartida ni eliminar los profesionales existentes. El alta administrativa no necesita abrir una pantalla pública de registro.
3. Usar correos/alias institucionales administrados y definir cómo se recuperará una contraseña. No inventar direcciones de correo sin acordar cómo administrarlas. La UI no pide correo, pero Supabase lo necesita como identificador.
4. Vincular cada fila EXISTENTE de `profesionales` con su cuenta colocando el UUID de Authentication en `auth_user_id`. No cambiar `profesionales.id`. El índice único impide asociar una cuenta con dos profesionales.
5. Comprobar la lista con `select * from public.listar_profesionales_acceso();`. Deben aparecer los tres nombres correctos y los identificadores de las cuentas previstas.
6. Deshabilitar altas públicas en la configuración de Auth si no lo estaban. La aplicación no ofrece registro, pero la configuración del servicio también debe impedirlo.
7. Probar el nuevo frontend en preview con servicios de prueba: elegir cada usuario, contraseña correcta e incorrecta, recarga, cambios de usuario y formularios. No guardar pruebas clínicas en producción.

La RPC de acceso es intencionalmente pública y devuelve solo nombre, ID profesional y correo de acceso de cuentas activas, vinculadas y confirmadas. Los correos son identificadores, no secretos: no usar direcciones personales si no se desea hacerlas accesibles. No se habilita lectura anónima de las tablas clínicas ni de `auth.users`.

## Activación coordinada

1. Publicar el frontend mediante rama + PR + CI. No mergear antes de completar la preparación y validar las cuentas.
2. Aplicar `supabase/migrations/202610190002_activar_atribucion_individual.sql` durante el cambio de versión. Coordinar una pausa breve de uso y recarga de la PWA en todas las computadoras, para no mezclar formularios viejos con atribución nueva.
3. La fase 2 verifica que todos los profesionales activos tengan cuenta confirmada. Agrega políticas restrictivas a las tablas existentes: conserva las operaciones ya permitidas, pero exige un profesional vinculado. No diferencia permisos por profesión.
4. También permite motivo vacío para registrar solo signos vitales, restringe el bucket documentos, hace que las vistas de stock respeten RLS y fija autor/editor desde Auth en el servidor. La cuenta compartida y las cuentas no vinculadas dejan de acceder, aunque conserven un token anterior.
5. La aplicación no permite modificar el catálogo de profesionales ni sus vínculos por la API. Las altas, bajas y vínculos se administran desde Supabase.
6. Después de comprobar el acceso individual, retirar el acceso de la cuenta institucional desde Authentication. No borrar los registros históricos de profesionales para hacerlo.

Las políticas restrictivas se agregan a las existentes con AND. Si el entorno tiene otras reglas, revisar esa combinación: estas migraciones no reconstruyen ni reemplazan las políticas históricas. El script falla dentro de una transacción si falta una tabla/vista requerida; no omite silenciosamente una protección.

`pnpm test` incluye pruebas de las dos migraciones sobre PostgreSQL en memoria con PGlite, usando únicamente fixtures ficticios. Comprueban accesos permitidos y denegados, vistas, adjuntos y atribución. PGlite es una dependencia de desarrollo; no se incluye en la aplicación publicada. Estas pruebas no verifican la configuración particular del Supabase de producción.

## Verificación de aceptación

- Cada nombre acepta solo su contraseña; no hay campo de correo ni contraseña guardada por la aplicación.
- Una sesión no vinculada no puede entrar a pantallas clínicas ni leerlas por la API tras la fase 2.
- Al cambiar de usuario se muestra la identidad nueva y no reaparece el borrador de otro profesional. Una respuesta lenta del perfil anterior no debe habilitar pantallas con ese perfil.
- Cambiar de usuario mientras se escribe pide conservar el borrador; mientras se guarda, no permite abandonar la consulta.
- Recargar la pantalla conserva la sesión. Pasados 25 minutos sin actividad se cierra solo la del navegador actual; refrescar tokens no reinicia el plazo de actividad.
- La enfermera puede registrar únicamente signos vitales y queda como responsable.
- El médico puede crear su consulta como otro registro del mismo paciente.
- Editar un registro de otra persona o inactiva no cambia su autor original; la auditoría identifica al editor actual.
- El servidor ignora un responsable diferente enviado por el cliente al insertar y conserva al original al editar. Una baja toma el actor de la sesión.
- Las tres cuentas ven las mismas historias, medicamentos, stock y reportes; los adjuntos siguen siendo privados.

## Recuperación y mantenimiento

Si falla una validación, detener la activación y corregir en pruebas. Si ya se aplicó la fase 2, volver solo al frontend antiguo no restaura la cuenta compartida: requiere una reversión administrativa planificada de las reglas nuevas. No borrar las tablas clínicas ni desactivar RLS para recuperar el acceso.

Para dar de baja a alguien, marcar `profesionales.activo = false` y retirar su acceso Auth. Su nombre e historial permanecen. Para restablecer una contraseña, usar los mecanismos administrativos de Supabase o un flujo de recuperación configurado con un correo operativo. Nunca guardar contraseñas en `profesionales` ni en el repositorio.
