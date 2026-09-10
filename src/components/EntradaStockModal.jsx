import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  PRESENTACIONES,
  formatearPresentacion,
  identificarMedicamento,
  mensajeErrorMedicamento,
} from '@/lib/medicamentos'

const NUEVO = '__nuevo__'

const medicamentoNuevoInicial = {
  nombre: '',
  presentacion: '',
  presentacion_detalle: '',
  concentracion: '',
  stock_minimo: '',
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

// Unifica en un solo formulario lo que antes eran dos pasos separados ("+ Nuevo
// medicamento" y después "+ Registrar entrada", con un popup intermedio para saltar de
// uno a otro): acá se puede elegir un medicamento existente O cargar uno nuevo sin salir
// de este modal — es el caso de uso real más común (llega una caja física, hay que
// cargarla, y no siempre se sabe de memoria si ese medicamento ya está en el catálogo).
// "+ Nuevo medicamento" sigue existiendo aparte para gestión de catálogo pura (editar uno
// ya cargado, o precargar medicamentos antes de que llegue el stock) — esto no lo reemplaza.
export default function EntradaStockModal({ medicamentos, medicamentoIdInicial, onClose, onRegistrado }) {
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [medicamentoId, setMedicamentoId] = useState(medicamentoIdInicial || '')
  const [medicamentoNuevo, setMedicamentoNuevo] = useState(medicamentoNuevoInicial)
  const [numeroLote, setNumeroLote] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const esMedicamentoNuevo = medicamentoId === NUEVO

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

  function handleChangeNuevo(campo) {
    return (e) => setMedicamentoNuevo((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién registra la entrada.')
      return
    }
    if (!medicamentoId) {
      setError('Elegí un medicamento.')
      return
    }
    if (esMedicamentoNuevo && !medicamentoNuevo.nombre.trim()) {
      setError('Cargá el nombre del medicamento nuevo.')
      return
    }
    if (esMedicamentoNuevo && medicamentoNuevo.presentacion === 'Otra' && !medicamentoNuevo.presentacion_detalle.trim()) {
      setError('Tenés que especificar la presentación.')
      return
    }

    setLoading(true)

    let medicamentoIdFinal = medicamentoId

    if (esMedicamentoNuevo) {
      const esOtra = medicamentoNuevo.presentacion === 'Otra'

      const { data: nuevo, error: medicamentoError } = await supabase
        .from('medicamentos')
        .insert({
          nombre: medicamentoNuevo.nombre.trim(),
          presentacion: medicamentoNuevo.presentacion || null,
          presentacion_detalle: esOtra ? medicamentoNuevo.presentacion_detalle : null,
          concentracion: medicamentoNuevo.concentracion || null,
          stock_minimo: medicamentoNuevo.stock_minimo === '' ? null : Number(medicamentoNuevo.stock_minimo),
        })
        .select()
        .single()

      if (medicamentoError) {
        setLoading(false)
        setError(mensajeErrorMedicamento(medicamentoError))
        return
      }

      medicamentoIdFinal = nuevo.id
    }

    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .insert({
        medicamento_id: medicamentoIdFinal,
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
      usuario_id: profesionalId,
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
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Registrar entrada de stock</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">
                ¿Quién registra la entrada? <span className="text-text-primary">*</span>
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

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Medicamento <span className="text-text-primary">*</span>
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
                <option value={NUEVO}>+ Agregar medicamento nuevo</option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {identificarMedicamento(m)}
                    {formatearPresentacion(m) ? ` (${formatearPresentacion(m)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {esMedicamentoNuevo && (
              <div className="space-y-4 border border-border rounded-lg p-3 bg-background">
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">
                    Nombre <span className="text-text-primary">*</span>
                  </label>
                  <input
                    required
                    value={medicamentoNuevo.nombre}
                    onChange={handleChangeNuevo('nombre')}
                    className="input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Presentación</label>
                  <select
                    value={medicamentoNuevo.presentacion}
                    onChange={handleChangeNuevo('presentacion')}
                    className="input"
                  >
                    <option value="">Sin especificar</option>
                    {PRESENTACIONES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {medicamentoNuevo.presentacion === 'Otra' && (
                  <div className="space-y-1">
                    <label className="text-sm text-text-secondary">
                      Especificar presentación <span className="text-text-primary">*</span>
                    </label>
                    <input
                      required
                      value={medicamentoNuevo.presentacion_detalle}
                      onChange={handleChangeNuevo('presentacion_detalle')}
                      placeholder="Ej: Óvulos"
                      className="input"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Concentración</label>
                  <input
                    value={medicamentoNuevo.concentracion}
                    onChange={handleChangeNuevo('concentracion')}
                    placeholder="Ej: 500 mg"
                    className="input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={medicamentoNuevo.stock_minimo}
                    onChange={handleChangeNuevo('stock_minimo')}
                    placeholder="Opcional — para alertar cuando el stock caiga por debajo"
                    className="input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Número de lote</label>
              <input
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Cantidad que ingresa <span className="text-text-primary">*</span>
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

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

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
