import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoteFormModal({ lote, onClose, onSaved }) {
  const [numeroLote, setNumeroLote] = useState(lote.numero_lote || '')
  const [fechaVencimiento, setFechaVencimiento] = useState(lote.fecha_vencimiento)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase
      .from('lotes')
      .update({ numero_lote: numeroLote || null, fecha_vencimiento: fechaVencimiento })
      .eq('id', lote.id)
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
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Editar lote</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Número de lote</label>
              <input
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Fecha de vencimiento <span className="text-alert">*</span>
              </label>
              <input
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-alert -mt-2 pb-2">{error}</p>}

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
