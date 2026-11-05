// Ejecuta la migración real en PostgreSQL aislado. El fixture representa el esquema
// de stock y la identidad/RLS ya activadas; no lee .env ni escribe en Supabase.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migracion = readFileSync(new URL('../../supabase/migrations/202611050001_salidas_multiples_lotes.sql', import.meta.url), 'utf8')
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const profesional = id(1), usuario = id(2), paciente = id(3), otroPaciente = id(4), medicamento = id(5), otroMedicamento = id(6)
const consulta = id(7), consultaAjena = id(8), consultaBorrada = id(9)
const loteA = id(10), loteB = id(11), loteAjeno = id(12), loteVencido = id(13), loteHoy = id(14)
let db
async function admin() { await db.exec('reset role') }
async function ingresar(rol = 'authenticated', sub = usuario) {
  await admin()
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub])
  await db.exec(`set role ${rol === 'anon' ? 'anon' : 'authenticated'}`)
}
async function salida(lotes, overrides = {}) {
  const parametros = { medicamento, paciente, consulta: null, total: lotes.reduce((s, l) => s + l.cantidad, 0), motivo: null, ...overrides }
  return db.query('select public.registrar_salida_lotes($1,$2,$3,$4,$5::jsonb,$6) as registrados',
    [parametros.medicamento, parametros.paciente, parametros.consulta, parametros.total, JSON.stringify(lotes), parametros.motivo])
}
async function salidas() { return (await db.query("select * from public.movimientos_stock where tipo='salida' order by lote_id")).rows }

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    create table public.profesionales(id uuid primary key, auth_user_id uuid unique, activo boolean default true, debe_cambiar_password boolean default false);
    create function public.profesional_actual() returns uuid language sql stable security definer set search_path='' as
      $$ select id from public.profesionales where auth_user_id=auth.uid() and activo and not debe_cambiar_password $$;
    create table public.pacientes(id uuid primary key);
    create table public.medicamentos(id uuid primary key, activo boolean default true);
    create table public.consultas(id uuid primary key, paciente_id uuid references public.pacientes(id), eliminado_en timestamptz);
    create table public.lotes(id uuid primary key, medicamento_id uuid references public.medicamentos(id), numero_lote text, fecha_vencimiento date not null);
    create table public.movimientos_stock(id uuid primary key default gen_random_uuid(), lote_id uuid not null references public.lotes(id),
      usuario_id uuid not null references public.profesionales(id), paciente_id uuid references public.pacientes(id), consulta_id uuid references public.consultas(id),
      tipo text not null check(tipo in ('entrada','salida','baja')), cantidad integer not null check(cantidad>0), fecha timestamptz not null default now(), motivo text,
      check(tipo<>'salida' or paciente_id is not null));
    grant select,insert,update,delete on all tables in schema public to authenticated;
  `)
  for (const tabla of ['pacientes', 'medicamentos', 'consultas', 'lotes', 'movimientos_stock']) {
    await db.exec(`alter table public.${tabla} enable row level security;
      create policy acceso on public.${tabla} for all to authenticated
      using ((select public.profesional_actual()) is not null) with check ((select public.profesional_actual()) is not null)`)
  }
  await db.query('insert into public.profesionales(id,auth_user_id) values ($1,$2)', [profesional, usuario])
  await db.query('insert into public.pacientes(id) values ($1),($2)', [paciente, otroPaciente])
  await db.query('insert into public.medicamentos(id) values ($1),($2)', [medicamento, otroMedicamento])
  await db.query('insert into public.consultas(id,paciente_id,eliminado_en) values ($1,$2,null),($3,$4,null),($5,$2,now())',
    [consulta,paciente,consultaAjena,otroPaciente,consultaBorrada])
  const hoy = "(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date"
  await db.query(`insert into public.lotes(id,medicamento_id,numero_lote,fecha_vencimiento) values
    ($1,$2,'A',${hoy}+30),($3,$2,'B',${hoy}+60),($4,$5,'AJENO',${hoy}+30),($6,$2,'VENCIDO',${hoy}-1),($7,$2,'HOY',${hoy})`,
    [loteA,medicamento,loteB,loteAjeno,otroMedicamento,loteVencido,loteHoy])
  await db.exec(migracion)
}, 20000)
beforeEach(async () => {
  await admin()
  await db.exec('truncate public.movimientos_stock')
  await db.exec('update public.profesionales set activo=true, debe_cambiar_password=false; update public.medicamentos set activo=true')
  for (const [lote, cantidad] of [[loteA,2],[loteB,12],[loteAjeno,10],[loteVencido,10],[loteHoy,5]]) {
    await db.query("insert into public.movimientos_stock(lote_id,usuario_id,tipo,cantidad) values ($1,$2,'entrada',$3)", [lote,profesional,cantidad])
  }
  await ingresar()
})
afterAll(async () => { await db?.close() })

describe('salidas de varios lotes en PostgreSQL', () => {
  it('guarda dos movimientos con el mismo paciente, consulta, responsable, fecha y observación', async () => {
    const resultado = await salida([{ lote_id: loteB, cantidad: 8 }, { lote_id: loteA, cantidad: 2 }], { consulta, motivo: ' Entrega de prueba ' })
    expect(resultado.rows[0].registrados).toBe(2)
    const filas = await salidas()
    expect(filas).toHaveLength(2)
    expect(filas.map((m) => m.cantidad)).toEqual([2,8])
    for (const fila of filas) expect(fila).toMatchObject({ usuario_id: profesional, paciente_id: paciente, consulta_id: consulta, motivo: 'Entrega de prueba' })
    expect(filas[0].fecha).toEqual(filas[1].fecha)
  })
  it('revierte el primer descuento cuando el segundo lote no alcanza', async () => {
    await expect(salida([{ lote_id: loteA, cantidad: 2 }, { lote_id: loteB, cantidad: 13 }])).rejects.toThrow('12 unidades disponibles')
    expect(await salidas()).toHaveLength(0)
    await salida([{ lote_id: loteA, cantidad: 2 }])
    expect(await salidas()).toHaveLength(1)
  })
  it('rechaza un formulario desactualizado después de otra salida, sin descontar el otro lote', async () => {
    await salida([{ lote_id: loteB, cantidad: 10 }])
    await expect(salida([{ lote_id: loteA, cantidad: 2 }, { lote_id: loteB, cantidad: 8 }])).rejects.toThrow('2 unidades disponibles')
    expect((await salidas()).map((m) => m.lote_id)).toEqual([loteB])
  })
  it('protege también las bajas y salidas individuales del formulario anterior', async () => {
    await db.query("insert into public.movimientos_stock(lote_id,usuario_id,tipo,cantidad) values ($1,$2,'baja',11)", [loteB,profesional])
    await expect(salida([{ lote_id: loteB, cantidad: 2 }])).rejects.toThrow('1 unidades disponibles')
    await expect(db.query("insert into public.movimientos_stock(lote_id,usuario_id,paciente_id,tipo,cantidad) values ($1,$2,$3,'salida',3)",
      [loteA,profesional,paciente])).rejects.toThrow('2 unidades disponibles')
    await expect(db.query("insert into public.movimientos_stock(lote_id,usuario_id,tipo,cantidad) values ($1,$2,'baja',3)",
      [loteA,profesional])).rejects.toThrow('2 unidades disponibles')
  })
  it.each([
    ['total distinto', [{ lote_id: loteA, cantidad: 1 }], { total: 2 }, 'no coincide'],
    ['lote repetido', [{ lote_id: loteA, cantidad: 1 }, { lote_id: loteA, cantidad: 1 }], {}, 'repetir un lote'],
    ['otro medicamento', [{ lote_id: loteAjeno, cantidad: 1 }], {}, 'no corresponde al medicamento'],
    ['lote inexistente', [{ lote_id: id(999), cantidad: 1 }], {}, 'no corresponde al medicamento'],
    ['lote vencido', [{ lote_id: loteVencido, cantidad: 1 }], {}, 'lote vencido'],
    ['sin paciente', [{ lote_id: loteA, cantidad: 1 }], { paciente: null }, 'confirmá el paciente'],
    ['consulta ajena', [{ lote_id: loteA, cantidad: 1 }], { consulta: consultaAjena }, 'no corresponde al paciente'],
    ['consulta borrada', [{ lote_id: loteA, cantidad: 1 }], { consulta: consultaBorrada }, 'no corresponde al paciente'],
    ['cantidad cero', [{ lote_id: loteA, cantidad: 0 }], { total: 1 }, 'entera mayor a cero'],
    ['cantidad negativa', [{ lote_id: loteA, cantidad: -1 }], { total: 1 }, 'entera mayor a cero'],
    ['cantidad fraccionaria', [{ lote_id: loteA, cantidad: 1.5 }], { total: 2 }, 'entera mayor a cero'],
  ])('rechaza %s sin insertar movimientos', async (_caso, lotes, parametros, mensaje) => {
    await expect(salida(lotes, parametros)).rejects.toThrow(mensaje)
    expect(await salidas()).toHaveLength(0)
  })
  it('no acepta distribuciones vacías, nulas o con estructura incorrecta', async () => {
    for (const distribucion of [null, {}, [], [null], [{ cantidad: 1 }], [{ lote_id: loteA, cantidad: '1' }]]) {
      await expect(db.query('select public.registrar_salida_lotes($1,$2,null,1,$3::jsonb,null)',
        [medicamento,paciente,JSON.stringify(distribucion)])).rejects.toThrow()
    }
    expect(await salidas()).toHaveLength(0)
  })
  it('permite el lote que vence hoy y la entrega de stock remanente de un medicamento inactivo', async () => {
    await admin()
    await db.query('update public.medicamentos set activo=false where id=$1', [medicamento])
    await ingresar()
    await salida([{ lote_id: loteHoy, cantidad: 5 }])
    expect((await salidas())[0].cantidad).toBe(5)
  })
  it('no concede ejecución a anónimos ni permite una sesión sin vínculo o pendiente de contraseña', async () => {
    await ingresar('anon')
    await expect(salida([{ lote_id: loteA, cantidad: 1 }])).rejects.toMatchObject({ code: '42501' })
    await ingresar('authenticated', id(999))
    await expect(salida([{ lote_id: loteA, cantidad: 1 }])).rejects.toMatchObject({ code: '42501' })
    await admin()
    await db.exec('update public.profesionales set debe_cambiar_password=true')
    await ingresar()
    await expect(salida([{ lote_id: loteA, cantidad: 1 }])).rejects.toMatchObject({ code: '42501' })
    await admin()
    expect(await salidas()).toHaveLength(0)
  })
  it('respeta RLS además de validar el responsable y no eleva privilegios', async () => {
    await admin()
    await db.exec(`create policy bloquear_entregas on public.movimientos_stock as restrictive for insert to authenticated with check(tipo <> 'salida')`)
    try {
      await ingresar()
      await expect(salida([{ lote_id: loteA, cantidad: 1 }])).rejects.toMatchObject({ code: '42501' })
      expect(await salidas()).toHaveLength(0)
    } finally {
      await admin()
      await db.exec('drop policy bloquear_entregas on public.movimientos_stock')
    }
  })
  it('reaplicar la migración conserva los movimientos previos', async () => {
    await salida([{ lote_id: loteA, cantidad: 1 }])
    const antes = await salidas()
    await admin()
    await db.exec(migracion)
    expect(await salidas()).toEqual(antes)
  })
})
