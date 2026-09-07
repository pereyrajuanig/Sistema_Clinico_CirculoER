import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { identificarMedicamento } from '@/lib/medicamentos'
import { limpiarDni, formatearDni } from '@/lib/dni'

function formatFechaHora(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
}

// Corrige un movimiento registrando uno nuevo que lo compensa, nunca editando ni borrando el
// original (es un libro contable). Una entrada se compensa con una salida y viceversa, siempre
// sobre el mismo lote — no tiene sentido "corregir" creando un lote nuevo.
export default function CorregirMovimientoModal({ movimiento, onClose, onRegistrado }) {
  const tipoCompensatorio = movimiento.tipo === 'entrada' ? 'salida' : 'entrada'
  const medicamentoNombre = identificarMedicamento(movimiento.lotes?.medicamentos)

  const [cantidad, setCantidad] = useState(String(movimiento.cantidad))
  const [motivo, setMotivo] = useState(
    `Corrección del movimiento de ${movimiento.tipo} del ${formatFechaHora(movimiento.fecha)}`
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // "¿Quién registra la corrección?" hace falta siempre (tanto si la compensación es
  // entrada como salida) — el login ahora es una cuenta compartida, no se puede inferir de
  // la sesión. Lo de DNI/paciente en cambio solo aplica cuando la compensación es una
  // salida, igual que cualquier salida (la base exige profesional y paciente, RF-24)
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [stockLote, setStockLote] = useState(null)
  const [dniBusqueda, setDniBusqueda] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const [dniError, setDniError] = useState('')

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

  useEffect(() => {
    if (tipoCompensatorio !== 'salida') return

    supabase
      .from('stock_por_lote')
      .select('stock_actual')
      .eq('lote_id', movimiento.lote_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setStockLote(data?.stock_actual ?? 0)
      })
  }, [tipoCompensatorio, movimiento.lote_id])

  useEffect(() => {
    if (tipoCompensatorio !== 'salida') return

    const dni = limpiarDni(dniBusqueda)
    setPacienteEncontrado(null)
    setDniError('')

    if (dni.length < 7) return

    setBuscandoPaciente(true)

    const timeoutId = setTimeout(() => {
      supabase
        .from('pacientes')
        .select('id, nombre, apellido, dni')
        .eq('dni', dni)
        .maybeSingle()
        .then(({ data, error }) => {
          setBuscandoPaciente(false)
          if (error) {
            setDniError(error.message)
            return
          }
          if (!data) {
            setDniError('No se encontró ningún paciente con ese DNI.')
            return
          }
          setPacienteEncontrado(data)
        })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [tipoCompensatorio, dniBusqueda])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cantidadNum = Number(cantidad)
    if (!cantidadNum || cantidadNum <= 0) {
      setError('La cantidad tiene que ser mayor a cero.')
      return
    }

    if (!profesionalId) {
      setError('Elegí quién registra la corrección.')
      return
    }

    if (tipoCompensatorio === 'salida') {
      if (!pacienteEncontrado) {
        setError('Buscá y confirmá el paciente por DNI antes de guardar.')
        return
      }
      if (stockLote != null && cantidadNum > stockLote) {
        setError(`Ese lote solo tiene ${stockLote} unidades disponibles.`)
        return
      }
    }

    setLoading(true)

    const payload =
      tipoCompensatorio === 'entrada'
        ? {
            lote_id: movimiento.lote_id,
            usuario_id: profesionalId,
            tipo: 'entrada',
            cantidad: cantidadNum,
            fecha: new Date().toISOString(),
            motivo,
          }
        : {
            lote_id: movimiento.lote_id,
            usuario_id: profesionalId,
            paciente_id: pacienteEncontrado.id,
            tipo: 'salida',
            cantidad: cantidadNum,
            fecha: new Date().toISOString(),
            motivo,
          }

    const { error } = await supabase.from('movimientos_stock').insert(payload)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onRegistrado()
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Corregir movimiento</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="bg-background border border-border rounded-lg p-3 text-sm text-text-secondary space-y-1">
              <p>
                Vas a corregir: <span className="text-text-primary font-medium">
                  {movimiento.tipo === 'entrada' ? 'Entrada' : 'Salida'} de {movimiento.cantidad}{' '}
                  {medicamentoNombre}
                </span>{' '}
                — lote {movimiento.lotes?.numero_lote || 'sin número'} — {formatFechaHora(movimiento.fecha)}
              </p>
              <p>
                Se va a registrar una <span className="text-text-primary font-medium">
                  {tipoCompensatorio === 'entrada' ? 'entrada' : 'salida'}
                </span>{' '}
                compensatoria sobre el mismo lote — el movimiento original queda como está, nunca
                se edita ni se borra.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">
                ¿Quién registra la corrección? <span className="text-alert">*</span>
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

            {tipoCompensatorio === 'salida' && (
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  DNI del paciente <span className="text-alert">*</span>
                </label>
                <input
                  required
                  value={dniBusqueda}
                  onChange={(e) => setDniBusqueda(e.target.value)}
                  placeholder="Ej: 12345678"
                  className="input"
                />
                {buscandoPaciente && (
                  <p className="text-sm text-text-secondary">Buscando paciente...</p>
                )}
                {!buscandoPaciente && dniError && <p className="text-sm text-text-primary">{dniError}</p>}
                {!buscandoPaciente && pacienteEncontrado && (
                  <p className="text-sm text-text-secondary">
                    Paciente: <span className="text-text-primary font-medium">
                      {pacienteEncontrado.apellido}, {pacienteEncontrado.nombre}
                    </span>{' '}
                    (DNI {formatearDni(pacienteEncontrado.dni)})
                  </p>
                )}
                {stockLote != null && (
                  <p className="text-sm text-text-secondary">
                    Ese lote tiene {stockLote} unidades disponibles.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Cantidad <span className="text-alert">*</span>
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

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Motivo</label>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" />
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar corrección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
