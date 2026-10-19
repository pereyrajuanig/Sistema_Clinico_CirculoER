// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AntecedenteEntryForm from './AntecedenteEntryForm'
import PatologiaEntryForm from './PatologiaEntryForm'
import ConfirmarConProfesionalModal from './ConfirmarConProfesionalModal'
const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), update: vi.fn(), auditoria: vi.fn() }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: mocks.from } }))
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: mocks.auditoria }))
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ profesional: { id: 'editor-actual', nombre: 'Profesional actual' } }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auditoria.mockResolvedValue({ error: null })
  const result = { select: () => ({ single: async () => ({ data: { id: 'registro' }, error: null }) }) }
  mocks.insert.mockReturnValue(result)
  mocks.update.mockReturnValue({ eq: () => result })
  mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update })
})
afterEach(cleanup)
describe('atribución automática de formularios', () => {
  it('una confirmación de baja utiliza al profesional de la sesión sin pedir elección', async () => {
    const confirmar = vi.fn().mockResolvedValue(undefined)
    render(<ConfirmarConProfesionalModal titulo="Eliminar antecedente" mensaje="Confirmar baja" onCancelar={vi.fn()} onConfirmar={confirmar} />)
    expect(screen.queryByText('¿Quién realiza esta acción?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith('editor-actual'))
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('editar un antecedente no cambia a quien lo cargó originalmente', async () => {
    render(<AntecedenteEntryForm pacienteId="paciente" antecedente={{ id: 'original', usuario_id: 'autor-inactivo', tipo: 'alergia', descripcion: 'Histórico' }} onSaved={vi.fn()} onClose={vi.fn()} />)
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar cambios' }).closest('form'))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('usuario_id')
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'editor-actual' }))
  })
  it('editar una patología conserva al autor original y audita al editor actual', async () => {
    render(<PatologiaEntryForm pacienteId="paciente" patologia={{ id: 'original', usuario_id: 'autor-inactivo', nombre: 'Patología histórica', estado: 'Activa' }} onSaved={vi.fn()} onClose={vi.fn()} />)
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar cambios' }).closest('form'))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('usuario_id')
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'editor-actual' }))
  })
})
