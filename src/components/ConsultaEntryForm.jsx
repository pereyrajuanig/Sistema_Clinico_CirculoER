import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { registrarAuditoria } from '@/lib/auditoria'

// examen_fisico, diagnostico y medicacion se sacaron del formulario a pedido del cliente —
// mismo criterio que pronostico/proximo_control/observaciones antes: la columna sigue
// existiendo en la base sin tocar, `CAMPOS_CONSULTA` (HistoriaClinica.jsx) las sigue
// mostrando si una consulta vieja ya tenía el dato cargado, pero no se piden más acá. Al no
// estar en `initialForm`, editar una consulta vieja con esos campos cargados no los borra —
// `camposClinicos` (más abajo) simplemente no los incluye en el UPDATE, así que Supabase
// deja esas columnas como estaban.
const initialForm = {
  motivo: '',
  tratamiento: '',
  evolucion: '',
  presion_sistolica: '',
  presion_diastolica: '',
  frecuencia_cardiaca: '',
  temperatura: '',
  frecuencia_respiratoria: '',
  saturacion_oxigeno: '',
  peso: '',
  talla: '',
  glucemia: '',
}

// Estado y fecha_inicio se sacaron del formulario a pedido del cliente ("solo dejar nombre
// y dosis") — toda medicación cargada desde acá arranca como Activa, sin fecha de inicio
// (la columna sigue existiendo en la base, sin tocar). Mismo criterio que el resto de los
// campos reducidos de esta app: no se pierde nada, solo se dejó de pedir.
const medicacionNuevaInicial = {
  nombre: '',
  dosis: '',
}

const CAMPOS_NUMERICOS = new Set([
  'presion_sistolica',
  'presion_diastolica',
  'frecuencia_cardiaca',
  'temperatura',
  'frecuencia_respiratoria',
  'saturacion_oxigeno',
  'peso',
  'talla',
  'glucemia',
])

