import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { loteVencido } from '@/lib/stock'

// Registra un movimiento tipo 'baja' — para sacar del stock unidades vencidas, dañadas o
// perdidas SIN fingir que se le administraron a un paciente real (eso es lo que hacía
// "Registrar salida" antes de esto, la única forma que existía de descontar stock). A
// diferencia de una salida, no pide paciente — pide motivo, que acá es obligatorio porque es
// la única explicación de qué pasó con esas unidades.
export default function DarDeBajaLoteModal({ lote, medicamentoNombre, onClose, onRegistrado }) {
  const { profesional } = useAuth()
  const profesionalId = profesional?.id
  const [cantidad, setCantidad] = useState(String(lote.stock_actual))
  const [motivo, setMotivo] = useState(loteVencido(lote.fecha_vencimiento) ? 'Vencido' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('No hay un profesional activo en la sesión. Volvé a ingresar.')
      return
    }
    if (!motivo.trim()) {
      setError('Contá el motivo de la baja (vencido, dañado, etc.).')
      return
    }
    const cantidadNum = Number(cantidad)
    if (!cantidadNum || cantidadNum <= 0) {
      setError('La cantidad tiene que ser mayor a cero.')
      return
    }
    if (cantidadNum > lote.stock_actual) {
      setError(`Este lote solo tiene ${lote.stock_actual} unidades disponibles.`)
      return
    }

    setLoading(true)

    const { error } = await supabase.from('movimientos_stock').insert({
      lote_id: lote.lote_id,
      usuario_id: profesionalId,
      tipo: 'baja',
      cantidad: cantidadNum,
      fecha: new Date().toISOString(),
      motivo: motivo.trim(),
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onRegistrado(cantidadNum)
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Dar de baja stock</h2>
            <p className="text-sm text-text-secondary">
              {medicamentoNombre} — lote {lote.numero_lote || '(sin número)'}
            </p>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-text-secondary">
              Para sacar del stock unidades vencidas, dañadas o perdidas — no es una entrega a
              ningún paciente, por eso no pide DNI. Quedan {lote.stock_actual} unidades
              disponibles en este lote.
            </p>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Cantidad <span className="text-text-primary">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                max={lote.stock_actual}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Motivo <span className="text-text-primary">*</span>
              </label>
              <input
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Vencido, Dañado, Roto"
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
              {loading ? 'Guardando...' : 'Dar de baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
