// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SalidaStockModal from './SalidaStockModal'

const mocks = vi.hoisted(() => ({ from: vi.fn(), buscarPaciente: vi.fn(), consultas: vi.fn(),
  crearPaciente: vi.fn(), salida: vi.fn(), registrado: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: mocks.from } }))

const paciente = { id: 'paciente-existente', nombre: 'Paciente', apellido: 'De Prueba', dni: '12345678' }
const otroPaciente = { id: 'otro-paciente', nombre: 'Otra Persona', apellido: 'De Prueba', dni: '23456789' }
const medicamento = { id: 'medicamento', nombre: 'Medicamento de prueba', presentacion: 'Cápsulas', concentracion: '10 mg' }
const lote = { lote_id: 'lote', numero_lote: 'PRUEBA', fecha_vencimiento: '2099-01-01', stock_actual: 24 }

function pendiente() {
  let resolver
  const promesa = new Promise((resolve) => { resolver = resolve })
  return { promesa, resolver }
}
async function resolver(peticion, data, error = null) {
  await act(async () => { peticion.resolver({ data, error }) })
}
async function iniciarBusqueda(dni) {
  fireEvent.change(screen.getByPlaceholderText('Ej: 12345678'), { target: { value: dni } })
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
}
async function abrir() {
  await act(async () => { render(<SalidaStockModal medicamentos={[medicamento]} onClose={vi.fn()} onRegistrado={mocks.registrado} />) })
  fireEvent.click(screen.getByRole('button', { name: 'Profesional de prueba' }))
  fireEvent.focus(screen.getByPlaceholderText('Escribir para buscar...'))
  await act(async () => { fireEvent.mouseDown(screen.getByText('Medicamento de prueba 10 mg (Cápsulas)')) })
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } })
}
async function guardar() {
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Registrar salida' }).closest('form')) })
}
function completarAlta() {
  // El selector buscable y DNI son los primeros campos de texto del formulario.
  fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'paciente' } })
  fireEvent.change(screen.getAllByRole('textbox')[3], { target: { value: 'de prueba' } })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.buscarPaciente.mockResolvedValue({ data: paciente, error: null })
  mocks.consultas.mockResolvedValue({ data: [], error: null })
  mocks.crearPaciente.mockResolvedValue({ data: paciente, error: null })
  mocks.salida.mockResolvedValue({ error: null })
  mocks.from.mockImplementation((tabla) => {
    if (tabla === 'profesionales') return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'profesional', nombre: 'Profesional de prueba' }], error: null }) }) }) }
    if (tabla === 'stock_por_lote') return { select: () => ({ eq: () => ({ gt: () => ({ gte: () => ({ order: async () => ({ data: [lote], error: null }) }) }) }) }) }
    if (tabla === 'pacientes') return {
      select: () => ({ eq: (_campo, dni) => ({ maybeSingle: () => mocks.buscarPaciente(dni) }) }),
      insert: (payload) => ({ select: () => ({ single: () => mocks.crearPaciente(payload) }) }),
    }
    if (tabla === 'consultas') return { select: () => ({ eq: (_campo, id) => ({ is: () => ({ order: () => mocks.consultas(id) }) }) }) }
    if (tabla === 'movimientos_stock') return { insert: mocks.salida }
    throw new Error(`Tabla inesperada: ${tabla}`)
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('paciente de una salida de stock', () => {
  it.each(['antes', 'después'])('ignora la respuesta del DNI incompleto que llega %s de la búsqueda final', async (orden) => {
    const incompleto = pendiente(), completo = pendiente()
    mocks.buscarPaciente.mockImplementation((dni) => dni === '1234567' ? incompleto.promesa : completo.promesa)
    await abrir()
    await iniciarBusqueda('1234567')
    await iniciarBusqueda('12345678')
    if (orden === 'antes') await resolver(incompleto, null)
    await resolver(completo, paciente)
    if (orden === 'después') await resolver(incompleto, null)
    expect(screen.getByText('De Prueba, Paciente')).toBeTruthy()
    expect(screen.queryByText(/No se encontró ningún paciente/)).toBeNull()
    await guardar()
    expect(mocks.crearPaciente).not.toHaveBeenCalled()
    expect(mocks.salida).toHaveBeenCalledWith(expect.objectContaining({ paciente_id: paciente.id, cantidad: 20 }))
  })

  it('no habilita un paciente previo mientras se busca otro DNI ni después de borrarlo', async () => {
    await abrir()
    await iniciarBusqueda('12345678')
    const tardia = pendiente()
    mocks.buscarPaciente.mockReturnValue(tardia.promesa)
    await iniciarBusqueda('23456789')
    expect(screen.getByRole('button', { name: 'Registrar salida' }).disabled).toBe(true)
    await guardar()
    expect(mocks.salida).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('Ej: 12345678'), { target: { value: '' } })
    await resolver(tardia, otroPaciente)
    expect(screen.queryByText('De Prueba, Otra Persona')).toBeNull()
    expect(screen.queryByText('Buscando paciente...')).toBeNull()
  })

  it('conserva el paciente creado si falla la salida, para reintentar sin duplicarlo', async () => {
    mocks.buscarPaciente.mockResolvedValue({ data: null, error: null })
    mocks.salida.mockResolvedValueOnce({ error: { message: 'Salida rechazada para la prueba' } })
    await abrir()
    await iniciarBusqueda('12345678')
    completarAlta()
    await guardar()
    expect(mocks.crearPaciente).toHaveBeenCalledOnce()
    expect(screen.getByText('Salida rechazada para la prueba')).toBeTruthy()
    await guardar()
    expect(mocks.crearPaciente).toHaveBeenCalledOnce()
    expect(mocks.salida).toHaveBeenCalledTimes(2)
    expect(mocks.registrado).toHaveBeenCalledOnce()
  })

  it('si otro usuario ya creó el DNI, muestra el paciente existente y pide confirmar antes de registrar', async () => {
    mocks.buscarPaciente.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: paciente, error: null })
    mocks.crearPaciente.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pacientes_dni_key"' } })
    await abrir()
    await iniciarBusqueda('12345678')
    completarAlta()
    await guardar()
    expect(screen.getByText('De Prueba, Paciente')).toBeTruthy()
    expect(screen.getByText(/Este DNI ya está registrado/)).toBeTruthy()
    expect(mocks.salida).not.toHaveBeenCalled()
    await guardar()
    expect(mocks.crearPaciente).toHaveBeenCalledOnce()
    expect(mocks.salida).toHaveBeenCalledWith(expect.objectContaining({ paciente_id: paciente.id }))
  })

  it('descarta consultas tardías del paciente anterior', async () => {
    const anterior = pendiente()
    mocks.consultas.mockReturnValueOnce(anterior.promesa).mockResolvedValue({ data: [{ id: 'consulta-actual', fecha: '2026-01-02', motivo: 'Consulta actual' }], error: null })
    mocks.buscarPaciente.mockResolvedValueOnce({ data: paciente, error: null }).mockResolvedValue({ data: otroPaciente, error: null })
    await abrir()
    await iniciarBusqueda(paciente.dni)
    await iniciarBusqueda(otroPaciente.dni)
    await resolver(anterior, [{ id: 'consulta-vieja', fecha: '2026-01-01', motivo: 'Consulta del anterior' }])
    expect(screen.queryByRole('option', { name: /Consulta del anterior/ })).toBeNull()
    expect(screen.getByRole('option', { name: /Consulta actual/ })).toBeTruthy()
    await guardar()
    expect(mocks.salida).toHaveBeenCalledWith(expect.objectContaining({ paciente_id: otroPaciente.id, consulta_id: null }))
  })

  it('limpia la consulta seleccionada al cambiar de paciente', async () => {
    mocks.consultas.mockResolvedValueOnce({ data: [{ id: 'consulta-previa', fecha: '2026-01-01', motivo: 'Consulta anterior' }], error: null })
    mocks.buscarPaciente.mockResolvedValueOnce({ data: paciente, error: null }).mockResolvedValue({ data: otroPaciente, error: null })
    await abrir()
    await iniciarBusqueda(paciente.dni)
    const opcion = screen.getByRole('option', { name: /Consulta anterior/ })
    fireEvent.change(opcion.closest('select'), { target: { value: 'consulta-previa' } })
    await iniciarBusqueda(otroPaciente.dni)
    await guardar()
    expect(mocks.salida).toHaveBeenCalledWith(expect.objectContaining({ paciente_id: otroPaciente.id, consulta_id: null }))
  })

  it('un error de búsqueda no ofrece dar de alta al paciente ni permite registrar', async () => {
    mocks.buscarPaciente.mockResolvedValue({ data: null, error: { message: 'Error de búsqueda simulado' } })
    await abrir()
    await iniciarBusqueda(paciente.dni)
    expect(screen.getByText('Error de búsqueda simulado')).toBeTruthy()
    expect(screen.queryByText(/No se encontró ningún paciente/)).toBeNull()
    await guardar()
    expect(mocks.crearPaciente).not.toHaveBeenCalled()
    expect(mocks.salida).not.toHaveBeenCalled()
  })

  it('el alta rápida normaliza los datos y conserva la salida al paciente nuevo', async () => {
    mocks.buscarPaciente.mockResolvedValue({ data: null, error: null })
    await abrir()
    await iniciarBusqueda('12.345.678')
    completarAlta()
    await guardar()
    expect(mocks.crearPaciente).toHaveBeenCalledWith({ nombre: 'Paciente', apellido: 'De Prueba', dni: paciente.dni })
    expect(mocks.salida).toHaveBeenCalledWith(expect.objectContaining({ paciente_id: paciente.id, lote_id: lote.lote_id, usuario_id: 'profesional', tipo: 'salida', cantidad: 20 }))
    expect(mocks.registrado).toHaveBeenCalledOnce()
  })

  it('bloquea el doble envío y los cambios de datos mientras guarda', async () => {
    const salida = pendiente()
    mocks.salida.mockReturnValue(salida.promesa)
    await abrir()
    await iniciarBusqueda(paciente.dni)
    await guardar()
    const boton = screen.getByRole('button', { name: 'Guardando...' })
    expect(boton.disabled).toBe(true)
    expect(screen.getByPlaceholderText('Ej: 12345678').closest('fieldset').disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    await act(async () => { fireEvent.submit(boton.closest('form')) })
    expect(mocks.salida).toHaveBeenCalledOnce()
    await act(async () => { salida.resolver({ error: null }) })
    expect(mocks.registrado).toHaveBeenCalledOnce()
  })
})
