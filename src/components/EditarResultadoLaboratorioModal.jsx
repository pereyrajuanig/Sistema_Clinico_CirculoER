import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { registrarAuditoria } from '@/lib/auditoria'

function hoyISO(value) {
  return value ? value.slice(0, 10) : ''
}

// A diferencia de LaboratorioFormModal (que arma el resultado combinando varios campos —
// ver combinarCampos/combinarSimple en src/lib/laboratorio.js), acá se edita directo el
// texto ya combinado que quedó guardado. No tiene sentido reconstruir el formulario
// multi-campo original: una vez guardada, la fila es (tipo_examen, resultado, fecha) sin
// importar si salió de un campo simple, de un examen con varios campos, o de una fila del
// atajo "Perfil lipídico" — todas se editan igual.
export default function EditarResultadoLaboratorioModal({ resultado, onClose, onSaved }) {
  const [fecha, setFecha] = useState(hoyISO(resultado.fecha))
  const [resultadoTexto, setResultadoTexto] = useState(resultado.resultado)
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
    if (!resultadoTexto.trim()) {
      setError('El resultado no puede quedar vacío.')
      return
    }

    setLoading(true)

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'resultados_laboratorio',
      registroId: resultado.id,
      accion: 'editar',
      usuarioId: profesionalId,
      valoresAnteriores: resultado,
    })

    if (auditoriaError) {
      setLoading(false)
      setError(auditoriaError.message)
      return
    }

    const { data, error } = await supabase
      .from('resultados_laboratorio')
      .update({ fecha, resultado: resultadoTexto.trim() })
      .eq('id', resultado.id)
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
            <h2 className="text-lg font-semibold text-text-primary">
              Editar resultado — {resultado.tipo_examen}
            </h2>
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
                Fecha <span className="text-text-primary">*</span>
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Resultado <span className="text-text-primary">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={resultadoTexto}
                onChange={(e) => setResultadoTexto(e.target.value)}
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
