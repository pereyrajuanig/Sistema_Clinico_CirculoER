// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { useState } from 'react'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), profile: vi.fn(), rpc: vi.fn(), updateUser: vi.fn(),
  signOut: vi.fn(), signIn: vi.fn(), listener: null, unsubscribe: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  rpc: mocks.rpc,
  auth: { getSession: mocks.getSession, signOut: mocks.signOut, signInWithPassword: mocks.signIn, updateUser: mocks.updateUser,
    onAuthStateChange: (callback) => { mocks.listener = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } } },
} }))
const sessionA = { user: { id: 'auth-a' } }
const sessionB = { user: { id: 'auth-b' } }
function Probe() {
  const { profesional, loading, errorAcceso, logout, cambiarPasswordInicial } = useAuth()
  const [errorCambio, setErrorCambio] = useState('')
  return <>
    <p data-testid="identidad">{loading ? 'Cargando' : profesional?.nombre || 'Sin profesional'}</p>
    <p>{errorAcceso}</p>
    <p>{profesional?.debe_cambiar_password ? 'Contraseña pendiente' : 'Contraseña lista'}</p>
    <p>{errorCambio}</p>
    <button onClick={async () => { const result = await cambiarPasswordInicial('Nueva contraseña de prueba'); setErrorCambio(result.error?.message || '') }}>Cambiar contraseña</button>
    <button onClick={() => logout()}>Salir</button>
  </>
}
function abrir() { render(<AuthProvider><Probe /></AuthProvider>) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: sessionA }, error: null })
  mocks.profile.mockResolvedValue({ data: { id: 'profesional-historico-a', nombre: 'Médico A', debe_cambiar_password: false }, error: null })
  mocks.rpc.mockReturnValue({ maybeSingle: mocks.profile })
  mocks.updateUser.mockResolvedValue({ data: { user: sessionA.user }, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('identidad profesional de la sesión', () => {
  it('resuelve el catálogo por auth_user_id sin asumir que ambos UUID son iguales', async () => {
    abrir()
    expect(screen.getByTestId('identidad').textContent).toBe('Cargando')
    await screen.findByText('Médico A')
    expect(mocks.rpc).toHaveBeenCalledWith('identidad_profesional_actual')
  })
  it('no habilita un profesional para la cuenta institucional no vinculada', async () => {
    mocks.profile.mockResolvedValue({ data: null, error: null })
    abrir()
    await screen.findByText('Esta cuenta no tiene un profesional activo asignado. Elegí tu usuario para ingresar.')
    expect(screen.getByTestId('identidad').textContent).toBe('Sin profesional')
  })
  it('muestra el error de consulta sin dejar el acceso cargando para siempre', async () => {
    mocks.profile.mockRejectedValue(new Error('Sin conexión'))
    abrir()
    await screen.findByText('No se pudo verificar tu acceso. Revisá la conexión e intentá nuevamente.')
    expect(screen.getByTestId('identidad').textContent).toBe('Sin profesional')
  })
  it('ignora la respuesta tardía de una cuenta anterior', async () => {
    let responderA
    mocks.profile.mockReturnValueOnce(new Promise((resolve) => { responderA = resolve }))
      .mockResolvedValueOnce({ data: { id: 'profesional-b', nombre: 'Enfermera B' }, error: null })
    abrir()
    await waitFor(() => expect(mocks.profile).toHaveBeenCalledOnce())
    act(() => mocks.listener('SIGNED_IN', sessionB))
    await screen.findByText('Enfermera B')
    await act(() => responderA({ data: { id: 'profesional-a', nombre: 'Médico A' }, error: null }))
    expect(screen.getByTestId('identidad').textContent).toBe('Enfermera B')
  })
  it('no restaura una sesión inicial vieja después de un evento de login nuevo', async () => {
    let responderInicial
    mocks.getSession.mockReturnValue(new Promise((resolve) => { responderInicial = resolve }))
    mocks.profile.mockResolvedValue({ data: { id: 'profesional-b', nombre: 'Enfermera B' }, error: null })
    abrir()
    act(() => mocks.listener('SIGNED_IN', sessionB))
    await screen.findByText('Enfermera B')
    await act(() => responderInicial({ data: { session: sessionA }, error: null }))
    expect(mocks.profile).toHaveBeenCalledOnce()
  })
  it('cierra únicamente la sesión local y limpia la identidad al salir', async () => {
    abrir()
    await screen.findByText('Médico A')
    fireEvent.click(screen.getByText('Salir'))
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    act(() => mocks.listener('SIGNED_OUT', null))
    expect(screen.getByTestId('identidad').textContent).toBe('Sin profesional')
  })
  it('renovar el token no reinicia los 25 minutos sin actividad', async () => {
    vi.useFakeTimers()
    await act(async () => abrir())
    act(() => vi.advanceTimersByTime(24 * 60 * 1000))
    act(() => mocks.listener('TOKEN_REFRESHED', { ...sessionA }))
    expect(mocks.signOut).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(60 * 1000))
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('habilita el acceso después de cambiar la contraseña y comprobar el estado del servidor', async () => {
    mocks.profile.mockResolvedValueOnce({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }, error: null })
      .mockResolvedValueOnce({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: false }, error: null })
    abrir()
    await screen.findByText('Contraseña pendiente')
    fireEvent.click(screen.getByText('Cambiar contraseña'))
    await screen.findByText('Contraseña lista')
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'Nueva contraseña de prueba' })
    expect(mocks.profile).toHaveBeenCalledTimes(2)
  })
  it('no completa el primer ingreso cuando Supabase rechaza la contraseña', async () => {
    mocks.profile.mockResolvedValue({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }, error: null })
    mocks.updateUser.mockResolvedValue({ error: { code: 'same_password' } })
    abrir()
    await screen.findByText('Contraseña pendiente')
    fireEvent.click(screen.getByText('Cambiar contraseña'))
    await screen.findByText('Elegí una contraseña distinta de la provisoria.')
    expect(screen.getByText('Contraseña pendiente')).toBeTruthy()
    expect(mocks.profile).toHaveBeenCalledOnce()
  })
  it('identifica la exigencia de contraseña actual sin habilitar todavía el acceso', async () => {
    mocks.profile.mockResolvedValue({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }, error: null })
    mocks.updateUser.mockResolvedValue({ error: { code: 'current_password_required' } })
    abrir()
    await screen.findByText('Contraseña pendiente')
    fireEvent.click(screen.getByText('Cambiar contraseña'))
    await screen.findByText('Ingresá la contraseña provisoria para confirmar el cambio.')
    expect(screen.getByText('Contraseña pendiente')).toBeTruthy()
  })
  it('no da acceso si el servidor sigue marcando el cambio pendiente después de updateUser', async () => {
    mocks.profile.mockResolvedValue({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }, error: null })
    abrir()
    await screen.findByText('Contraseña pendiente')
    fireEvent.click(screen.getByText('Cambiar contraseña'))
    await screen.findByText(/La contraseña se actualizó, pero no se pudo confirmar/)
    expect(screen.getByText('Contraseña pendiente')).toBeTruthy()
  })
  it('una respuesta de cambio tardía no reemplaza la identidad de otro usuario', async () => {
    let terminarCambio
    mocks.profile.mockResolvedValueOnce({ data: { id: 'prof-a', nombre: 'Médico A', debe_cambiar_password: true }, error: null })
      .mockResolvedValueOnce({ data: { id: 'prof-b', nombre: 'Médico B', debe_cambiar_password: false }, error: null })
    mocks.updateUser.mockReturnValue(new Promise((resolve) => { terminarCambio = resolve }))
    abrir()
    await screen.findByText('Contraseña pendiente')
    fireEvent.click(screen.getByText('Cambiar contraseña'))
    act(() => mocks.listener('SIGNED_IN', sessionB))
    await screen.findByText('Médico B')
    await act(() => terminarCambio({ error: null }))
    expect(screen.getByTestId('identidad').textContent).toBe('Médico B')
    expect(mocks.profile).toHaveBeenCalledTimes(2)
  })
})
