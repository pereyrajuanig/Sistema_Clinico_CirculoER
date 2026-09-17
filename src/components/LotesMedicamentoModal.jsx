import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import LoteFormModal from '@/components/LoteFormModal'
import DarDeBajaLoteModal from '@/components/DarDeBajaLoteModal'
import { loteVencido } from '@/lib/stock'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

export default function LotesMedicamentoModal({ medicamentoId, medicamentoNombre, onClose, onCambio }) {
  const [lotes, setLotes] = useState([])
  const [loteIdsConSalidas, setLoteIdsConSalidas] = useState(new Set())
  const [entradaPorLote, setEntradaPorLote] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingLote, setEditingLote] = useState(null)
  const [loteParaBaja, setLoteParaBaja] = useState(null)

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

      // El movimiento de tipo 'entrada' que crea el lote no cuenta como "uso" — todo lote
      // lo tiene siempre. Lo que bloquea editar/borrar es que ya se haya sacado algo (salida).
      const { data: salidas, error: salidasError } =
        loteIds.length > 0
          ? await supabase
              .from('movimientos_stock')
              .select('lote_id')
              .eq('tipo', 'salida')
              .in('lote_id', loteIds)
          : { data: [], error: null }

      if (salidasError) {
        setLoading(false)
        setError(salidasError.message)
        return
      }

      // EntradaStockModal.jsx siempre crea el lote junto con su único movimiento de entrada
      // en el mismo submit — nunca hay más de uno por lote. Se necesita el id de esa fila
      // (no alcanza con stock_actual) para poder corregir la cantidad sin pisarla con un
      // UPDATE (ver LoteFormModal.jsx).
      const { data: entradas, error: entradasError } =
        loteIds.length > 0
          ? await supabase
              .from('movimientos_stock')
              .select('id, lote_id, cantidad')
              .eq('tipo', 'entrada')
              .in('lote_id', loteIds)
          : { data: [], error: null }

      setLoading(false)

      if (entradasError) {
        setError(entradasError.message)
        return
      }

      setLotes(stockLotes)
      setLoteIdsConSalidas(new Set(salidas.map((m) => m.lote_id)))
      setEntradaPorLote(new Map(entradas.map((m) => [m.lote_id, m])))
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
              stock_actual: loteActualizado.cantidad,
            }
          : l
      )
    )
    setEditingLote(null)
    onCambio()
  }

  function handleBajaRegistrada(cantidadDadaDeBaja) {
    setLotes((prev) =>
      prev.map((l) =>
        l.lote_id === loteParaBaja.lote_id
          ? { ...l, stock_actual: l.stock_actual - cantidadDadaDeBaja }
          : l
      )
    )
    setLoteParaBaja(null)
    onCambio()
  }

  async function handleEliminarLote(loteId) {
    if (
      !window.confirm(
        '¿Eliminar este lote? Se borra también su movimiento de entrada. Esta acción no se puede deshacer.'
      )
    ) {
      return
    }

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
          {error && <p className="text-base text-text-primary">{error}</p>}

          {loading ? (
            <p className="text-base text-text-secondary">Cargando...</p>
          ) : lotes.length === 0 ? (
            <p className="text-base text-text-secondary">Este medicamento todavía no tiene lotes cargados.</p>
          ) : (
            <ul className="space-y-2">
              {lotes.map((l) => {
                const tieneSalidas = loteIdsConSalidas.has(l.lote_id)
                const vencido = loteVencido(l.fecha_vencimiento)

                return (
                  <li
                    key={l.lote_id}
                    className="border border-border rounded-lg p-3 flex flex-wrap justify-between items-center gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-base text-text-primary">
                        {l.numero_lote || 'Sin número de lote'}
                      </p>
                      <p
                        className={
                          'text-sm ' + (vencido ? 'text-text-primary font-semibold' : 'text-text-secondary')
                        }
                      >
                        {vencido ? 'Venció' : 'Vence'} {formatFecha(l.fecha_vencimiento)} — stock actual:{' '}
                        {l.stock_actual}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {tieneSalidas ? (
                        <p className="text-sm text-text-secondary">Ya tiene salidas registradas</p>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setEditingLote(l)}
                            className="text-sm text-text-secondary hover:text-text-primary underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleEliminarLote(l.lote_id)}
                            className="text-sm text-text-primary underline"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                      {/* Independiente de Editar/Eliminar (que se bloquean con salidas
                          registradas) — dar de baja stock remanente por vencimiento/daño es
                          una acción distinta, disponible mientras quede stock sin importar el
                          historial del lote. */}
                      {l.stock_actual > 0 && (
                        <button
                          onClick={() => setLoteParaBaja(l)}
                          className="text-sm text-text-primary underline"
                        >
                          Dar de baja stock
                        </button>
                      )}
                    </div>
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
          entradaMovimiento={entradaPorLote.get(editingLote.lote_id) || null}
          onClose={() => setEditingLote(null)}
          onSaved={handleLoteGuardado}
        />
      )}

      {loteParaBaja && (
        <DarDeBajaLoteModal
          lote={loteParaBaja}
          medicamentoNombre={medicamentoNombre}
          onClose={() => setLoteParaBaja(null)}
          onRegistrado={handleBajaRegistrada}
        />
      )}
    </div>
  )
}
