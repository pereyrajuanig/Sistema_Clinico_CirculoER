-- Fase 2: activar al publicar el frontend nuevo, DESPUÉS de vincular las cuentas.
-- La cuenta institucional sin vínculo deja de tener acceso, incluso con un JWT vigente.
-- No borra ni reasigna registros clínicos; conserva las políticas de operaciones existentes.
begin;

do $$
begin
  if not exists (select 1 from public.profesionales where activo and auth_user_id is not null)
     or exists (
       select 1 from public.profesionales p left join auth.users u on u.id = p.auth_user_id
       where p.activo and (u.id is null or u.email is null or u.email_confirmed_at is null
         or u.banned_until > now())
     ) then
    raise exception 'Primero vincular y confirmar una cuenta Auth para cada profesional activo.';
  end if;
end;
$$;

-- Una toma de signos es un registro válido sin motivo escrito. No cambia datos existentes.
alter table public.consultas alter column motivo drop not null;

-- Restrictiva: se combina con AND, sin ampliar los permisos de las políticas existentes.
-- También cubre anon por si hubiera una política permisiva preexistente para ese rol.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'profesionales', 'pacientes', 'consultas', 'antecedentes', 'patologias', 'medicacion',
    'resultados_laboratorio', 'documentos', 'medicamentos', 'lotes', 'movimientos_stock', 'auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('drop policy if exists acceso_profesional_vinculado on public.%I', tabla);
    execute format(
      'create policy acceso_profesional_vinculado on public.%I as restrictive for all to anon, authenticated
       using ((select public.profesional_actual()) is not null)
       with check ((select public.profesional_actual()) is not null)', tabla
    );
  end loop;
end;
$$;

-- El catálogo de profesionales y su vínculo con Auth se administran en el dashboard.
-- Ninguna cuenta de la aplicación puede reasignarse a otro profesional por la API.
revoke insert, update, delete, truncate, references, trigger on public.profesionales from anon, authenticated;
revoke all on public.profesionales from anon;

-- Las vistas deben respetar las políticas de sus tablas, sin los permisos de su creador.
alter view public.stock_por_lote set (security_invoker = true);
alter view public.stock_por_medicamento set (security_invoker = true);

-- Las políticas existentes del bucket siguen decidiendo sus operaciones permitidas.
drop policy if exists documentos_profesional_vinculado on storage.objects;
create policy documentos_profesional_vinculado on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'documentos' or (select public.profesional_actual()) is not null)
  with check (bucket_id <> 'documentos' or (select public.profesional_actual()) is not null);

-- La autoría no se confía al payload del navegador. En altas se fija desde auth.uid();
-- en ediciones se conserva el responsable original, y la auditoría identifica al editor.
create or replace function public.fijar_responsable_registro()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  responsable uuid := public.profesional_actual();
  columna text := tg_argv[0];
  valor jsonb;
begin
  -- SQL Editor y procesos administrativos sin usuario de Auth mantienen su comportamiento.
  if auth.uid() is null and current_user not in ('anon', 'authenticated') then return new; end if;
  if responsable is null then raise exception 'Se requiere una cuenta de profesional activa.' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then valor := to_jsonb(responsable);
  else valor := to_jsonb(old) -> columna;
  end if;
  new := jsonb_populate_record(new, jsonb_build_object(columna, valor));
  if tg_op = 'UPDATE' and to_jsonb(new) ? 'eliminado_en'
     and (to_jsonb(new) -> 'eliminado_en') is distinct from (to_jsonb(old) -> 'eliminado_en') then
    new := jsonb_populate_record(new, jsonb_build_object('eliminado_por',
      case when (to_jsonb(new) ->> 'eliminado_en') is null then null else responsable end));
  elsif tg_op = 'UPDATE' and to_jsonb(new) ? 'eliminado_por' then
    new := jsonb_populate_record(new, jsonb_build_object('eliminado_por', to_jsonb(old) -> 'eliminado_por'));
  end if;
  return new;
end;
$$;
revoke all on function public.fijar_responsable_registro() from public;

do $$
declare tabla text;
begin
  foreach tabla in array array['consultas', 'antecedentes', 'patologias', 'medicacion', 'resultados_laboratorio', 'movimientos_stock'] loop
    execute format('drop trigger if exists fijar_responsable_sesion on public.%I', tabla);
    execute format('create trigger fijar_responsable_sesion before insert or update on public.%I
      for each row execute function public.fijar_responsable_registro(%L)', tabla,
      case when tabla = 'consultas' then 'profesional_id' else 'usuario_id' end);
  end loop;
end;
$$;
drop trigger if exists fijar_responsable_sesion on public.auditoria;
create trigger fijar_responsable_sesion before insert on public.auditoria
  for each row execute function public.fijar_responsable_registro('usuario_id');

notify pgrst, 'reload schema';
commit;
