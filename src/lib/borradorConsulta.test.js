// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leerBorradorConsulta, guardarBorradorConsulta, eliminarBorradorConsulta,
  recuperarBorradorAnterior, tieneContenidoConsulta } from './borradorConsulta'

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear() })
const borrador = (profesionalId, motivo) => ({ profesionalId, form: { motivo } })
function anterior(profesionalId) {
  localStorage.setItem('hc:consulta-borrador:v1:paciente', JSON.stringify({ ...borrador(profesionalId, 'Texto anterior'), version: 1 }))
}
describe('borradores por profesional', () => {
  it('conserva dos borradores del mismo paciente sin mezclarlos', () => {
    guardarBorradorConsulta('paciente', borrador('a', 'Texto A'))
    guardarBorradorConsulta('paciente', borrador('b', 'Texto B'))
    expect(leerBorradorConsulta('paciente', 'a').form.motivo).toBe('Texto A')
    expect(leerBorradorConsulta('paciente', 'b').form.motivo).toBe('Texto B')
    eliminarBorradorConsulta('paciente', 'a')
    expect(leerBorradorConsulta('paciente', 'b').form.motivo).toBe('Texto B')
  })
  it('la identidad automática no convierte un formulario vacío en consulta pendiente', () => {
    expect(tieneContenidoConsulta(borrador('a', ''))).toBe(false)
    guardarBorradorConsulta('paciente', borrador('a', ''))
    expect(leerBorradorConsulta('paciente', 'a')).toBeNull()
  })
  it('recupera un borrador antiguo solo para su autor y lo retira al guardar', () => {
    anterior('a')
    expect(leerBorradorConsulta('paciente', 'b')).toBeNull()
    expect(leerBorradorConsulta('paciente', 'a').form.motivo).toBe('Texto anterior')
    eliminarBorradorConsulta('paciente', 'a')
    expect(leerBorradorConsulta('paciente', 'a')).toBeNull()
  })
  it('requiere una recuperación explícita del borrador antiguo sin autor', () => {
    anterior(null)
    expect(leerBorradorConsulta('paciente', 'a')).toBeNull()
    expect(recuperarBorradorAnterior('paciente', 'a')).toBe(true)
    expect(leerBorradorConsulta('paciente', 'a').form.motivo).toBe('Texto anterior')
    expect(leerBorradorConsulta('paciente')).toBeNull()
  })
  it('no permite apropiarse por recuperación de un borrador que ya tiene autor', () => {
    anterior('b')
    expect(recuperarBorradorAnterior('paciente', 'a')).toBe(false)
    expect(leerBorradorConsulta('paciente', 'b').form.motivo).toBe('Texto anterior')
  })
  it('no elimina el borrador anterior cuando falla su traslado', () => {
    anterior(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('QuotaExceeded') })
    expect(recuperarBorradorAnterior('paciente', 'a')).toBe(false)
    expect(leerBorradorConsulta('paciente').form.motivo).toBe('Texto anterior')
  })
  it('no pisa un borrador actual si otra pestaña intenta recuperar uno anterior', () => {
    anterior(null)
    guardarBorradorConsulta('paciente', borrador('a', 'Texto más reciente'))
    expect(recuperarBorradorAnterior('paciente', 'a')).toBe(false)
    expect(leerBorradorConsulta('paciente', 'a').form.motivo).toBe('Texto más reciente')
    expect(leerBorradorConsulta('paciente').form.motivo).toBe('Texto anterior')
  })
})
