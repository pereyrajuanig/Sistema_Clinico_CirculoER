-- Aplicar ANTES de publicar el formulario nuevo. Compatible con el frontend anterior.
-- No modifica movimientos existentes ni cambia las vistas, los saldos o sus reportes.
begin;

-- Serializa las nuevas entradas/salidas/bajas sobre un mismo lote. Así una baja o
-- una salida desde otra computadora no puede gastar el stock validado por la RPC.
-- SECURITY INVOKER conserva las políticas RLS y la atribución individual existentes.
create or replace function public.validar_stock_nuevo_movimiento()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  disponible bigint;
  numero text;
begin
  select l.numero_lote into numero from public.lotes l where l.id = new.lote_id for update;
  if not found then
    raise exception 'El lote no existe o no está disponible.' using errcode = '23503';
  end if;
  if new.tipo in ('salida', 'baja') then
    select coalesce(sum(case when m.tipo = 'entrada' then m.cantidad::bigint else -m.cantidad::bigint end), 0)
      into disponible from public.movimientos_stock m where m.lote_id = new.lote_id;
    if new.cantidad > disponible then
      raise exception 'El lote % tiene % unidades disponibles. Actualizá los lotes y revisá la distribución.',
        coalesce(numero, '(sin número)'), disponible using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_stock_nuevo_movimiento() from public;
drop trigger if exists validar_stock_nuevo_movimiento on public.movimientos_stock;
create trigger validar_stock_nuevo_movimiento before insert on public.movimientos_stock
  for each row execute function public.validar_stock_nuevo_movimiento();

create or replace function public.registrar_salida_lotes(
  p_medicamento_id uuid,
  p_paciente_id uuid,
  p_consulta_id uuid,
  p_cantidad_total integer,
  p_lotes jsonb,
  p_motivo text default null
)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  responsable uuid := public.profesional_actual();
  lote record;
  cantidad_lotes integer;
  lotes_bloqueados integer := 0;
  registrados integer;
  hoy date := (current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if responsable is null then
    raise exception 'Se requiere una cuenta de profesional activa.' using errcode = '42501';
  end if;
  if p_cantidad_total is null or p_cantidad_total <= 0 then
    raise exception 'La cantidad total debe ser un entero mayor a cero.' using errcode = '22023';
  end if;
  if p_lotes is null or jsonb_typeof(p_lotes) <> 'array' then
    raise exception 'La distribución de lotes no es válida.' using errcode = '22023';
  end if;
  cantidad_lotes := jsonb_array_length(p_lotes);
  if cantidad_lotes = 0 or exists (
    select 1 from jsonb_array_elements(p_lotes) elemento
    where jsonb_typeof(elemento) <> 'object'
      or coalesce(jsonb_typeof(elemento->'cantidad'), '') <> 'number'
      or coalesce(elemento->>'cantidad', '') !~ '^[1-9][0-9]*$'
      or nullif(elemento->>'lote_id', '') is null
  ) then
    raise exception 'Cada lote debe tener una cantidad entera mayor a cero.' using errcode = '22023';
  end if;
  if (select count(distinct x.lote_id) from jsonb_to_recordset(p_lotes) as x(lote_id uuid, cantidad integer)) <> cantidad_lotes then
    raise exception 'No se puede repetir un lote en la distribución.' using errcode = '22023';
  end if;
  if (select sum(x.cantidad::bigint) from jsonb_to_recordset(p_lotes) as x(lote_id uuid, cantidad integer)) <> p_cantidad_total then
    raise exception 'La distribución no coincide con la cantidad total a entregar.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pacientes p where p.id = p_paciente_id) then
    raise exception 'Buscá y confirmá el paciente antes de guardar.' using errcode = '22023';
  end if;
  if p_consulta_id is not null and not exists (
    select 1 from public.consultas c where c.id = p_consulta_id
      and c.paciente_id = p_paciente_id and c.eliminado_en is null
  ) then
    raise exception 'La consulta no corresponde al paciente o ya no está disponible.' using errcode = '22023';
  end if;

  -- Orden fijo: dos entregas con lotes comunes adquieren los bloqueos en el mismo
  -- orden, aunque en pantalla se ordenen por vencimiento. Se liberan al terminar
  -- la transacción de PostgREST, tanto en éxito como en error.
  for lote in
    select l.id, l.fecha_vencimiento from public.lotes l
    join jsonb_to_recordset(p_lotes) as x(lote_id uuid, cantidad integer) on x.lote_id = l.id
    where l.medicamento_id = p_medicamento_id order by l.id for update of l
  loop
    lotes_bloqueados := lotes_bloqueados + 1;
    if lote.fecha_vencimiento is null or lote.fecha_vencimiento < hoy then
      raise exception 'La distribución incluye un lote vencido. Actualizá los lotes.' using errcode = '22023';
    end if;
  end loop;
  if lotes_bloqueados <> cantidad_lotes then
    raise exception 'Un lote no corresponde al medicamento o ya no está disponible.' using errcode = '22023';
  end if;

  -- Un solo INSERT; cualquier error (stock, RLS, FK o constraint) revierte la
  -- entrega completa. El trigger vuelve a leer el saldo con el lote bloqueado.
  insert into public.movimientos_stock(lote_id, usuario_id, paciente_id, consulta_id, tipo, cantidad, fecha, motivo)
    select x.lote_id, responsable, p_paciente_id, p_consulta_id, 'salida', x.cantidad,
      current_timestamp, nullif(btrim(p_motivo), '')
    from jsonb_to_recordset(p_lotes) as x(lote_id uuid, cantidad integer) order by x.lote_id;
  get diagnostics registrados = row_count;
  return registrados;
end;
$$;
revoke all on function public.registrar_salida_lotes(uuid, uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.registrar_salida_lotes(uuid, uuid, uuid, integer, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
commit;
