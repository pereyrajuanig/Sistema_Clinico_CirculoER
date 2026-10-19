// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), login: vi.fn(), session: null, profesional: null }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ login: mocks.login, session: mocks.session,
  profesional: mocks.profesional, loading: false, errorAcceso: '' }) }))
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }))
const accesos = [{ id: 'prof-a', nombre: 'Médico A', email: 'medico-a@example.com' },
  { id: 'prof-b', nombre: 'Enfermera B', email: 'enfermera-b@example.com' }]
beforeEach(() => {
  vi.clearAllMocks(); mocks.session = null; mocks.profesional = null
  mocks.rpc.mockResolvedValue({ data: accesos, error: null })
  mocks.login.mockResolvedValue({ error: { message: 'Invalid credentials' } })
})
afterEach(cleanup)
function abrir() { render(<MemoryRouter><Login /></MemoryRouter>) }
describe('ingreso por profesional', () => {
  it('elige un nombre, pide solo contraseña y usa su cuenta de Auth', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Enfermera B' }))
    expect(screen.queryByLabelText('Email')).toBeNull()
    const password = screen.getByLabelText('Contraseña de Enfermera B')
    expect(password.type).toBe('password')
    fireEvent.change(password, { target: { value: 'clave-de-prueba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('enfermera-b@example.com', 'clave-de-prueba'))
    await screen.findByRole('alert')
    expect(password.value).toBe('')
  })
  it('borra la contraseña al seleccionar otra persona', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Médico A' }))
    fireEvent.change(screen.getByLabelText('Contraseña de Médico A'), { target: { value: 'clave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enfermera B' }))
    expect(screen.getByLabelText('Contraseña de Enfermera B').value).toBe('')
    expect(mocks.login).not.toHaveBeenCalled()
  })
  it('permite reintentar una carga de accesos fallida', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Error de red' } })
    abrir()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('Reintentar'))
    await screen.findByRole('button', { name: 'Médico A' })
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })
  it('no habilita la contraseña si no hay cuentas configuradas', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    abrir()
    await screen.findByText('No hay usuarios habilitados para ingresar. Contactá al administrador.')
    expect(screen.queryByRole('button', { name: 'Ingresar' })).toBeNull()
  })
})
