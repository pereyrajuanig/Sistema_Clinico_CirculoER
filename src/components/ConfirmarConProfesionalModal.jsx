import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Desde que el login pasó a ser una cuenta institucional compartida (ya no hay 1 login por
// profesional), cualquier acción que necesite quedar atribuida a una persona puntual tiene
// que preguntarlo explícitamente acá — nunca se puede inferir de la sesión activa.
export default function ConfirmarConProfesionalModal({
  titulo,
  mensaje,
  textoConfirmar,
  onCancelar,
  onConfirmar,
}) {
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('profesionales')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfesionales(data)
      })
  }, [])

  async function confirmar() {
    if (!profesionalId) {
      setError('Elegí quién realiza esta acción.')
      return
    }

    setLoading(true)
    await onConfirmar(profesionalId)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{titulo}</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-base text-text-primary">{mensaje}</p>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">
              ¿Quién realiza esta acción? <span className="text-alert">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {profesionales.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfesionalId(p.id)}
                  className={
                    'rounded-lg px-4 py-2 text-base font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ' +
                    (profesionalId === p.id
                      ? 'bg-accent-marino text-white border-accent-marino shadow-sm'
                      : 'bg-surface text-text-primary border-border hover:bg-background')
                  }
                  style={{ minHeight: '44px' }}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>

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
