import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// `entradaMovimiento` ({ id, cantidad }) solo llega cuando el lote no tiene salidas (mismo
// gate que ya usa LotesMedicamentoModal.jsx para mostrar "Editar"/"Eliminar") — es la fila de
// movimientos_stock del alta original de este lote. Si no llega (por las dudas, defensivo),
// el campo Cantidad ni se muestra: no hay forma de corregirla sin saber qué movimiento tocar.
export default function LoteFormModal({ lote, entradaMovimiento, onClose, onSaved }) {
  const [numeroLote, setNumeroLote] = useState(lote.numero_lote || '')
  const [fechaVencimiento, setFechaVencimiento] = useState(lote.fecha_vencimiento)
  const [cantidad, setCantidad] = useState(
    entradaMovimiento ? String(entradaMovimiento.cantidad) : ''
  )
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Solo hace falta elegir quién corrige si la cantidad realmente cambió — si el usuario
  // solo vino a arreglar el número de lote o la fecha, no hay ninguna fricción de más.
  const cantidadCambio = entradaMovimiento && Number(cantidad) !== entradaMovimiento.cantidad

  useEffect(() => {
    if (!entradaMovimiento) return

    supabase
      .from('profesionales')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfesionales(data)
      })
  }, [entradaMovimiento])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (cantidadCambio && (!cantidad || Number(cantidad) <= 0)) {
      setError('La cantidad tiene que ser mayor a cero.')
      return
    }
    if (cantidadCambio && !profesionalId) {
      setError('Elegí quién corrige la cantidad antes de guardar.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('lotes')
      .update({ numero_lote: numeroLote || null, fecha_vencimiento: fechaVencimiento })
      .eq('id', lote.id)
      .select()
      .single()

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    // El lote sin salidas todavía no es un hecho contable real — mismo criterio que ya
    // permite borrarlo entero desde "Ver lotes" (ver CLAUDE.md, "lotes" en las reglas de
    // CRUD de Medicamentos y stock). Corregir la cantidad NUNCA pisa con un UPDATE la fila
    // de movimientos_stock existente (ese libro sigue siendo inmutable en todos los demás
    // casos) — borra el movimiento de entrada original y registra uno nuevo en su lugar,
    // atribuido a quien hizo la corrección.
    if (cantidadCambio) {
      const { error: deleteError } = await supabase
        .from('movimientos_stock')
        .delete()
        .eq('id', entradaMovimiento.id)

      if (deleteError) {
        setLoading(false)
        setError(deleteError.message)
        return
      }

      const { error: insertError } = await supabase.from('movimientos_stock').insert({
        lote_id: lote.id,
        usuario_id: profesionalId,
        tipo: 'entrada',
        cantidad: Number(cantidad),
        fecha: new Date().toISOString(),
        motivo: 'Corrección de cantidad cargada por error',
      })

      if (insertError) {
        setLoading(false)
        setError(insertError.message)
        return
      }
    }

    setLoading(false)
    onSaved({ ...data, cantidad: cantidadCambio ? Number(cantidad) : entradaMovimiento?.cantidad })
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
                Fecha de vencimiento <span className="text-text-primary">*</span>
              </label>
              <input
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="input"
              />
            </div>

            {entradaMovimiento && (
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="input"
                />
              </div>
            )}

            {cantidadCambio && (
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">
                  ¿Quién corrige la cantidad? <span className="text-text-primary">*</span>
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
