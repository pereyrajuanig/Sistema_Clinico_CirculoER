import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

// Conserva la confirmación de bajas; la atribución ahora proviene de la sesión individual.
export default function ConfirmarConProfesionalModal({
  titulo,
  mensaje,
  textoConfirmar,
  onCancelar,
  onConfirmar,
}) {
  const { profesional } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    if (!profesional?.id) {
      setError('No hay un profesional activo en la sesión. Volvé a ingresar.')
      return
    }

    setLoading(true)
    try {
      await onConfirmar(profesional.id)
    } catch {
      setError('No se pudo completar la acción. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{titulo}</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-base text-text-primary">{mensaje}</p>

          <p className="text-sm text-text-secondary">Responsable: {profesional?.nombre}</p>

          {error && <p className="text-base text-text-primary">{error}</p>}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
          <button type="button" onClick={onCancelar} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={loading} className="btn-primary">
            {loading ? 'Guardando...' : textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
