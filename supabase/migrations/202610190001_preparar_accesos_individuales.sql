-- Fase 1: compatible con el frontend anterior. No cambia filas clínicas ni políticas.
-- Aplicar como administrador desde SQL Editor antes de configurar las tres cuentas.
begin;

alter table public.profesionales
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists profesionales_auth_user_id_unico
  on public.profesionales(auth_user_id) where auth_user_id is not null;

-- La clave primaria de profesionales NO cambia: todas las FK históricas se conservan.
create or replace function public.profesional_actual()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.profesionales p
  where p.auth_user_id = (select auth.uid()) and p.activo = true
  limit 1;
$$;
revoke all on function public.profesional_actual() from public;
grant execute on function public.profesional_actual() to anon, authenticated;

-- Única información de acceso disponible antes del login. No se publica la tabla
-- profesionales ni auth.users. El email es el identificador de Auth (no una contraseña).
-- Usar correos/alias institucionales si no se desean publicar direcciones personales.
create or replace function public.listar_profesionales_acceso()
returns table (id uuid, nombre text, email text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre::text, u.email::text
  from public.profesionales p
  join auth.users u on u.id = p.auth_user_id
  where p.activo = true
    and u.email is not null and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until < now())
  order by p.nombre;
$$;
revoke all on function public.listar_profesionales_acceso() from public;
grant execute on function public.listar_profesionales_acceso() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
