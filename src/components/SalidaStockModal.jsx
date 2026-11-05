import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { limpiarDni, formatearDni } from '@/lib/dni'
import { capitalizarPalabras } from '@/lib/pacientes'
import { formatearPresentacion } from '@/lib/medicamentos'
import { distribuirSalida, validarDistribucionSalida, hoyLocalISO, loteProximoAVencer } from '@/lib/stock'
import SelectorMedicamento from '@/components/SelectorMedicamento'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

export default function SalidaStockModal({ medicamentos, onClose, onRegistrado }) {
  const { profesional } = useAuth()
  const profesionalId = profesional?.id
  const [medicamentoId, setMedicamentoId] = useState('')
  const [lotesDisponibles, setLotesDisponibles] = useState([])
  const [ajustes, setAjustes] = useState(null)
  const [buscandoLotes, setBuscandoLotes] = useState(false)
  const [lotesError, setLotesError] = useState('')
  const [recargaLotes, setRecargaLotes] = useState(0)
  const [dniBusqueda, setDniBusqueda] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const [dniError, setDniError] = useState('')
  const [dniVerificado, setDniVerificado] = useState('')
  const [pacienteNoEncontrado, setPacienteNoEncontrado] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [apellidoNuevo, setApellidoNuevo] = useState('')
  const [consultas, setConsultas] = useState([])
  const [consultaId, setConsultaId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const enviando = useRef(false)

  const medicamentoSeleccionado = medicamentos.find((m) => m.id === medicamentoId)
  const distribucion = ajustes ?? distribuirSalida(lotesDisponibles, cantidad)
  const totalAsignado = Object.values(distribucion).reduce((suma, valor) => suma + (Number(valor) || 0), 0)
  const errorDistribucion = validarDistribucionSalida(lotesDisponibles, cantidad, distribucion)

  // El reparto automático y los ajustes usan solamente lotes vigentes con stock.
  // Ignorar respuestas viejas evita mezclar lotes de dos medicamentos distintos.
  useEffect(() => {
    let vigente = true
    setLotesError('')
    setLotesDisponibles([])
    setAjustes(null)
    if (!medicamentoId) {
      setBuscandoLotes(false)
      return
    }

    setBuscandoLotes(true)

    supabase
      .from('stock_por_lote')
      .select('*')
      .eq('medicamento_id', medicamentoId)
      .gt('stock_actual', 0)
      .gte('fecha_vencimiento', hoyLocalISO())
      .order('fecha_vencimiento', { ascending: true })
      .then(({ data, error }) => {
        if (!vigente) return
        setBuscandoLotes(false)
        if (error) {
          setLotesError('No se pudieron cargar los lotes. Revisá la conexión y volvé a intentar.')
          return
        }
        setLotesDisponibles(data)
      })
      .catch(() => {
        if (!vigente) return
        setBuscandoLotes(false)
        setLotesError('No se pudieron cargar los lotes. Revisá la conexión y volvé a intentar.')
      })
    return () => { vigente = false }
  }, [medicamentoId, recargaLotes])

  // Busca el paciente por DNI en vez de cargar el listado completo — no escala tener
  // miles de pacientes en un <select>
  useEffect(() => {
    const dni = limpiarDni(dniBusqueda)
    setPacienteEncontrado(null)
    setDniError('')
    setDniVerificado('')
    setPacienteNoEncontrado(false)
    setBuscandoPaciente(dni.length >= 7)
    // Si cambia el DNI, el nombre/apellido tipeados para un paciente nuevo quedan
    // obsoletos — mejor limpiarlos que arriesgar registrar a alguien con el DNI
    // equivocado
    setNombreNuevo('')
    setApellidoNuevo('')

    if (dni.length < 7) return

    let vigente = true

    const timeoutId = setTimeout(() => {
      supabase
        .from('pacientes')
        .select('id, nombre, apellido, dni')
        .eq('dni', dni)
        .maybeSingle()
        .then(({ data, error }) => {
          // Cancelar el debounce no cancela una petición que ya salió. Una respuesta
          // de otro DNI no debe habilitar el alta ni reemplazar al paciente actual.
          if (!vigente) return
          setBuscandoPaciente(false)
          if (error) {
            setDniError(error.message)
            return
          }
          setDniVerificado(dni)
          setPacienteEncontrado(data)
          setPacienteNoEncontrado(!data)
        })
        .catch(() => {
          if (!vigente) return
          setBuscandoPaciente(false)
          setDniError('No se pudo buscar al paciente. Revisá la conexión e intentá nuevamente.')
        })
    }, 300)

    return () => { vigente = false; clearTimeout(timeoutId) }
  }, [dniBusqueda])

  useEffect(() => {
    setConsultas([])
    setConsultaId('')
    if (!pacienteEncontrado) return
    let vigente = true

    supabase
      .from('consultas')
      .select('id, fecha, motivo')
      .eq('paciente_id', pacienteEncontrado.id)
      .is('eliminado_en', null)
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) setError(error.message)
        else setConsultas(data)
      })
      .catch(() => {
        if (vigente) setError('No se pudieron cargar las consultas de este paciente.')
      })
    return () => { vigente = false }
  }, [pacienteEncontrado])

  async function handleSubmit(e) {
    e.preventDefault()
    if (enviando.current) return
    setError('')

    if (!profesionalId) {
      setError('No hay un profesional activo en la sesión. Volvé a ingresar.')
      return
    }
    const dni = limpiarDni(dniBusqueda)
    if (buscandoPaciente || dniError || dniVerificado !== dni || (!pacienteEncontrado && !pacienteNoEncontrado)) {
      setError('Buscá al paciente por DNI antes de guardar.')
      return
    }
    if (!pacienteEncontrado && pacienteNoEncontrado && (!nombreNuevo.trim() || !apellidoNuevo.trim())) {
      setError('No se encontró el paciente por DNI — cargá nombre y apellido para registrarlo.')
      return
    }
    if (buscandoLotes || lotesError || !medicamentoId) {
      setError('Elegí un medicamento y esperá a que se carguen sus lotes.')
      return
    }
    if (errorDistribucion) {
      setError(errorDistribucion)
      return
    }

    enviando.current = true
    setLoading(true)

    try {
      let pacienteId = pacienteEncontrado?.id

      // El alta rápida conserva los tres campos mínimos y el paciente obligatorio
      // de toda salida, igual que el alta manual desde Pacientes.jsx.
      if (!pacienteId && pacienteNoEncontrado) {
        const { data: nuevoPaciente, error: pacienteError } = await supabase
          .from('pacientes')
          .insert({
            nombre: capitalizarPalabras(nombreNuevo.trim()),
            apellido: capitalizarPalabras(apellidoNuevo.trim()),
            dni,
          })
          .select('id, nombre, apellido, dni')
          .single()

        if (pacienteError) {
          if (pacienteError.code === '23505') {
            // Otra computadora pudo darlo de alta entre la búsqueda y el guardado.
            // Mostrar el registro real para confirmarlo, sin sobreescribir sus datos.
            const { data: existente, error: errorBusqueda } = await supabase.from('pacientes')
              .select('id, nombre, apellido, dni').eq('dni', dni).maybeSingle()
            if (!errorBusqueda && existente) {
              setPacienteEncontrado(existente)
              setPacienteNoEncontrado(false)
              setError('Este DNI ya está registrado. Verificá el paciente encontrado y volvé a registrar la salida.')
            } else {
              setPacienteNoEncontrado(false)
              setDniVerificado('')
              setError('Este DNI ya está registrado, pero no se pudo recuperar el paciente. Volvé a buscarlo por DNI.')
            }
            return
          }
          setError(pacienteError.message)
          return
        }

        pacienteId = nuevoPaciente.id
        // El alta ya persistió aunque luego falle el movimiento. Un reintento debe
        // utilizar este paciente, nunca volver a insertarlo con el mismo DNI.
        setPacienteEncontrado(nuevoPaciente)
        setPacienteNoEncontrado(false)
      }

      // Una sola transacción en la base: vuelve a validar stock y guarda todos los
      // movimientos por lote o ninguno. El responsable se obtiene de la sesión allí.
      const { error } = await supabase.rpc('registrar_salida_lotes', {
        p_medicamento_id: medicamentoId,
        p_paciente_id: pacienteId,
        p_consulta_id: consultaId || null,
        p_cantidad_total: Number(cantidad),
        p_lotes: Object.entries(distribucion)
          .filter(([, valor]) => Number(valor) > 0)
          .map(([lote_id, valor]) => ({ lote_id, cantidad: Number(valor) })),
        p_motivo: motivo.trim() || null,
      })

      if (error) {
        setError(error.message)
        return
      }

      onRegistrado()
    } catch {
      setError('No se pudo confirmar la operación. Revisá la conexión y el historial de movimientos antes de reintentar.')
    } finally {
      enviando.current = false
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold text-text-primary">Registrar salida (administración)</h2>
          </div>

          <div className="min-h-0 overflow-y-auto">
          <fieldset disabled={loading} className="p-4 sm:p-6 space-y-4">

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Medicamento <span className="text-text-primary">*</span>
              </label>
              <SelectorMedicamento
                medicamentos={medicamentos}
                value={medicamentoId}
                onChange={(id) => {
                  setMedicamentoId(id)
                  setLotesDisponibles([])
                  setAjustes(null)
                  setCantidad('')
                  setError('')
                }}
                placeholder="Escribir para buscar..."
              />
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
              {lotesError && <p role="alert" className="text-sm text-text-primary">{lotesError}</p>}
              {medicamentoId && !buscandoLotes && !lotesError && lotesDisponibles.length === 0 && (
                <p className="text-sm text-text-primary font-semibold">
                  No hay stock disponible en lotes habilitados de este medicamento.
                </p>
              )}
            </div>

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
              <label htmlFor="salida-cantidad-total" className="text-sm text-text-secondary">
                Cantidad total a entregar <span className="text-text-primary">*</span>
              </label>
              <input
                type="number"
                id="salida-cantidad-total"
                required
                min="1"
                step="1"
                max="2147483647"
                value={cantidad}
                onChange={(e) => { setCantidad(e.target.value); setAjustes(null); setError('') }}
                className="input"
              />
            </div>

            {medicamentoId && !buscandoLotes && (
              <div className="space-y-3">
                {lotesDisponibles.length > 0 && (
                  <>
                    <div className="space-y-1">
                      <h3 className="font-medium text-text-primary">Distribución por lotes</h3>
                      <p className="text-sm text-text-secondary">
                        Se completa empezando por los que vencen antes. Ajustá las cantidades si entregás de otros lotes.
                      </p>
                    </div>
                    <div className="divide-y divide-border rounded-lg border border-border px-3">
                      {lotesDisponibles.map((lote) => (
                        <div key={lote.lote_id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1 text-sm">
                            <label htmlFor={`salida-lote-${lote.lote_id}`} className="font-medium text-text-primary break-words">
                              Lote {lote.numero_lote || '(sin número)'}
                            </label>
                            <p className="text-text-secondary">Vence {formatFecha(lote.fecha_vencimiento)}</p>
                            <p className="text-text-secondary">{lote.stock_actual} disponibles</p>
                            {loteProximoAVencer(lote.fecha_vencimiento) && (
                              <p className="font-semibold text-text-primary">Próximo a vencer</p>
                            )}
                          </div>
                          <input
                            id={`salida-lote-${lote.lote_id}`}
                            type="number"
                            min="0"
                            step="1"
                            max={lote.stock_actual}
                            value={distribucion[lote.lote_id] ?? 0}
                            onChange={(e) => { setAjustes({ ...distribucion, [lote.lote_id]: e.target.value }); setError('') }}
                            className="input w-24 shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                    <p aria-live="polite" className="text-sm font-medium text-text-primary">
                      Total asignado: {totalAsignado} de {Number(cantidad) || 0} unidades
                    </p>
                    {cantidad && errorDistribucion && <p role="alert" className="text-sm text-text-primary">{errorDistribucion}</p>}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {lotesDisponibles.length > 0 && (
                    <button type="button" className="btn-secondary" onClick={() => { setAjustes(null); setError('') }}>
                      Recalcular por vencimiento
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => { setRecargaLotes((n) => n + 1); setError('') }}>
                    Actualizar lotes
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Observación</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Opcional"
                className="input"
              />
            </div>
          </fieldset>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
            <button type="button" disabled={loading} onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading || buscandoLotes || buscandoPaciente || !!lotesError || !!errorDistribucion} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar salida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
