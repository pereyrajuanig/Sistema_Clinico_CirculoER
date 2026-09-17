import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { limpiarDni, formatearDni } from '@/lib/dni'
import { capitalizarPalabras } from '@/lib/pacientes'
import { formatearPresentacion, identificarMedicamento } from '@/lib/medicamentos'
import { validarCantidadSalida } from '@/lib/stock'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

function estaProximoAVencer(fechaVencimiento) {
  const limite = new Date()
  limite.setDate(limite.getDate() + 30)
  return fechaVencimiento <= limite.toISOString().slice(0, 10)
}

export default function SalidaStockModal({ medicamentos, onClose, onRegistrado }) {
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [medicamentoId, setMedicamentoId] = useState('')
  const [lotesDisponibles, setLotesDisponibles] = useState([])
  const [loteId, setLoteId] = useState('')
  const [buscandoLotes, setBuscandoLotes] = useState(false)
  const [dniBusqueda, setDniBusqueda] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const [dniError, setDniError] = useState('')
  const [pacienteNoEncontrado, setPacienteNoEncontrado] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [apellidoNuevo, setApellidoNuevo] = useState('')
  const [consultas, setConsultas] = useState([])
  const [consultaId, setConsultaId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const medicamentoSeleccionado = medicamentos.find((m) => m.id === medicamentoId)
  const loteSeleccionado = lotesDisponibles.find((l) => l.lote_id === loteId) || null

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

  // Trae TODOS los lotes con stock disponible, no solo el que corresponde por FEFO — pedido
  // explícito del cliente: en la práctica, quien administra saca del lote que tiene físicamente
  // a mano, no siempre el que vence antes, y antes no había forma de reflejar eso en el
  // sistema (se descontaba siempre del lote sugerido, sin poder elegir otro). Se preselecciona
  // el primero (el de FEFO) como default razonable, pero queda editable.
  useEffect(() => {
    if (!medicamentoId) {
      setLotesDisponibles([])
      setLoteId('')
      return
    }

    setBuscandoLotes(true)
    setLotesDisponibles([])
    setLoteId('')

    supabase
      .from('stock_por_lote')
      .select('*')
      .eq('medicamento_id', medicamentoId)
      .gt('stock_actual', 0)
      .order('fecha_vencimiento', { ascending: true })
      .then(({ data, error }) => {
        setBuscandoLotes(false)
        if (error) {
          setError(error.message)
          return
        }
        setLotesDisponibles(data)
        if (data.length > 0) setLoteId(data[0].lote_id)
      })
  }, [medicamentoId])

  // Busca el paciente por DNI en vez de cargar el listado completo — no escala tener
  // miles de pacientes en un <select>
  useEffect(() => {
    const dni = limpiarDni(dniBusqueda)
    setPacienteEncontrado(null)
    setDniError('')
    setPacienteNoEncontrado(false)
    // Si cambia el DNI, el nombre/apellido tipeados para un paciente nuevo quedan
    // obsoletos — mejor limpiarlos que arriesgar registrar a alguien con el DNI
    // equivocado
    setNombreNuevo('')
    setApellidoNuevo('')

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
            setPacienteNoEncontrado(true)
            return
          }
          setPacienteEncontrado(data)
        })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [dniBusqueda])

  useEffect(() => {
    if (!pacienteEncontrado) {
      setConsultas([])
      setConsultaId('')
      return
    }

    supabase
      .from('consultas')
      .select('id, fecha, motivo')
      .eq('paciente_id', pacienteEncontrado.id)
      .is('eliminado_en', null)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setConsultas(data)
      })
  }, [pacienteEncontrado])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién administra antes de guardar.')
      return
    }
    if (!pacienteEncontrado && !pacienteNoEncontrado) {
      setError('Buscá al paciente por DNI antes de guardar.')
      return
    }
    if (pacienteNoEncontrado && (!nombreNuevo.trim() || !apellidoNuevo.trim())) {
      setError('No se encontró el paciente por DNI — cargá nombre y apellido para registrarlo.')
      return
    }
    const errorCantidad = validarCantidadSalida(loteSeleccionado, cantidad)
    if (errorCantidad) {
      setError(errorCantidad)
      return
    }

    setLoading(true)

    let pacienteId = pacienteEncontrado?.id

    // No estaba registrado (no se hace consultas, solo retira medicación) — se lo da de
    // alta como paciente con los 3 campos mínimos obligatorios (Nombre, Apellido, DNI),
    // igual que el alta manual desde Pacientes.jsx, para poder cumplir el constraint de
    // la base que exige paciente_id en toda salida
    if (pacienteNoEncontrado) {
      const { data: nuevoPaciente, error: pacienteError } = await supabase
        .from('pacientes')
        .insert({
          nombre: capitalizarPalabras(nombreNuevo.trim()),
          apellido: capitalizarPalabras(apellidoNuevo.trim()),
          dni: limpiarDni(dniBusqueda),
        })
        .select('id')
        .single()

      if (pacienteError) {
        setLoading(false)
        setError(pacienteError.message)
        return
      }

      pacienteId = nuevoPaciente.id
    }

    const { error } = await supabase.from('movimientos_stock').insert({
      lote_id: loteSeleccionado.lote_id,
      usuario_id: profesionalId,
      paciente_id: pacienteId,
      consulta_id: consultaId || null,
      tipo: 'salida',
      cantidad: Number(cantidad),
      fecha: new Date().toISOString(),
      motivo: motivo || null,
    })

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
            <h2 className="text-lg font-semibold text-text-primary">Registrar salida (administración)</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">
                ¿Quién administra? <span className="text-text-primary">*</span>
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
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {identificarMedicamento(m)}
                    {formatearPresentacion(m) ? ` (${formatearPresentacion(m)})` : ''}
                  </option>
                ))}
              </select>
              {medicamentoSeleccionado && (
                <p className="text-sm text-text-secondary">
                  {[
                    formatearPresentacion(medicamentoSeleccionado),
                    medicamentoSeleccionado.concentracion,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin presentación ni concentración cargadas.'}
                </p>
              )}
              {medicamentoId && buscandoLotes && (
                <p className="text-sm text-text-secondary">Buscando lotes disponibles...</p>
              )}
              {medicamentoId && !buscandoLotes && lotesDisponibles.length === 0 && (
                <p className="text-sm text-text-primary font-semibold">
                  No hay stock disponible en ningún lote de este medicamento.
                </p>
              )}
            </div>

            {medicamentoId && !buscandoLotes && lotesDisponibles.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Lote <span className="text-text-primary">*</span>
                </label>
                <select
                  required
                  value={loteId}
                  onChange={(e) => setLoteId(e.target.value)}
                  className="input"
                >
                  {lotesDisponibles.map((l) => (
                    <option key={l.lote_id} value={l.lote_id}>
                      Lote {l.numero_lote || '(sin número)'} — vence {formatFecha(l.fecha_vencimiento)} —{' '}
                      {l.stock_actual} disponibles
                    </option>
                  ))}
                </select>
                {/* Sugerencia por FEFO: el lote preseleccionado es el que vence antes (primero
                    de la lista), pero queda editable a propósito — en la práctica quien
                    administra saca del lote que tiene físicamente a mano, no siempre el que
                    corresponde por vencimiento, y antes no había forma de reflejar eso acá. */}
                {loteSeleccionado && estaProximoAVencer(loteSeleccionado.fecha_vencimiento) && (
                  <p className="text-sm text-text-primary font-semibold">
                    Este lote está próximo a vencer.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                DNI del paciente <span className="text-text-primary">*</span>
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
            </div>

            {!buscandoPaciente && pacienteNoEncontrado && (
              <div className="space-y-3 border border-border rounded-lg p-3 bg-background">
                <p className="text-sm text-text-primary font-semibold">
                  No se encontró ningún paciente con ese DNI. Pasa con pacientes que solo
                  retiran medicación y no se registraron antes — cargá nombre y apellido
                  para darlo de alta.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-text-secondary">
                      Nombre <span className="text-text-primary">*</span>
                    </label>
                    <input
                      required
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-text-secondary">
                      Apellido <span className="text-text-primary">*</span>
                    </label>
                    <input
                      required
                      value={apellidoNuevo}
                      onChange={(e) => setApellidoNuevo(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {pacienteEncontrado && consultas.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">Consulta relacionada</label>
                <select
                  value={consultaId}
                  onChange={(e) => setConsultaId(e.target.value)}
                  className="input"
                >
                  <option value="">Sin consulta asociada</option>
                  {consultas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatFecha(c.fecha.slice(0, 10))}
                      {c.motivo ? ` — ${c.motivo}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Cantidad <span className="text-text-primary">*</span>
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
              <label className="text-sm text-text-secondary">Observación</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading || buscandoLotes} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar salida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
