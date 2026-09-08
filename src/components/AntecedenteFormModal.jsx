import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'
import { registrarAuditoria } from '@/lib/auditoria'

export default function AntecedenteFormModal({ pacienteId, antecedente, onClose, onSaved }) {
  const esEdicion = Boolean(antecedente)
  const [tipo, setTipo] = useState(antecedente?.tipo || '')
  const [descripcion, setDescripcion] = useState(antecedente?.descripcion || '')
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // El selector de "¿quién edita?" solo hace falta para la auditoría de una edición — dar
  // de alta un antecedente nuevo no se audita, así que no pedimos esto al crear
  useEffect(() => {
    if (!esEdicion) return

    supabase
      .from('profesionales')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfesionales(data)
      })
  }, [esEdicion])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (esEdicion && !profesionalId) {
      setError('Elegí quién edita antes de guardar.')
      return
    }

    setLoading(true)

    if (esEdicion) {
      const { error: auditoriaError } = await registrarAuditoria({
        tabla: 'antecedentes',
        registroId: antecedente.id,
        accion: 'editar',
        usuarioId: profesionalId,
        valoresAnteriores: antecedente,
      })

      if (auditoriaError) {
        setLoading(false)
        setError(auditoriaError.message)
        return
      }
    }

    const query = esEdicion
      ? supabase.from('antecedentes').update({ tipo, descripcion }).eq('id', antecedente.id)
      : supabase.from('antecedentes').insert({ paciente_id: pacienteId, tipo, descripcion })

    const { data, error } = await query.select().single()

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
              {esEdicion ? 'Editar antecedente' : 'Nuevo antecedente'}
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {esEdicion && (
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
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Tipo <span className="text-text-primary">*</span>
              </label>
              <select
                required
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  Elegir tipo...
                </option>
                {Object.entries(TIPOS_ANTECEDENTE).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Descripción <span className="text-text-primary">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar antecedente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
