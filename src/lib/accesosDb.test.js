// PostgreSQL aislado en memoria: no lee .env ni se conecta a Supabase.
// Fixture mínimo de las tablas existentes; valida las migraciones incrementales,
// no reemplaza la verificación del esquema y las políticas reales antes de publicar.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const preparar = readFileSync(new URL('../../supabase/migrations/202610190001_preparar_accesos_individuales.sql', import.meta.url), 'utf8')
const activar = readFileSync(new URL('../../supabase/migrations/202610190002_activar_atribucion_individual.sql', import.meta.url), 'utf8')
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const profA = id(1), profB = id(2), profC = id(3)
const userA = id(11), userB = id(12), userC = id(13), compartido = id(99)
let db
async function como(usuario, rol = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario || ''])
  await db.exec(`set role ${rol === 'anon' ? 'anon' : 'authenticated'}`)
}
async function admin() {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    create table public.profesionales(id uuid primary key, nombre text not null, activo boolean not null default true);
    create table public.pacientes(id uuid primary key default gen_random_uuid(), nombre text);
    create table public.medicamentos(id uuid primary key default gen_random_uuid(), nombre text);
    create table public.lotes(id uuid primary key default gen_random_uuid());
    create table public.consultas(id uuid primary key default gen_random_uuid(), profesional_id uuid not null references public.profesionales(id),
      motivo text not null, presion_sistolica integer, eliminado_en timestamptz, eliminado_por uuid references public.profesionales(id));
    create table public.documentos(id uuid primary key default gen_random_uuid(), nombre text);
    create table public.movimientos_stock(id uuid primary key default gen_random_uuid(), lote_id uuid references public.lotes(id),
      usuario_id uuid not null references public.profesionales(id), tipo text, cantidad integer);
    create table public.auditoria(id uuid primary key default gen_random_uuid(), usuario_id uuid not null references public.profesionales(id));
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text);
    alter table storage.objects enable row level security;
    create policy existente on storage.objects for all to authenticated using (true) with check (true);
    create view public.stock_por_lote as select lote_id, sum(case when tipo = 'entrada' then cantidad else -cantidad end) as stock_actual
      from public.movimientos_stock group by lote_id;
    create view public.stock_por_medicamento as select * from public.stock_por_lote;
  `)
  for (const tabla of ['antecedentes', 'patologias', 'medicacion', 'resultados_laboratorio']) {
    await db.exec(`create table public.${tabla}(id uuid primary key default gen_random_uuid(), usuario_id uuid not null references public.profesionales(id),
      contenido text, eliminado_en timestamptz, eliminado_por uuid references public.profesionales(id))`)
  }
  for (const tabla of ['profesionales', 'pacientes', 'consultas', 'antecedentes', 'patologias', 'medicacion',
    'resultados_laboratorio', 'documentos', 'medicamentos', 'lotes', 'movimientos_stock', 'auditoria']) {
    await db.exec(`alter table public.${tabla} enable row level security;
      create policy existente on public.${tabla} for all to authenticated using (true) with check (true)`)
  }
  await db.exec('grant all on all tables in schema public, storage to anon, authenticated')
  await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,now())',
    [userA,'a@example.com',userB,'b@example.com',userC,'c@example.com',compartido,'institucional@example.com'])
  await db.query('insert into public.profesionales(id,nombre) values ($1,$2),($3,$4),($5,$6)',
    [profA,'Médico A',profB,'Médico B',profC,'Enfermera C'])
  await db.exec(preparar)
  for (const [prof, user] of [[profA,userA],[profB,userB],[profC,userC]]) {
    await db.query('update public.profesionales set auth_user_id=$1 where id=$2', [user,prof])
  }
  await db.exec('insert into public.pacientes(nombre) values (\'Paciente de prueba\'); insert into storage.objects(bucket_id) values (\'documentos\')')
  await db.exec(activar)
}, 20000)
beforeEach(admin)
afterAll(async () => { await db?.close() })

describe('accesos y autoría en PostgreSQL', () => {
  it('publica solo los accesos vinculados, sin dar acceso a datos clínicos o auth.users', async () => {
    await como(null, 'anon')
    const { rows } = await db.query('select * from public.listar_profesionales_acceso()')
    expect(rows).toHaveLength(3)
    expect(rows.map((p) => p.email)).not.toContain('institucional@example.com')
    expect((await db.query('select * from public.pacientes')).rows).toHaveLength(0)
    await expect(db.query('select * from auth.users')).rejects.toMatchObject({ code: '42501' })
  })
  it('la cuenta compartida no vinculada no puede leer ni insertar historias o ver adjuntos', async () => {
    await como(compartido)
    expect((await db.query('select * from public.pacientes')).rows).toHaveLength(0)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
    await expect(db.query("insert into public.pacientes(nombre) values ('No permitido')")).rejects.toMatchObject({ code: '42501' })
  })
  it('los tres profesionales conservan el mismo acceso al paciente y sus adjuntos', async () => {
    for (const user of [userA,userB,userC]) {
      await como(user)
      expect((await db.query('select * from public.pacientes')).rows).toHaveLength(1)
      expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    }
  })
  it('fija al responsable real aunque el cliente envíe otro UUID y admite solo signos vitales', async () => {
    await como(userC)
    const { rows } = await db.query('insert into public.consultas(profesional_id,presion_sistolica) values ($1,120) returning *', [profA])
    expect(rows[0]).toMatchObject({ profesional_id: profC, presion_sistolica: 120, motivo: null })
  })
  it('conserva al autor al editar y fija al editor y al responsable de una baja', async () => {
    await como(userA)
    const creada = (await db.query("insert into public.consultas(motivo) values ('Original') returning id")).rows[0].id
    await como(userB)
    const editada = (await db.query('update public.consultas set motivo=$1, profesional_id=$2 where id=$3 returning *', ['Corrección',profC,creada])).rows[0]
    expect(editada.profesional_id).toBe(profA)
    const auditoria = (await db.query('insert into public.auditoria(usuario_id) values ($1) returning *', [profA])).rows[0]
    expect(auditoria.usuario_id).toBe(profB)
    const baja = (await db.query('update public.consultas set eliminado_en=now(), eliminado_por=$1 where id=$2 returning *', [profC,creada])).rows[0]
    expect(baja.eliminado_por).toBe(profB)
    const sinReasignar = (await db.query('update public.consultas set eliminado_por=$1 where id=$2 returning *', [profA,creada])).rows[0]
    expect(sinReasignar.eliminado_por).toBe(profB)
  })
  it('conserva el responsable de las demás tablas clínicas al editar', async () => {
    for (const tabla of ['antecedentes','patologias','medicacion','resultados_laboratorio']) {
      await como(userA)
      const creada = (await db.query(`insert into public.${tabla}(contenido) values ('Original') returning id`)).rows[0].id
      await como(userB)
      const fila = (await db.query(`update public.${tabla} set contenido='Corrección', usuario_id=$1 where id=$2 returning *`, [profC,creada])).rows[0]
      expect(fila.usuario_id).toBe(profA)
    }
  })
  it('no permite reasignarse un perfil ni modificar el catálogo desde la aplicación', async () => {
    await como(userA)
    await expect(db.query('update public.profesionales set auth_user_id=$1 where id=$2', [userA,profB])).rejects.toMatchObject({ code: '42501' })
  })
  it('las vistas de stock respetan el acceso individual y los movimientos fijan el actor', async () => {
    const lote = (await db.query('insert into public.lotes default values returning id')).rows[0].id
    await como(userA)
    const movimiento = (await db.query("insert into public.movimientos_stock(lote_id,usuario_id,tipo,cantidad) values ($1,$2,'entrada',10) returning *", [lote,profB])).rows[0]
    expect(movimiento.usuario_id).toBe(profA)
    expect((await db.query('select * from public.stock_por_medicamento')).rows.length).toBeGreaterThan(0)
    await como(compartido)
    expect((await db.query('select * from public.stock_por_medicamento')).rows).toHaveLength(0)
  })
  it('dar de baja al profesional impide accesos aun con su identificador Auth vigente', async () => {
    await db.query('update public.profesionales set activo=false where id=$1', [profC])
    try {
      await como(userC)
      expect((await db.query('select * from public.pacientes')).rows).toHaveLength(0)
      expect((await db.query('select * from public.listar_profesionales_acceso()')).rows).toHaveLength(2)
    } finally {
      await admin()
      await db.query('update public.profesionales set activo=true where id=$1', [profC])
    }
  })
  it('no activa restricciones si falta vincular un profesional activo', async () => {
    await db.query('update public.profesionales set auth_user_id=null where id=$1', [profC])
    await expect(db.exec(activar)).rejects.toThrow('Primero vincular')
    await db.exec('rollback')
    await db.query('update public.profesionales set auth_user_id=$1 where id=$2', [userC,profC])
  })
  it('permite reaplicar las migraciones y conserva las atribuciones existentes', async () => {
    const antes = (await db.query('select id,profesional_id from public.consultas order by id')).rows
    await db.exec(preparar)
    await db.exec(activar)
    expect((await db.query('select id,profesional_id from public.consultas order by id')).rows).toEqual(antes)
  })
})
