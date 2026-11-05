# Salidas de un medicamento desde varios lotes

El formulario pide una cantidad total y propone distribuirla entre los lotes vigentes
con stock, empezando por los que vencen antes. Se pueden editar las cantidades de cada
lote (cero significa no usarlo) y recuperar la propuesta con **Recalcular por vencimiento**.
Cambiar el total recalcula la propuesta; cambiar el medicamento limpia el total y los
lotes. **Actualizar lotes** conserva paciente y total, vuelve a consultar el stock y
recalcula la propuesta, descartando los ajustes anteriores.

No se guarda si falta stock, hay cantidades fraccionarias/negativas, un lote supera su
disponibilidad o la suma no coincide con el total. Los lotes vencidos no se ofrecen;
un lote que vence hoy sigue habilitado, como antes. Se conserva la entrega de stock
remanente de medicamentos inactivos.

## Guardado y compatibilidad

`registrar_salida_lotes` recibe medicamento, paciente, consulta opcional, total, lotes
y observación. No recibe un profesional: lo obtiene de `profesional_actual()` y respeta
el bloqueo por primer cambio de contraseña. Es `SECURITY INVOKER`: no elude RLS.

La función valida que los lotes pertenezcan al medicamento, no estén vencidos, no se
repitan, sumen el total, y que la consulta corresponda al paciente y siga disponible.
Bloquea los lotes en orden de UUID para serializar entregas con lotes comunes. Un
trigger de INSERT toma el mismo bloqueo y vuelve a calcular el stock desde los
movimientos; también protege las nuevas salidas individuales y bajas de los formularios
existentes. No permite gastar más stock del disponible. Las nuevas entradas también
toman el bloqueo, conservando el orden de las operaciones sobre ese lote.

Todos los descuentos se insertan en una sola transacción de PostgREST: cualquier error
revierte la entrega completa. Cada lote conserva un movimiento de salida con el mismo
paciente, profesional, fecha, consulta y observación. El historial y los PDF siguen
mostrando movimientos por lote; sus cálculos no cambian. No se agrega una pantalla ni
una entidad de agrupación de entregas.

El alta rápida del paciente sigue siendo previa e independiente de la salida. Si se
creó y falla la entrega, se conserva el paciente para reintentar sin duplicar el DNI.
Un error de conexión de resultado incierto indica revisar el historial antes de
reintentar; no hay reintentos automáticos ni soporte offline.

El trigger no reescribe movimientos históricos ni cambia las reglas existentes de
edición/eliminación de lotes o movimientos. Esta migración protege los INSERT; no
convierte el módulo completo de stock en una API exclusiva de operaciones.

## Publicación: SQL antes del frontend

1. Revisar el esquema y permisos actuales de Supabase. La migración necesita las
   columnas de lotes, movimientos, pacientes y consultas ya usadas por el frontend,
   además de `profesional_actual()` de la activación individual. El rol `authenticated`
   necesita SELECT y UPDATE sobre `lotes` para adquirir los bloqueos (la app ya edita lotes).
2. Ejecutar **completo** en SQL Editor:
   `supabase/migrations/202611050001_salidas_multiples_lotes.sql`.
   Es transaccional, reaplicable, no borra datos y funciona con el formulario anterior.
3. Verificar, sin escribir datos de prueba:

   ```sql
   select
     to_regprocedure('public.registrar_salida_lotes(uuid,uuid,uuid,integer,jsonb,text)') is not null as funcion_lista,
     exists (
       select 1 from pg_trigger
       where tgrelid = 'public.movimientos_stock'::regclass
         and tgname = 'validar_stock_nuevo_movimiento' and tgenabled = 'O'
     ) as validacion_lista;
   ```

4. Con ambos valores `true` y CI en verde, mergear el PR y verificar el deploy de Vercel.
   No publicar el frontend antes de ejecutar SQL: el formulario nuevo depende de la RPC.
5. Aceptar **Actualizar** en las PWA del consultorio cuando no haya formularios pendientes.
   Revisar la propuesta y los ajustes sin guardar movimientos ficticios en producción.

## Validación

- Tests puros: reparto de 24 unidades como 2+4+10+8, desempates, agotados/vencidos,
  insuficiencia, enteros, ajustes y suma exacta.
- Tests del formulario: una llamada para toda la entrega, ajustes/recalcular, errores
  de stock, recarga, respuestas tardías y regresiones de DNI/alta rápida/doble envío.
- PostgreSQL aislado (PGlite), ejecutando la migración real: rollback del primer lote
  si falla el segundo, validación de stock actualizado, entradas/bajas/salidas existentes,
  paciente/consulta, lotes ajenos/vencidos, RLS, sesión pendiente y reaplicación sin pérdida.
  PGlite usa una sola conexión: estos tests no simulan dos conexiones simultáneas.
- `pnpm lint`, `pnpm test`, `pnpm build`.
