import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'

export default function AntecedenteFormModal({ pacienteId, onClose, onCreated }) {
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase
      .from('antecedentes')
      .insert({ paciente_id: pacienteId, tipo, descripcion })
      .select()
      .single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onCreated(data)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Nuevo antecedente</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-600">
                Tipo <span className="text-red-500">*</span>
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
              <label className="text-sm text-slate-600">
                Descripción <span className="text-red-500">*</span>
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

          {error && <p className="px-6 text-sm text-red-600 -mt-2 pb-2">{error}</p>}

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar antecedente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
