import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function EntradaStockModal({ medicamentos, onClose, onRegistrado }) {
  const { session } = useAuth()
  const [medicamentoId, setMedicamentoId] = useState('')
  const [numeroLote, setNumeroLote] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!medicamentoId) {
      setError('Elegí un medicamento.')
      return
    }

    setLoading(true)

    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .insert({
        medicamento_id: medicamentoId,
        numero_lote: numeroLote || null,
        fecha_vencimiento: fechaVencimiento,
        fecha_ingreso: hoyISO(),
      })
      .select()
      .single()

    if (loteError) {
      setLoading(false)
      setError(loteError.message)
      return
    }

    const { error: movimientoError } = await supabase.from('movimientos_stock').insert({
      lote_id: lote.id,
      usuario_id: session.user.id,
      tipo: 'entrada',
      cantidad: Number(cantidad),
      fecha: new Date().toISOString(),
    })

    setLoading(false)

    if (movimientoError) {
      setError(movimientoError.message)
      return
    }

    onRegistrado()
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Registrar entrada de stock</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Medicamento <span className="text-alert">*</span>
              </label>
              <select
                required
                value={medicamentoId}
                onChange={(e) => setMedicamentoId(e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  Elegir medicamento...
                </option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.presentacion ? ` (${m.presentacion})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Número de lote</label>
              <input
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Cantidad que ingresa <span className="text-alert">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-alert -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
