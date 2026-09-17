import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { registrarAuditoria } from '@/lib/auditoria'

// Edición mínima, a pedido del cliente: solo Nombre y Dosis — mismo criterio reducido que
// el alta (el quick-add de ConsultaEntryForm.jsx, único lugar donde se cargan medicaciones
// nuevas desde que se sacó la sección "Medicación habitual" dedicada). No se reintroduce un
// selector de Estado ni fechas — si una medicación deja de tomarse, se usa "Eliminar" (baja
// lógica, ver HistoriaClinica.jsx) en vez de un estado "Suspendida" intermedio; decisión
// explícita del cliente para no volver a la complejidad que se había sacado.
export default function EditarMedicacionModal({ medicacion, onClose, onSaved }) {
  const [nombre, setNombre] = useState(medicacion.nombre)
  const [dosis, setDosis] = useState(medicacion.dosis || '')
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién edita antes de guardar.')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }

    setLoading(true)

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'medicacion',
      registroId: medicacion.id,
      accion: 'editar',
      usuarioId: profesionalId,
      valoresAnteriores: medicacion,
    })

    if (auditoriaError) {
      setLoading(false)
      setError(auditoriaError.message)
      return
    }

    // Solo nombre/dosis en el payload — estado/fecha_inicio/fecha_fin quedan sin tocar
    // (mismo criterio que el resto de los campos reducidos de esta app: la columna sigue
    // existiendo con lo que ya tenía, no se pisa por no estar en este formulario).
    const { data, error } = await supabase
      .from('medicacion')
      .update({ nombre: nombre.trim(), dosis: dosis || null })
      .eq('id', medicacion.id)
      .select()
      .single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved(data)
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Editar medicación</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">
                ¿Quién edita? <span className="text-text-primary">*</span>
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

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Nombre del medicamento <span className="text-text-primary">*</span>
              </label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Losartán"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Dosis</label>
              <input
                value={dosis}
                onChange={(e) => setDosis(e.target.value)}
                placeholder="Ej: 50mg cada 12hs"
                className="input"
              />
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