function formatFecha(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

// Experimento de UX pedido directo por los médicos (ver CLAUDE.md — pensado como cuaderno
// continuo, no formulario con casilleros; si en el uso real no resulta natural, el plan B es
// simplificar a un único campo de texto libre): el alta de una consulta nueva se integra al
// final de la línea de tiempo de HistoriaClinica.jsx, sin overlay — "como agregar la próxima
// página". Editar una consulta existente sigue siendo un modal, eso no cambió. Por eso este
// componente resuelve las dos cosas: mismos campos y misma lógica de guardado siempre, pero
// el armazón de alrededor cambia según `esEdicion` (modal centrado) o no (bloque en línea,
// sin fondo oscuro ni posición fija).
export default function ConsultaEntryForm({ pacienteId, consulta, onClose, onSaved }) {
  const esEdicion = Boolean(consulta)
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(consulta?.profesional_id || null)
  const [form, setForm] = useState(() =>
    esEdicion
      ? Object.fromEntries(Object.keys(initialForm).map((key) => [key, consulta[key] ?? '']))
      : initialForm
  )
  // Colapsados por defecto en el alta (nada que mostrar todavía); si se edita una consulta
  // que ya tenía algún signo vital cargado, arranca desplegado para no esconder un dato que
  // ya estaba — nunca ocultar datos existentes detrás de un clic
  const [mostrandoVitales, setMostrandoVitales] = useState(
    () => esEdicion && [...CAMPOS_NUMERICOS].some((campo) => consulta[campo] != null && consulta[campo] !== '')
  )
  const [agregandoMedicacion, setAgregandoMedicacion] = useState(false)
  const [medicacionNueva, setMedicacionNueva] = useState(medicacionNuevaInicial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function cargarProfesionales() {
      const { data, error } = await supabase
        .from('profesionales')
        .select('id, nombre, activo')
        .eq('activo', true)
        .order('nombre')

      if (error) {
        setError(error.message)
        return
      }

      // Si se edita una consulta atendida por alguien ya dado de baja, lo agregamos igual
      // a la lista (marcado) — no tiene sentido que la edición borre o falsee quién atendió
      // realmente en su momento
      const idOriginal = consulta?.profesional_id
      if (idOriginal && !data.some((p) => p.id === idOriginal)) {
        const { data: inactivo } = await supabase
          .from('profesionales')
          .select('id, nombre, activo')
          .eq('id', idOriginal)
          .maybeSingle()

        if (inactivo) {
          setProfesionales([...data, inactivo])
          return
        }
      }

      setProfesionales(data)
    }

    cargarProfesionales()
  }, [consulta?.profesional_id])

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function mostrarAgregarMedicacion() {
    setAgregandoMedicacion(true)
  }

  function cancelarAgregarMedicacion() {
    setAgregandoMedicacion(false)
    setMedicacionNueva(medicacionNuevaInicial)
  }

  function handleChangeMedicacion(campo) {
    return (e) => setMedicacionNueva((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién atiende antes de guardar.')
      return
    }
    if (agregandoMedicacion && !medicacionNueva.nombre.trim()) {
      setError('Cargá el nombre del medicamento para agregarlo a medicación habitual.')
      return
    }

    setLoading(true)

    // Va antes que la consulta a propósito — medicacion no tiene ninguna FK hacia
    // consultas (es un agregado independiente, sin vínculo en la base), así que si esto
    // falla no tiene sentido dejar a mitad de camino nada relacionado con la consulta:
    // se corta acá, sin tocar la consulta todavía. `estado: 'Activa'` fijo (ya no se pide,
    // ver medicacionNuevaInicial más arriba) — toda medicación cargada desde una consulta
    // arranca como vigente.
    let medicacionInsertada = null
    if (agregandoMedicacion) {
      const { data: medicacionData, error: medicacionError } = await supabase
        .from('medicacion')
        .insert({
          paciente_id: pacienteId,
          nombre: medicacionNueva.nombre.trim(),
          dosis: medicacionNueva.dosis || null,
          estado: 'Activa',
          usuario_id: profesionalId,
        })
        .select()
        .single()

      if (medicacionError) {
        setLoading(false)
        setError(medicacionError.message)
        return
      }

      medicacionInsertada = medicacionData
    }

    if (esEdicion) {
      const { error: auditoriaError } = await registrarAuditoria({
        tabla: 'consultas',
        registroId: consulta.id,
        accion: 'editar',
        usuarioId: profesionalId,
        valoresAnteriores: consulta,
      })

      if (auditoriaError) {
        setLoading(false)
        setError(auditoriaError.message)
        return
      }
    }

    const camposClinicos = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        value === '' ? null : CAMPOS_NUMERICOS.has(key) ? Number(value) : value,
      ])
    )

    const query = esEdicion
      ? supabase
          .from('consultas')
          .update({ profesional_id: profesionalId, ...camposClinicos })
          .eq('id', consulta.id)
      : supabase.from('consultas').insert({
          paciente_id: pacienteId,
          profesional_id: profesionalId,
          fecha: new Date().toISOString(),
          ...camposClinicos,
        })

    const { data, error } = await query.select('*, profesionales!profesional_id(nombre)').single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved(data, medicacionInsertada)
  }

  const campos = (
    <>
      <div className="space-y-2">
        <label className="text-sm text-text-secondary">
          ¿Quién atiende? <span className="text-text-primary">*</span>
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
              {p.activo === false ? ' (dado de baja)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Los dos apartados opcionales van juntos, uno al lado del otro — ninguno depende
          del otro, agrupan lo que "no siempre hace falta cargar" antes del bloque de texto
          libre que sí se escribe siempre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMostrandoVitales((v) => !v)}
          className="btn-secondary w-full"
        >
          {mostrandoVitales ? '‹ Ocultar signos vitales' : '+ Agregar signos vitales'}
        </button>
        <button
          type="button"
          onClick={agregandoMedicacion ? cancelarAgregarMedicacion : mostrarAgregarMedicacion}
          className="btn-secondary w-full"
        >
          {agregandoMedicacion ? '‹ Cancelar medicación habitual' : '+ Agregar a medicación habitual'}
        </button>
      </div>

      {mostrandoVitales && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="P.A. sistólica">
            <input
              type="number"
              value={form.presion_sistolica}
              onChange={handleChange('presion_sistolica')}
              className="input"
            />
          </Field>
          <Field label="P.A. diastólica">
            <input
              type="number"
              value={form.presion_diastolica}
              onChange={handleChange('presion_diastolica')}
              className="input"
            />
          </Field>
          <Field label="Frec. cardíaca">
            <input
              type="number"
              value={form.frecuencia_cardiaca}
              onChange={handleChange('frecuencia_cardiaca')}
              className="input"
            />
          </Field>
          <Field label="Temperatura">
            <input
              type="number"
              step="0.1"
              value={form.temperatura}
              onChange={handleChange('temperatura')}
              className="input"
            />
          </Field>
          <Field label="Frec. respiratoria">
            <input
              type="number"
              value={form.frecuencia_respiratoria}
              onChange={handleChange('frecuencia_respiratoria')}
              className="input"
            />
          </Field>
          <Field label="Saturación O₂">
            <input
              type="number"
              value={form.saturacion_oxigeno}
              onChange={handleChange('saturacion_oxigeno')}
              className="input"
            />
          </Field>
          <Field label="Peso (kg)">
            <input
              type="number"
              step="0.1"
              value={form.peso}
              onChange={handleChange('peso')}
              className="input"
            />
          </Field>
          <Field label="Talla (cm)">
            <input
              type="number"
              value={form.talla}
              onChange={handleChange('talla')}
              className="input"
            />
          </Field>
          <Field label="Glucemia">
            <input
              type="number"
              value={form.glucemia}
              onChange={handleChange('glucemia')}
              className="input"
            />
          </Field>
        </div>
      )}

      {agregandoMedicacion && (
        <div className="space-y-4 border border-border rounded-lg p-3 bg-background">
          <Field label="Nombre del medicamento" required>
            <input
              required
              value={medicacionNueva.nombre}
              onChange={handleChangeMedicacion('nombre')}
              placeholder="Ej: Losartán"
              className="input"
            />
          </Field>

          <Field label="Dosis">
            <input
              value={medicacionNueva.dosis}
              onChange={handleChangeMedicacion('dosis')}
              placeholder="Ej: 50mg cada 12hs"
              className="input"
            />
          </Field>
        </div>
      )}

      {/* Bloque continuo, una sola columna — se escribe de corrido de arriba hacia abajo.
          Solo estos tres quedan siempre visibles (pedido del cliente); examen_fisico,
          diagnostico y medicacion se sacaron, ver el comentario de initialForm más arriba. */}
      <div className="space-y-4">
        <Field label="Motivo">
          <textarea value={form.motivo} onChange={handleChange('motivo')} className="input" rows={3} />
        </Field>
        <Field label="Tratamiento">
          <textarea
            value={form.tratamiento}
            onChange={handleChange('tratamiento')}
            className="input"
            rows={3}
          />
        </Field>
        <Field label="Conclusión">
          <textarea
            value={form.evolucion}
            onChange={handleChange('evolucion')}
            className="input"
            rows={3}
          />
        </Field>
      </div>
    </>
  )

  if (esEdicion) {
    return (
      <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
        <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">
                Editar consulta — {formatFecha(consulta.fecha)}
              </h2>
            </div>

            <div className="p-4 sm:p-6 space-y-6">{campos}</div>

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

  // Alta: sin overlay ni posición fija — se renderiza en línea, al final de la línea de
  // tiempo de HistoriaClinica.jsx, como la próxima página del mismo cuaderno
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-lg font-semibold text-text-primary">Nueva consulta</h3>

      {campos}

      {error && <p className="text-base text-text-primary">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar consulta'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-text-secondary">
        {label}
        {required && <span className="text-text-primary"> *</span>}
      </label>
      {children}
    </div>
  )
}
