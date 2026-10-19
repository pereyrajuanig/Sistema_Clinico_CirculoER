# Acceso por profesional y contraseña

Reemplaza la cuenta institucional compartida por cuentas personales con los mismos permisos. Se elige un nombre y se escribe su contraseña. No hay registro público de usuarios.

## Primera vez que ingresa cada profesional

El administrador crea cada cuenta con una contraseña provisoria distinta y la entrega por un medio privado. Al ingresar, la persona elige una contraseña nueva y la repite. Hasta completar ese paso no puede acceder a historias, stock ni adjuntos, tampoco por la API. Después ingresa normalmente con su contraseña nueva, sin repetir el cambio en cada computadora.

La aplicación utiliza Supabase Auth para cambiarla y comprueba el resultado en el servidor. `debe_cambiar_password` pertenece al catálogo administrado, no a `user_metadata` editable por el usuario. Solo un cambio real del hash de Auth completa automáticamente el paso; la aplicación no lee ni guarda ese hash.

La contraseña nueva debe tener al menos 8 caracteres y cumplir la política configurada en Supabase. Si la política exige la contraseña actual, se pide además la provisoria; no se deshabilita esa protección. Si la sesión dejó de ser reciente y el servidor pide reautenticación, salir y volver a ingresar antes de cambiarla.

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
2. En Authentication > Users, crear una cuenta por cada profesional con correo, una contraseña provisoria distinta y correo confirmado. No reutilizar la cuenta compartida ni eliminar los profesionales existentes. El alta administrativa no necesita abrir una pantalla pública de registro. Entregar las provisorias cuando esté activado el nuevo acceso.
3. Usar correos/alias institucionales administrados y definir cómo se recuperará una contraseña. No inventar direcciones de correo sin acordar cómo administrarlas. La UI no pide correo, pero Supabase lo necesita como identificador.
4. Vincular cada fila EXISTENTE de `profesionales` con su cuenta colocando el UUID de Authentication en `auth_user_id`. No cambiar `profesionales.id`. El índice único impide asociar una cuenta con dos profesionales.
5. Comprobar la lista con `select * from public.listar_profesionales_acceso();`. Deben aparecer los tres nombres correctos y los identificadores de las cuentas previstas.
6. Deshabilitar altas públicas en la configuración de Auth si no lo estaban. La aplicación no ofrece registro, pero la configuración del servicio también debe impedirlo.
7. Probar el nuevo frontend en preview con servicios de prueba y las TRES migraciones aplicadas: elegir cada usuario, contraseña correcta e incorrecta, elección de contraseña propia, recarga, cambios de usuario y formularios. No guardar pruebas clínicas en producción.

La RPC de acceso es intencionalmente pública y devuelve solo nombre, ID profesional y correo de acceso de cuentas activas, vinculadas y confirmadas. Los correos son identificadores, no secretos: no usar direcciones personales si no se desea hacerlas accesibles. No se habilita lectura anónima de las tablas clínicas ni de `auth.users`.

## Activación coordinada

1. Completar primero la preparación y las pruebas con la copia de datos. Coordinar una pausa breve de uso para la activación en producción.
2. Aplicar en orden `supabase/migrations/202610190002_activar_atribucion_individual.sql` y `supabase/migrations/202610190003_password_primer_ingreso.sql`, después de la fase 1 y la vinculación de cuentas. Publicar el frontend mediante rama + PR + CI y recargar la PWA en todas las computadoras. No reanudar el uso mezclando las versiones. La tercera migración requiere la segunda y exige contraseña nueva a todas las cuentas vinculadas.
3. La fase 2 verifica que todos los profesionales activos tengan cuenta confirmada. Agrega políticas restrictivas a las tablas existentes: conserva las operaciones ya permitidas, pero exige un profesional vinculado. No diferencia permisos por profesión.
4. También permite motivo vacío para registrar solo signos vitales, restringe el bucket documentos, hace que las vistas de stock respeten RLS y fija autor/editor desde Auth en el servidor. La cuenta compartida y las cuentas no vinculadas dejan de acceder, aunque conserven un token anterior.
5. La aplicación no permite modificar el catálogo de profesionales ni sus vínculos por la API. Las altas, bajas y vínculos se administran desde Supabase.
6. Después de comprobar el acceso individual, retirar el acceso de la cuenta institucional desde Authentication. No borrar los registros históricos de profesionales para hacerlo.

Las políticas restrictivas se agregan a las existentes con AND. Si el entorno tiene otras reglas, revisar esa combinación: estas migraciones no reconstruyen ni reemplazan las políticas históricas. El script falla dentro de una transacción si falta una tabla/vista requerida; no omite silenciosamente una protección.

`pnpm test` incluye pruebas de las tres migraciones sobre PostgreSQL en memoria con PGlite, usando únicamente fixtures ficticios. Comprueban accesos permitidos y denegados, vistas, adjuntos, atribución y el primer ingreso. PGlite es una dependencia de desarrollo; no se incluye en la aplicación publicada. Estas pruebas no verifican la configuración particular del Supabase de producción. Las migraciones se aplican en orden; si ya se habían ejecutado las dos primeras, aplicar únicamente la tercera.

## Verificación de aceptación

- Cada nombre acepta solo su contraseña; no hay campo de correo ni contraseña guardada por la aplicación.
- La provisoria lleva a elegir contraseña nueva antes de montar pantallas clínicas. Acceder directamente por URL o editar user_metadata no saltea el bloqueo del servidor.
- Cambiar la contraseña habilita solo esa cuenta. Recargar o ingresar desde otra computadora no vuelve a pedir el paso una vez completado.
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

Si el administrador asigna una nueva contraseña provisoria a una cuenta existente, primero restablecerla en Auth y DESPUÉS marcar `profesionales.debe_cambiar_password = true`. Un cambio administrativo de contraseña también modifica el hash y completa el indicador automáticamente; por eso el orden es importante. Reasignar un profesional a otra cuenta activa nuevamente la obligación.

La tercera migración agrega un trigger a `auth.users` sobre la columna de hash documentada por Supabase. Debe comprobarse con un cambio real de contraseña en el entorno de pruebas antes de producción, porque errores de un trigger de Auth pueden impedir la operación. Las pruebas locales utilizan fixtures, sin credenciales ni datos reales.
