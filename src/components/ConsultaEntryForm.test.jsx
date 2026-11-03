// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, Link, RouterProvider, useParams } from 'react-router-dom'
import ConsultaEntryForm from './ConsultaEntryForm'
import AbrirNuevaConsulta from './AbrirNuevaConsulta'
import CambiarUsuario from '@/pages/CambiarUsuario'
import { guardarBorradorConsulta, leerBorradorConsulta } from '@/lib/borradorConsulta'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), insertarConsulta: vi.fn(), insertarMedicacion: vi.fn(), onSaved: vi.fn(),
  actualizarConsulta: vi.fn(), profesional: { id: 'profesional-a', nombre: 'Profesional de prueba' },
  logout: vi.fn(),
}))
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: vi.fn() }))
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ profesional: mocks.profesional, logout: mocks.logout }) }))

const textoLargo = 'Consulta extensa con varias observaciones.\n'.repeat(200)
let router

function PantallaConsulta({ onClose }) {
  const { id } = useParams()
  return <>
    <Link to="/pacientes">Volver a pacientes</Link>
    <Link to="/cambiar-usuario">Cambiar usuario</Link>
    <ConsultaEntryForm key={id} pacienteId={id} onClose={onClose} onSaved={mocks.onSaved} />
  </>
}

function abrir({ id = 'paciente-a', consulta, onClose = vi.fn() } = {}) {
  router = createMemoryRouter([
    { path: '/pacientes', element: <h1>Pacientes</h1> },
    { path: '/login', element: <h1>Elegir usuario</h1> },
    { path: '/cambiar-usuario', element: <CambiarUsuario /> },
    { path: '/pacientes/:id', element: consulta
      ? <ConsultaEntryForm pacienteId={id} consulta={consulta} onClose={onClose} onSaved={mocks.onSaved} />
      : <PantallaConsulta onClose={onClose} /> },
  ], { initialEntries: ['/pacientes', `/pacientes/${id}`], initialIndex: 1 })
  return render(<RouterProvider router={router} />)
}

function escribirMotivo(texto = textoLargo) {
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: texto } })
}

async function guardarConsulta() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar consulta' }))
}

const leerBorrador = (pacienteId) => leerBorradorConsulta(pacienteId, mocks.profesional?.id)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.profesional = { id: 'profesional-a', nombre: 'Profesional de prueba' }
  mocks.logout.mockResolvedValue({ error: null })
  mocks.actualizarConsulta.mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'consulta-existente' }, error: null }) }) }) })
  mocks.insertarConsulta.mockResolvedValue({ data: { id: 'consulta-nueva' }, error: null })
  mocks.insertarMedicacion.mockResolvedValue({ data: {
    id: 'medicacion-nueva', paciente_id: 'paciente-a', nombre: 'Medicamento de prueba', dosis: '10 mg', estado: 'Activa',
  }, error: null })
  mocks.from.mockImplementation((tabla) => {
    const insertar = tabla === 'consultas' ? mocks.insertarConsulta : mocks.insertarMedicacion
    return { insert: (payload) => ({ select: () => ({ single: () => insertar(payload) }) }), update: mocks.actualizarConsulta }
  })
})

afterEach(() => {
  cleanup()
  router?.dispose()
  vi.restoreAllMocks()
})

