import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'

export default function AntecedenteFormModal({ pacienteId, antecedente, onClose, onSaved }) {
  const esEdicion = Boolean(antecedente)
  const [tipo, setTipo] = useState(antecedente?.tipo || '')
  const [descripcion, setDescripcion] = useState(antecedente?.descripcion || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

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
            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Tipo <span className="text-alert">*</span>
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
                Descripción <span className="text-alert">*</span>
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

          {error && <p className="px-4 sm:px-6 text-base text-alert -mt-2 pb-2">{error}</p>}

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
