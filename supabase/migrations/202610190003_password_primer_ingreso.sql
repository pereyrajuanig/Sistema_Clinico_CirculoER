-- Aplicar después de las fases 1 y 2, durante la activación coordinada.
-- Todas las cuentas vinculadas deberán elegir una contraseña nueva antes de usar datos clínicos.
-- No guarda contraseñas ni hashes en el catálogo de profesionales.
begin;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'consultas' and policyname = 'acceso_profesional_vinculado'
    and permissive = 'RESTRICTIVE') then
    raise exception 'Aplicar primero las fases 1 y 2 de acceso individual.';
  end if;
end;
$$;

alter table public.profesionales
  add column if not exists debe_cambiar_password boolean not null default true;

-- Permite conocer SOLO la identidad propia y el paso pendiente antes de habilitar RLS clínico.
create or replace function public.identidad_profesional_actual()
returns table (id uuid, nombre text, debe_cambiar_password boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nombre::text, p.debe_cambiar_password
  from public.profesionales p
  where p.auth_user_id = (select auth.uid()) and p.activo = true
  limit 1;
$$;
revoke all on function public.identidad_profesional_actual() from public;
grant execute on function public.identidad_profesional_actual() to authenticated;

-- Las políticas y triggers de la fase 2 utilizan esta función: una cuenta pendiente
-- puede cambiar su contraseña mediante Auth, pero todavía no consultar/escribir historias.
create or replace function public.profesional_actual()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.profesionales p
  where p.auth_user_id = (select auth.uid()) and p.activo = true
    and p.debe_cambiar_password = false
  limit 1;
$$;
revoke all on function public.profesional_actual() from public;
grant execute on function public.profesional_actual() to anon, authenticated;

-- Un nuevo vínculo con Auth siempre exige la elección inicial de contraseña.
create or replace function public.exigir_password_al_vincular()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    new.debe_cambiar_password := true;
  end if;
  return new;
end;
$$;
revoke all on function public.exigir_password_al_vincular() from public;
drop trigger if exists exigir_password_al_vincular on public.profesionales;
create trigger exigir_password_al_vincular before update of auth_user_id on public.profesionales
  for each row execute function public.exigir_password_al_vincular();

-- Solo un cambio real del hash gestionado por Supabase Auth completa el paso.
-- Cambiar user_metadata desde el navegador no puede desactivar la obligación.
create or replace function public.confirmar_password_actualizada()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password, '') <> '' then
    update public.profesionales set debe_cambiar_password = false
    where auth_user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.confirmar_password_actualizada() from public;
drop trigger if exists confirmar_password_actualizada on auth.users;
create trigger confirmar_password_actualizada after update of encrypted_password on auth.users
  for each row execute function public.confirmar_password_actualizada();

notify pgrst, 'reload schema';
commit;