describe('borrador de nueva consulta', () => {
  it('recupera texto extenso, profesional, signos vitales y medicación después de desmontar', async () => {
    const vista = abrir()
    escribirMotivo()
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar signos vitales' }))
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar a medicación habitual' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Medicamento de prueba' } })
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '10 mg' } })
    expect(leerBorrador('paciente-a').form.motivo).toBe(textoLargo)
    vista.unmount()
    router.dispose()
    abrir()
    expect(screen.getByText('Borrador recuperado. Podés continuar donde lo dejaste.')).toBeTruthy()
    expect(screen.getAllByRole('textbox')[2].value).toBe(textoLargo)
    expect(screen.getAllByRole('textbox')[0].value).toBe('Medicamento de prueba')
    expect(screen.getAllByRole('spinbutton')[0].value).toBe('120')
    expect(leerBorrador('paciente-a').profesionalId).toBe('profesional-a')
    expect(mocks.insertarConsulta).not.toHaveBeenCalled()
  })

  it('mantiene separados los pacientes incluso al navegar entre fichas', async () => {
    abrir()
    escribirMotivo('Texto del paciente A')
    await act(() => router.navigate('/pacientes/paciente-b'))
    fireEvent.click(screen.getByRole('button', { name: 'Salir y conservar borrador' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/pacientes/paciente-b'))
    expect(screen.getAllByRole('textbox')[0].value).toBe('')
    escribirMotivo('Texto del paciente B')
    expect(leerBorrador('paciente-a').form.motivo).toBe('Texto del paciente A')
    expect(leerBorrador('paciente-b').form.motivo).toBe('Texto del paciente B')
  })

  it('avisa al usar Atrás, permite quedarse y conserva el borrador al salir', async () => {
    abrir()
    escribirMotivo()
    await act(() => router.navigate(-1))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/pacientes/paciente-a')
    fireEvent.click(screen.getByRole('button', { name: 'Seguir escribiendo' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getAllByRole('textbox')[0].value).toBe(textoLargo)
    fireEvent.click(screen.getByRole('link', { name: 'Volver a pacientes' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salir y conservar borrador' }))
    await screen.findByRole('heading', { name: 'Pacientes' })
    expect(leerBorrador('paciente-a').form.motivo).toBe(textoLargo)
  })

  it('avisa al cerrar o recargar únicamente si hay contenido pendiente', () => {
    abrir()
    const sinCambios = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(sinCambios)
    expect(sinCambios.defaultPrevented).toBe(false)
    escribirMotivo()
    const conCambios = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(conCambios)
    expect(conCambios.defaultPrevented).toBe(true)
  })

  it('confirma antes de cambiar de usuario y conserva el borrador de la cuenta que sale', async () => {
    abrir()
    escribirMotivo('Consulta antes de cambiar de cuenta')
    fireEvent.click(screen.getByRole('link', { name: 'Cambiar usuario' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(mocks.logout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salir y conservar borrador' }))
    await screen.findByRole('heading', { name: 'Elegir usuario' })
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(leerBorrador('paciente-a').form.motivo).toBe('Consulta antes de cambiar de cuenta')
  })

  it('conserva el borrador ante un error y lo elimina solo cuando se registra la consulta', async () => {
    mocks.insertarConsulta.mockResolvedValueOnce({ data: null, error: { message: 'Error de prueba' } })
    abrir()
    escribirMotivo()
    await guardarConsulta()
    await screen.findByText('Error de prueba')
    expect(leerBorrador('paciente-a').form.motivo).toBe(textoLargo)
    expect(mocks.onSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar consulta' }))
    await waitFor(() => expect(mocks.onSaved).toHaveBeenCalledOnce())
    expect(leerBorrador('paciente-a')).toBeNull()
    const evento = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evento)
    await waitFor(() => {
      const sinPendientes = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(sinPendientes)
      expect(sinPendientes.defaultPrevented).toBe(false)
    })
  })

  it('no duplica la medicación ya registrada si se recupera una consulta cuyo guardado falló', async () => {
    mocks.insertarConsulta.mockResolvedValueOnce({ data: null, error: { message: 'Error de prueba' } })
    const vista = abrir()
    escribirMotivo()
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar a medicación habitual' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Medicamento de prueba' } })
    await guardarConsulta()
    await screen.findByText('Error de prueba')
    vista.unmount()
    router.dispose()
    abrir()
    expect(screen.getByText('Esta medicación ya se registró. Falta guardar la consulta.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar consulta' }))
    await waitFor(() => expect(mocks.onSaved).toHaveBeenCalledOnce())
    expect(mocks.insertarMedicacion).toHaveBeenCalledOnce()
  })

  it('informa si el navegador rechaza guardar el borrador y mantiene el aviso al salir', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded') })
    abrir()
    escribirMotivo()
    expect(screen.getByRole('status').textContent).toContain('No se pudo guardar el borrador')
    fireEvent.click(screen.getByRole('link', { name: 'Volver a pacientes' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('podés perder lo que escribiste')
  })

  it('la edición de una consulta existente no sobreescribe el borrador de un alta', () => {
    guardarBorradorConsulta('paciente-a', { form: { motivo: 'Alta pendiente' }, profesionalId: 'profesional-a' })
    abrir({ consulta: { id: 'consulta-existente', motivo: 'Motivo histórico' } })
    escribirMotivo('Corrección del motivo histórico')
    expect(leerBorrador('paciente-a').form.motivo).toBe('Alta pendiente')
  })

  it('no recupera ni sobrescribe un borrador perteneciente a otro profesional', async () => {
    guardarBorradorConsulta('paciente-a', { form: { motivo: textoLargo }, profesionalId: 'profesional-inactivo' })
    abrir()
    expect(screen.getAllByRole('textbox')[0].value).toBe('')
    expect(leerBorradorConsulta('paciente-a', 'profesional-inactivo').form.motivo).toBe(textoLargo)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar consulta' }))
    expect(mocks.insertarConsulta).not.toHaveBeenCalled()
  })

  it('registra solamente signos vitales con el responsable de la sesión y sin selector', async () => {
    abrir()
    expect(screen.queryByText('¿Quién atiende?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar signos vitales' }))
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '120' } })
    await guardarConsulta()
    await waitFor(() => expect(mocks.insertarConsulta).toHaveBeenCalledOnce())
    expect(mocks.insertarConsulta.mock.calls[0][0]).toMatchObject({ profesional_id: 'profesional-a', presion_sistolica: 120, motivo: null })
  })

  it('mantiene al responsable original al editar y atribuye la auditoría al editor', async () => {
    const { registrarAuditoria } = await import('@/lib/auditoria')
    registrarAuditoria.mockResolvedValue({ error: null })
    abrir({ consulta: { id: 'consulta-existente', profesional_id: 'otro-profesional', motivo: 'Histórico' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.actualizarConsulta).toHaveBeenCalledOnce())
    expect(mocks.actualizarConsulta.mock.calls[0][0]).not.toHaveProperty('profesional_id')
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'profesional-a' }))
  })

  it('rechaza escrituras cuando no hay un profesional en la sesión', async () => {
    mocks.profesional = null
    abrir()
    escribirMotivo('No guardar sin identidad')
    await guardarConsulta()
    expect(mocks.insertarConsulta).not.toHaveBeenCalled()
    expect(screen.getByText('No hay un profesional activo en la sesión. Volvé a ingresar.')).toBeTruthy()
  })

  it('Cancelar requiere confirmar y mantiene el borrador', () => {
    const onClose = vi.fn()
    abrir({ onClose })
    escribirMotivo()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(confirmar).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getAllByRole('textbox')[0].value).toBe(textoLargo)
    expect(leerBorrador('paciente-a').form.motivo).toBe(textoLargo)
    confirmar.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(leerBorrador('paciente-a').form.motivo).toBe(textoLargo)
  })

  it('protege el texto mientras está en curso el guardado', async () => {
    let resolver
    mocks.insertarConsulta.mockReturnValue(new Promise((resolve) => { resolver = resolve }))
    abrir()
    escribirMotivo()
    await guardarConsulta()
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(screen.getAllByRole('textbox')[0].matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: 'Volver a pacientes' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('Se está guardando')
    expect(screen.getByRole('button', { name: 'Salir y conservar borrador' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Seguir escribiendo' }))
    await act(() => resolver({ data: { id: 'consulta-nueva' }, error: null }))
  })
})

describe('recuperación y descarte', () => {
  it('ofrece continuar y requiere confirmar antes de descartar', () => {
    guardarBorradorConsulta('paciente-a', { form: { motivo: textoLargo }, profesionalId: 'profesional-a' })
    const continuar = vi.fn()
    render(<AbrirNuevaConsulta pacienteId="paciente-a" onOpen={continuar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar consulta' }))
    expect(continuar).toHaveBeenCalledOnce()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador' }))
    expect(leerBorrador('paciente-a')).not.toBeNull()
    confirmar.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador' }))
    expect(leerBorrador('paciente-a')).toBeNull()
    expect(screen.getByRole('button', { name: '+ Nueva consulta' })).toBeTruthy()
  })

  it('tolera JSON dañado y solo recupera campos conocidos de un borrador', () => {
    localStorage.setItem('hc:consulta-borrador:v1:paciente-a', '{json incompleto')
    expect(leerBorrador('paciente-a')).toBeNull()
    guardarBorradorConsulta('paciente-a', { form: { motivo: textoLargo, campoDesconocido: 'dato' }, profesionalId: 'profesional-a' })
    expect(leerBorrador('paciente-a').form.campoDesconocido).toBeUndefined()
  })
})
