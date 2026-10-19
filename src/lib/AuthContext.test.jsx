// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), profile: vi.fn(), from: vi.fn(),
  signOut: vi.fn(), signIn: vi.fn(), listener: null, unsubscribe: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  from: mocks.from,
  auth: { getSession: mocks.getSession, signOut: mocks.signOut, signInWithPassword: mocks.signIn,
    onAuthStateChange: (callback) => { mocks.listener = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } } },
} }))
const sessionA = { user: { id: 'auth-a' } }
const sessionB = { user: { id: 'auth-b' } }
function Probe() {
  const { profesional, loading, errorAcceso, logout } = useAuth()
  return <>
    <p data-testid="identidad">{loading ? 'Cargando' : profesional?.nombre || 'Sin profesional'}</p>
    <p>{errorAcceso}</p>
    <button onClick={() => logout()}>Salir</button>
  </>
}
function abrir() { render(<AuthProvider><Probe /></AuthProvider>) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: sessionA }, error: null })
  mocks.profile.mockResolvedValue({ data: { id: 'profesional-historico-a', nombre: 'Médico A' }, error: null })
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }) })
  mocks.signOut.mockResolvedValue({ error: null })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('identidad profesional de la sesión', () => {
  it('resuelve el catálogo por auth_user_id sin asumir que ambos UUID son iguales', async () => {
    abrir()
    expect(screen.getByTestId('identidad').textContent).toBe('Cargando')
    await screen.findByText('Médico A')
    expect(mocks.from).toHaveBeenCalledWith('profesionales')
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
})
