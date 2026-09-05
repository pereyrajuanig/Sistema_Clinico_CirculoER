import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import LoteFormModal from '@/components/LoteFormModal'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

export default function LotesMedicamentoModal({ medicamentoId, medicamentoNombre, onClose, onCambio }) {
  const [lotes, setLotes] = useState([])
  const [loteIdsConMovimientos, setLoteIdsConMovimientos] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLote, setEditingLote] = useState(null)

  useEffect(() => {
    async function fetchLotes() {
      setLoading(true)
      setError('')

      const { data: stockLotes, error: stockError } = await supabase
        .from('stock_por_lote')
        .select('*')
        .eq('medicamento_id', medicamentoId)
        .order('fecha_vencimiento', { ascending: true })

      if (stockError) {
        setLoading(false)
        setError(stockError.message)
        return
      }

      const loteIds = stockLotes.map((l) => l.lote_id)

      const { data: movimientos, error: movimientosError } =
        loteIds.length > 0
          ? await supabase.from('movimientos_stock').select('lote_id').in('lote_id', loteIds)
          : { data: [], error: null }

      setLoading(false)

      if (movimientosError) {
        setError(movimientosError.message)
        return
      }

      setLotes(stockLotes)
      setLoteIdsConMovimientos(new Set(movimientos.map((m) => m.lote_id)))
    }

    fetchLotes()
  }, [medicamentoId])

  function handleLoteGuardado(loteActualizado) {
    setLotes((prev) =>
      prev.map((l) =>
        l.lote_id === loteActualizado.id
          ? {
              ...l,
              numero_lote: loteActualizado.numero_lote,
              fecha_vencimiento: loteActualizado.fecha_vencimiento,
            }
          : l
      )
    )
    setEditingLote(null)
    onCambio()
  }

  async function handleEliminarLote(loteId) {
    if (!window.confirm('¿Eliminar este lote? Esta acción no se puede deshacer.')) return

    const { error } = await supabase.from('lotes').delete().eq('id', loteId)

    if (error) {
      setError(error.message)
      return
    }

    setLotes((prev) => prev.filter((l) => l.lote_id !== loteId))
    onCambio()
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Lotes de {medicamentoNombre}</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {error && <p className="text-base text-alert">{error}</p>}

          {loading ? (
            <p className="text-base text-text-secondary">Cargando...</p>
          ) : lotes.length === 0 ? (
            <p className="text-base text-text-secondary">Este medicamento todavía no tiene lotes cargados.</p>
          ) : (
            <ul className="space-y-2">
              {lotes.map((l) => {
                const tieneMovimientos = loteIdsConMovimientos.has(l.lote_id)

                return (
                  <li
                    key={l.lote_id}
                    className="border border-border rounded-lg p-3 flex justify-between items-center gap-3"
                  >
                    <div>
                      <p className="text-base text-text-primary">
                        {l.numero_lote || 'Sin número de lote'}
                      </p>
                      <p className="text-sm text-text-secondary">
                        Vence {formatFecha(l.fecha_vencimiento)} — stock actual: {l.stock_actual}
                      </p>
                    </div>
                    {tieneMovimientos ? (
                      <p className="text-sm text-text-secondary shrink-0">
                        Ya tiene movimientos
                      </p>
                    ) : (
                      <div className="flex gap-3 shrink-0">
                        <button
                          onClick={() => setEditingLote(l)}
                          className="text-sm text-text-secondary hover:text-text-primary underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminarLote(l.lote_id)}
                          className="text-sm text-alert hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cerrar
          </button>
        </div>
      </div>

      {editingLote && (
        <LoteFormModal
          lote={{
            id: editingLote.lote_id,
            numero_lote: editingLote.numero_lote,
            fecha_vencimiento: editingLote.fecha_vencimiento,
          }}
          onClose={() => setEditingLote(null)}
          onSaved={handleLoteGuardado}
        />
      )}
    </div>
  )
}
