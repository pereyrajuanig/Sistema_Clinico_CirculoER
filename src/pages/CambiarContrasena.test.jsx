// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CambiarContrasena from './CambiarContrasena'
import ProtectedRoute from '@/components/ProtectedRoute'
const mocks = vi.hoisted(() => ({ cambiar: vi.fn(), session: { user: { id: 'auth-a' } },
  profesional: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true } }))
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ session: mocks.session, profesional: mocks.profesional,
  loading: false, cambiarPasswordInicial: mocks.cambiar }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = { user: { id: 'auth-a' } }
  mocks.profesional = { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }
  mocks.cambiar.mockResolvedValue({ error: null })
})
afterEach(cleanup)
function abrir(ruta = '/cambiar-contrasena') {
  return render(<MemoryRouter initialEntries={[ruta]}><Routes>
    <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
    <Route path="/login" element={<h1>Seleccionar usuario</h1>} />
    <Route path="/" element={<ProtectedRoute><h1>Historias clínicas</h1></ProtectedRoute>} />
  </Routes></MemoryRouter>)
}
function completar(password, confirmacion = password) {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Repetí la contraseña nueva'), { target: { value: confirmacion } })
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar contraseña e ingresar' }).closest('form'))
}
describe('primer ingreso', () => {
  it('dirige a elegir contraseña antes de montar pantallas clínicas, incluso entrando por URL', async () => {
    abrir('/')
    await screen.findByRole('heading', { name: 'Elegí tu contraseña' })
    expect(screen.queryByRole('heading', { name: 'Historias clínicas' })).toBeNull()
  })
  it('pide al menos ocho caracteres y confirma que ambas contraseñas coincidan', () => {
    abrir()
    completar('corta')
    expect(screen.getByRole('alert').textContent).toContain('al menos 8 caracteres')
    completar('Contraseña nueva', 'Otra diferente')
    expect(screen.getByRole('alert').textContent).toContain('no coinciden')
    expect(mocks.cambiar).not.toHaveBeenCalled()
  })
  it('envía solo la contraseña nueva a la operación autenticada', async () => {
    abrir()
    completar('Mi contraseña de prueba')
    await waitFor(() => expect(mocks.cambiar).toHaveBeenCalledWith('Mi contraseña de prueba'))
    expect(screen.getByLabelText('Contraseña nueva').type).toBe('password')
  })
  it('muestra errores del cambio sin permitir entrar a historias', async () => {
    mocks.cambiar.mockResolvedValue({ error: { message: 'Elegí una contraseña distinta de la provisoria.' } })
    abrir()
    completar('Mi contraseña de prueba')
    await screen.findByRole('alert')
    expect(screen.queryByRole('heading', { name: 'Historias clínicas' })).toBeNull()
  })
  it('pide la contraseña provisoria adicional solo si la política del servidor la exige', async () => {
    mocks.cambiar.mockResolvedValueOnce({ requierePasswordActual: true, error: { message: 'Confirmá con la provisoria.' } })
    abrir()
    expect(screen.queryByLabelText('Contraseña provisoria')).toBeNull()
    completar('Mi contraseña de prueba')
    const actual = await screen.findByLabelText('Contraseña provisoria')
    fireEvent.change(actual, { target: { value: 'provisoria-de-prueba' } })
    completar('Mi contraseña de prueba')
    await waitFor(() => expect(mocks.cambiar).toHaveBeenLastCalledWith('Mi contraseña de prueba', 'provisoria-de-prueba'))
  })
  it('no vuelve a pedir el paso cuando la cuenta ya lo completó', async () => {
    mocks.profesional.debe_cambiar_password = false
    abrir()
    await screen.findByRole('heading', { name: 'Historias clínicas' })
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull()
  })
  it('sin sesión vuelve a la selección de usuario', async () => {
    mocks.session = null
    mocks.profesional = null
    abrir()
    await screen.findByRole('heading', { name: 'Seleccionar usuario' })
  })
  it('bloquea el doble envío mientras guarda y permite mostrar la contraseña', async () => {
    let terminar
    mocks.cambiar.mockReturnValue(new Promise((resolve) => { terminar = resolve }))
    abrir()
    fireEvent.click(screen.getByLabelText('Mostrar contraseñas'))
    expect(screen.getByLabelText('Contraseña nueva').type).toBe('text')
    completar('Mi contraseña de prueba')
    const boton = screen.getByRole('button', { name: 'Guardando…' })
    expect(boton.disabled).toBe(true)
    expect(screen.queryByRole('link', { name: 'Volver a elegir usuario' })).toBeNull()
    fireEvent.submit(boton.closest('form'))
    expect(mocks.cambiar).toHaveBeenCalledOnce()
    terminar({ error: null })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar contraseña e ingresar' }).disabled).toBe(false))
  })
})
