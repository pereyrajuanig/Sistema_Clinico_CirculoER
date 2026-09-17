import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import ConsultaEntryForm from '@/components/ConsultaEntryForm'
import DocumentosConsulta from '@/components/DocumentosConsulta'
import AntecedenteEntryForm from '@/components/AntecedenteEntryForm'
import PatologiaEntryForm from '@/components/PatologiaEntryForm'
import PacienteFormModal from '@/components/PacienteFormModal'
import LaboratorioEntryForm from '@/components/LaboratorioEntryForm'
import EditarResultadoLaboratorioModal from '@/components/EditarResultadoLaboratorioModal'
import ConfirmarConProfesionalModal from '@/components/ConfirmarConProfesionalModal'
import ExportarPdfModal from '@/components/ExportarPdfModal'
import Header from '@/components/Header'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'
import { ordenarPatologias, claseEstadoPatologia } from '@/lib/patologias'
import { claseColorResaltado } from '@/lib/resaltado'
import { TIPOS_EXAMEN } from '@/lib/laboratorio'
import { formatearDni } from '@/lib/dni'
import { registrarAuditoria } from '@/lib/auditoria'
import { calcularEdad, formatearMayuscula } from '@/lib/pacientes'

const CAMPOS_CONSULTA = [
  ['motivo', 'Motivo'],
  ['examen_fisico', 'Examen físico'],
  ['diagnostico', 'Diagnóstico'],
  ['tratamiento', 'Tratamiento'],
  ['medicacion', 'Medicación'],
  ['evolucion', 'Conclusión'],
  ['pronostico', 'Pronóstico'],
  ['observaciones', 'Observaciones'],
]

function formatFecha(value, opts) {
  if (!value) return null
  return new Date(value).toLocaleDateString('es-AR', opts)
}

function signosVitales(c) {
  const items = []
  if (c.presion_sistolica && c.presion_diastolica) {
    items.push(['Presión arterial', `${c.presion_sistolica}/${c.presion_diastolica} mmHg`])
  }
  if (c.frecuencia_cardiaca) items.push(['Frec. cardíaca', `${c.frecuencia_cardiaca} lpm`])
  if (c.temperatura) items.push(['Temperatura', `${c.temperatura} °C`])
  if (c.frecuencia_respiratoria) items.push(['Frec. respiratoria', `${c.frecuencia_respiratoria} rpm`])
  if (c.saturacion_oxigeno) items.push(['Saturación O₂', `${c.saturacion_oxigeno}%`])
  if (c.peso) items.push(['Peso', `${c.peso} kg`])
  if (c.talla) items.push(['Talla', `${c.talla} cm`])
  if (c.glucemia) items.push(['Glucemia', `${c.glucemia} mg/dl`])
  return items
}

export default function HistoriaClinica() {
  const { id } = useParams()
  const location = useLocation()
  const nuevaConsultaRef = useRef(null)
  const [paciente, setPaciente] = useState(null)
  const [antecedentes, setAntecedentes] = useState([])
  const [patologias, setPatologias] = useState([])
  const [medicacionHabitual, setMedicacionHabitual] = useState([])
  const [consultas, setConsultas] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [resultadosLab, setResultadosLab] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Alta de consulta: en línea al final de la línea de tiempo, no un modal — ver
  // ConsultaEntryForm.jsx. `editingConsulta` (más abajo) sigue abriendo un modal, eso no
  // cambió: solo el alta se integró al flujo de la página.
  const [mostrandoNuevaConsulta, setMostrandoNuevaConsulta] = useState(false)
  // Antecedentes y Patologías comparten un solo botón/formulario de alta (pedido explícito
  // del cliente) — `tipoAlta` decide cuál de los dos formularios existentes
  // (AntecedenteEntryForm/PatologiaEntryForm, sin tocar) se renderiza debajo del selector.
  const [mostrandoAltaAntecedentePatologia, setMostrandoAltaAntecedentePatologia] = useState(false)
  const [tipoAlta, setTipoAlta] = useState('antecedente')
  const [mostrandoNuevoResultado, setMostrandoNuevoResultado] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [editingConsulta, setEditingConsulta] = useState(null)
  const [editingAntecedente, setEditingAntecedente] = useState(null)
  const [editingPatologia, setEditingPatologia] = useState(null)
  const [editingResultado, setEditingResultado] = useState(null)
  const [antecedenteAEliminar, setAntecedenteAEliminar] = useState(null)
  const [patologiaAEliminar, setPatologiaAEliminar] = useState(null)
  const [consultaAEliminar, setConsultaAEliminar] = useState(null)
  const [resultadoAEliminar, setResultadoAEliminar] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      setError('')

      const [pacienteRes, antecedentesRes, patologiasRes, medicacionRes, consultasRes, labRes] =
        await Promise.all([
          supabase.from('pacientes').select('*').eq('id', id).single(),
          supabase
            .from('antecedentes')
            .select('*, profesionales!usuario_id(nombre)')
            .eq('paciente_id', id)
            .is('eliminado_en', null)
            .order('created_at'),
          supabase
            .from('patologias')
            .select('*')
            .eq('paciente_id', id)
            .is('eliminado_en', null)
            .order('nombre'),
          supabase
            .from('medicacion')
            .select('*')
            .eq('paciente_id', id)
            .is('eliminado_en', null)
            .order('nombre'),
          // Ascendente a propósito, al revés que el resto de las tablas clínicas de esta
          // página — experimento de UX (ver CLAUDE.md): la línea de tiempo de consultas se
          // lee de la más vieja a la más nueva, como las páginas de un cuaderno
          supabase
            .from('consultas')
            .select('*, profesionales!profesional_id(nombre)')
            .eq('paciente_id', id)
            .is('eliminado_en', null)
            .order('fecha', { ascending: true }),
          supabase
            .from('resultados_laboratorio')
            .select('*')
            .eq('paciente_id', id)
            .is('eliminado_en', null)
            .order('fecha', { ascending: false }),
        ])

      setLoading(false)

      const primerError =
        pacienteRes.error ||
        antecedentesRes.error ||
        patologiasRes.error ||
        medicacionRes.error ||
        consultasRes.error ||
        labRes.error
      if (primerError) {
        setError(primerError.message)
        return
      }

      setPaciente(pacienteRes.data)
      setAntecedentes(antecedentesRes.data)
      setPatologias(ordenarPatologias(patologiasRes.data))
      // Ya viene ordenado alfabéticamente por el .order('nombre') de la query — no hace
      // falta ordenarMedicacion() (agrupar Activa/Suspendida) desde que la sección de
      // gestión se sacó (ver más abajo): el panel resumen de arriba solo lista las activas.
      setMedicacionHabitual(medicacionRes.data)
      setConsultas(consultasRes.data)
      setResultadosLab(labRes.data)

      const consultaIds = consultasRes.data.map((c) => c.id)
      if (consultaIds.length > 0) {
        const { data, error } = await supabase
          .from('documentos')
          .select('*')
          .in('consulta_id', consultaIds)

        if (error) setError(error.message)
        else setDocumentos(data)
      }
    }

    fetchAll()
  }, [id])

  useEffect(() => {
    if (location.state?.abrirNuevaConsulta) {
      setMostrandoNuevaConsulta(true)
    }
  }, [location.state])

  // La entrada nueva ya no es un modal centrado imposible de perder — vive al final de la
  // línea de tiempo, que puede estar bien abajo de la página. Sin este scroll, abrirla desde
  // el atajo de Pacientes.jsx ("Cargar consulta" post-alta) la dejaría fuera de la vista.
  useEffect(() => {
    if (mostrandoNuevaConsulta) {
      nuevaConsultaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [mostrandoNuevaConsulta])

  function handlePacienteGuardado(pacienteActualizado) {
    setPaciente(pacienteActualizado)
    setShowEditModal(false)
  }

  // Cierra el alta compartida de Antecedentes/Patologías y resetea el tipo seleccionado —
  // así la próxima vez que se abre arranca siempre en "Antecedente" (el orden en que
  // aparecen los dos botones del selector).
  function cerrarAltaAntecedentePatologia() {
    setMostrandoAltaAntecedentePatologia(false)
    setTipoAlta('antecedente')
  }

  function handleAntecedenteGuardado(antecedenteGuardado) {
    setAntecedentes((prev) => {
      const existe = prev.some((a) => a.id === antecedenteGuardado.id)
      return existe
        ? prev.map((a) => (a.id === antecedenteGuardado.id ? antecedenteGuardado : a))
        : [...prev, antecedenteGuardado]
    })
    cerrarAltaAntecedentePatologia()
    setEditingAntecedente(null)
  }

  async function confirmarEliminarAntecedente(profesionalId) {
    const antecedente = antecedenteAEliminar

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'antecedentes',
      registroId: antecedente.id,
      accion: 'eliminar',
      usuarioId: profesionalId,
      valoresAnteriores: antecedente,
    })

    if (auditoriaError) {
      setError(auditoriaError.message)
      return
    }

    const { error } = await supabase
      .from('antecedentes')
      .update({ eliminado_en: new Date().toISOString(), eliminado_por: profesionalId })
      .eq('id', antecedente.id)

    if (error) {
      setError(error.message)
      return
    }

    setAntecedentes((prev) => prev.filter((a) => a.id !== antecedente.id))
    setAntecedenteAEliminar(null)
  }

  function handlePatologiaGuardada(patologiaGuardada) {
    setPatologias((prev) => {
      const existe = prev.some((p) => p.id === patologiaGuardada.id)
      const siguiente = existe
        ? prev.map((p) => (p.id === patologiaGuardada.id ? patologiaGuardada : p))
        : [...prev, patologiaGuardada]
      return ordenarPatologias(siguiente)
    })
    cerrarAltaAntecedentePatologia()
    setEditingPatologia(null)
  }

  async function confirmarEliminarPatologia(profesionalId) {
    const patologia = patologiaAEliminar

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'patologias',
      registroId: patologia.id,
      accion: 'eliminar',
      usuarioId: profesionalId,
      valoresAnteriores: patologia,
    })

    if (auditoriaError) {
      setError(auditoriaError.message)
      return
    }

    const { error } = await supabase
      .from('patologias')
      .update({ eliminado_en: new Date().toISOString(), eliminado_por: profesionalId })
      .eq('id', patologia.id)

    if (error) {
      setError(error.message)
      return
    }

    setPatologias((prev) => prev.filter((p) => p.id !== patologia.id))
    setPatologiaAEliminar(null)
  }

  // `medicacionInsertada` viene de ConsultaEntryForm.jsx cuando se usó el atajo "+ Agregar a
  // medicación habitual" dentro de esa consulta — como la sección dedicada de "Medicación
  // habitual" ya no existe (se sacó a pedido del cliente, solo queda el panel resumen de
  // arriba), sin esto el panel no se actualizaba hasta recargar la página.
  function handleConsultaGuardada(consultaGuardada, medicacionInsertada) {
    setConsultas((prev) => {
      const existe = prev.some((c) => c.id === consultaGuardada.id)
      const siguiente = existe
        ? prev.map((c) => (c.id === consultaGuardada.id ? consultaGuardada : c))
        : [...prev, consultaGuardada]
      // Ascendente, igual que el fetch inicial — la nueva entrada se asienta al final
      return siguiente.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    })
    if (medicacionInsertada) {
      setMedicacionHabitual((prev) => [...prev, medicacionInsertada])
    }
    setMostrandoNuevaConsulta(false)
    setEditingConsulta(null)
  }

  async function confirmarEliminarConsulta(profesionalId) {
    const consulta = consultaAEliminar

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'consultas',
      registroId: consulta.id,
      accion: 'eliminar',
      usuarioId: profesionalId,
      valoresAnteriores: consulta,
    })

    if (auditoriaError) {
      setError(auditoriaError.message)
      return
    }

    const { error } = await supabase
      .from('consultas')
      .update({ eliminado_en: new Date().toISOString(), eliminado_por: profesionalId })
      .eq('id', consulta.id)

    if (error) {
      setError(error.message)
      return
    }

    setConsultas((prev) => prev.filter((c) => c.id !== consulta.id))
    setDocumentos((prev) => prev.filter((d) => d.consulta_id !== consulta.id))
    setConsultaAEliminar(null)
  }

  function handleResultadosCreados(nuevosResultados) {
    setResultadosLab((prev) =>
      [...prev, ...nuevosResultados].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    )
    setMostrandoNuevoResultado(false)
  }

  function handleResultadoActualizado(resultadoActualizado) {
    setResultadosLab((prev) =>
      prev
        .map((r) => (r.id === resultadoActualizado.id ? resultadoActualizado : r))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    )
    setEditingResultado(null)
  }

  async function confirmarEliminarResultado(profesionalId) {
    const resultado = resultadoAEliminar

    const { error: auditoriaError } = await registrarAuditoria({
      tabla: 'resultados_laboratorio',
      registroId: resultado.id,
      accion: 'eliminar',
      usuarioId: profesionalId,
      valoresAnteriores: resultado,
    })

    if (auditoriaError) {
      setError(auditoriaError.message)
      return
    }

    const { error } = await supabase
      .from('resultados_laboratorio')
      .update({ eliminado_en: new Date().toISOString(), eliminado_por: profesionalId })
      .eq('id', resultado.id)

    if (error) {
      setError(error.message)
      return
    }

    setResultadosLab((prev) => prev.filter((r) => r.id !== resultado.id))
    setResultadoAEliminar(null)
  }

  if (loading) {
    return (
      <p className="p-10 text-center text-text-secondary text-base">Cargando historia clínica...</p>
    )
  }

  if (error) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-base text-text-primary">{error}</p>
        <Link to="/" className="text-base text-text-secondary hover:text-text-primary underline">
          Volver a pacientes
        </Link>
      </div>
    )
  }

  const alergias = antecedentes.filter((a) => a.tipo === 'alergia')
  const edad = calcularEdad(paciente.fecha_nacimiento)
  const medicacionActiva = medicacionHabitual.filter((m) => m.estado === 'Activa')
  // Panel resumen de arriba: una patología entra si está Activa y/o si tiene color puesto
  // (resaltado, ver src/lib/resaltado.js) — una sola fila por patología en los dos casos, el
  // color se aplica SOBRE esa fila en vez de repetirla en una lista aparte de "resaltados"
  // (pedido explícito del cliente, corrigiendo una primera versión que sí la duplicaba).
  // Antecedentes no tienen un estado "activo", así que solo entran acá si tienen color.
  const patologiasParaResumen = patologias.filter((p) => p.estado === 'Activa' || p.color)
  const antecedentesResaltados = antecedentes.filter((a) => a.color)
  const mostrarResumen =
    patologiasParaResumen.length > 0 || medicacionActiva.length > 0 || antecedentesResaltados.length > 0

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={`${paciente.apellido}, ${paciente.nombre}`}
        subtitle={
          <p className="text-base font-medium text-text-primary truncate">
            DNI {formatearDni(paciente.dni)}
          </p>
        }
        actions={[
          { label: 'Exportar PDF', onClick: () => setShowExportModal(true), variant: 'secondary' },
          { label: '← Volver a pacientes', to: '/', variant: 'secondary' },
        ]}
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div
          className={
            'lg:grid lg:gap-6 lg:items-start ' +
            (mostrarResumen ? 'lg:grid-cols-[280px_1fr_320px]' : 'lg:grid-cols-[280px_1fr]')
          }
        >
          {/* Columna izquierda, pedido explícito del cliente ("lo mismo con los datos del
              paciente pero del lado izquierdo") — mismo criterio sticky que el panel de la
              derecha: acompaña el scroll en vez de perderse de vista al bajar. El cartel de
              alergias se agrupó acá (no en la columna del medio) porque es información de
              identidad/seguridad del paciente, igual que sus datos — no parte de la historia
              clínica cronológica que sí vive en la columna central. */}
          <aside className="space-y-6 lg:sticky lg:top-4">
            {alergias.length > 0 && (
              <div className="bg-alert/10 border border-alert rounded-lg p-4 flex gap-3 items-start">
                <IconoAlerta />
                <div>
                  <p className="font-semibold text-text-primary">Alergias registradas</p>
                  <ul className="text-text-primary text-base list-disc list-inside">
                    {alergias.map((a) => (
                      <li key={a.id}>{a.descripcion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-text-primary">Datos del paciente</h2>
                <button onClick={() => setShowEditModal(true)} className="btn-secondary px-3 py-1.5">
                  Editar
                </button>
              </div>
              {/* Una sola columna — antes era grid-cols-2 sm:grid-cols-3, pensado para un
                  ancho de página completo; en esta columna angosta (280px) esa cuadrícula
                  quedaba demasiado apretada para leer "Label: Valor" cómodo */}
              <dl className="space-y-4 text-base">
                <Dato label="Fecha de nacimiento" value={formatFecha(paciente.fecha_nacimiento)} />
                <Dato label="Edad" value={edad != null ? `${edad} años` : null} />
                <Dato label="Sexo" value={paciente.sexo} />
                <Dato label="Teléfono" value={paciente.telefono} />
                <Dato label="Dirección" value={paciente.direccion} />
                <Dato label="Contacto familiar" value={paciente.contacto_familiar} />
                <Dato label="Obra social" value={formatearMayuscula(paciente.obra_social)} />
                <Dato label="Grupo sanguíneo" value={formatearMayuscula(paciente.grupo_sanguineo)} />
                <Dato label="Ocupación" value={paciente.ocupacion} />
                <Dato label="Estado civil" value={paciente.estado_civil} />
              </dl>
            </section>
          </aside>

          <div className="space-y-6 mt-6 lg:mt-0">

        {/* Línea de tiempo de consultas — experimento de UX pedido directo por los médicos
            (ver CLAUDE.md): se lee de arriba hacia abajo, de la más vieja a la más nueva,
            como un cuaderno. El alta de una consulta nueva se agrega al final de esta misma
            lista (ConsultaEntryForm sin overlay), no en un modal aparte — así el médico sigue
            viendo todo lo anterior mientras escribe. Editar una consulta existente sigue
            siendo un modal (no se pidió cambiar eso). */}
        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Consultas</h2>

          {consultas.length === 0 && !mostrandoNuevaConsulta && (
            <p className="text-base text-text-secondary mb-4">No hay consultas registradas.</p>
          )}

          <div className="space-y-4">
            {consultas.map((c) => (
              <div key={c.id} className="border-l-4 border-primary rounded-r-lg bg-surface pl-4 py-3">
                <ConsultaCard
                  consulta={c}
                  documentos={documentos.filter((d) => d.consulta_id === c.id)}
                  onDocumentoSubido={(doc) => setDocumentos((prev) => [...prev, doc])}
                  onEditar={() => setEditingConsulta(c)}
                  onEliminar={() => setConsultaAEliminar(c)}
                />
              </div>
            ))}

            <div ref={nuevaConsultaRef}>
              {mostrandoNuevaConsulta ? (
                // Borde punteado + fondo apenas teñido en `primary` (no un borde sólido
                // como las entradas ya escritas) — marca de un vistazo cuál es la entrada
                // todavía en curso, sin gritar ni romper el resto de la paleta
                <div className="border-2 border-dashed border-primary rounded-lg bg-primary/10 p-4 sm:p-6">
                  <ConsultaEntryForm
                    pacienteId={id}
                    onClose={() => setMostrandoNuevaConsulta(false)}
                    onSaved={handleConsultaGuardada}
                  />
                </div>
              ) : (
                <button onClick={() => setMostrandoNuevaConsulta(true)} className="btn-primary">
                  + Nueva consulta
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Antecedentes y Patologías comparten un solo recuadro (pedido explícito del
            cliente) — dos subsecciones de solo lectura (cada una con su propia lista) más
            UN SOLO alta compartida al final, con un selector Antecedente/Patología (mismo
            estilo que "¿Quién carga?") que decide cuál de los dos formularios existentes
            (AntecedenteEntryForm/PatologiaEntryForm, sin tocar su lógica interna) se
            muestra debajo. Mismo concepto y estilo visual que Consultas (ver CLAUDE.md):
            sin modal, con el mismo acento a la izquierda en las entradas ya cargadas y el
            mismo recuadro punteado para la que se está escribiendo. */}
        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6 space-y-6">
          <h2 className="text-lg font-semibold text-text-primary">Antecedentes y Patologías</h2>

          <div>
            <h3 className="text-base font-semibold text-text-primary mb-3">Antecedentes</h3>

            {antecedentes.length === 0 && (
              <p className="text-base text-text-secondary">No hay antecedentes registrados.</p>
            )}

            <div className="space-y-4">
              {antecedentes.map((a) => (
                <div
                  key={a.id}
                  className={
                    'border-l-4 rounded-r-lg pl-4 py-3 text-base flex items-start justify-between gap-2 ' +
                    (claseColorResaltado(a.color) || 'border-primary bg-surface')
                  }
                >
                  <div className="flex gap-2">
                    <span className="shrink-0 bg-border/50 text-text-primary rounded-md px-2 py-0.5 text-sm font-medium">
                      {TIPOS_ANTECEDENTE[a.tipo] || a.tipo}
                    </span>
                    <span className="text-text-primary">
                      {a.descripcion}
                      {a.profesionales?.nombre && (
                        <span className="block text-text-secondary text-sm">
                          Cargado por {a.profesionales.nombre}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => setEditingAntecedente(a)}
                      className="text-sm text-text-secondary hover:text-text-primary underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setAntecedenteAEliminar(a)}
                      className="text-sm text-text-primary underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-text-primary mb-3">Patologías</h3>

            {patologias.length === 0 && (
              <p className="text-base text-text-secondary">No hay patologías registradas.</p>
            )}

            <div className="space-y-4">
              {patologias.map((p) => (
                <div
                  key={p.id}
                  className={
                    'border-l-4 rounded-r-lg pl-4 py-3 text-base flex items-start justify-between gap-2 ' +
                    (claseColorResaltado(p.color) || 'border-primary bg-surface')
                  }
                >
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={
                        'shrink-0 rounded-md px-2 py-0.5 text-sm border ' + claseEstadoPatologia(p.estado)
                      }
                    >
                      {p.estado}
                    </span>
                    <span className="text-text-primary">
                      {p.nombre}
                      {p.fecha_diagnostico && (
                        <span className="text-text-secondary">
                          {' '}
                          — diagnosticada {formatFecha(p.fecha_diagnostico)}
                        </span>
                      )}
                      {p.observaciones && (
                        <span className="block text-text-secondary text-sm">{p.observaciones}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => setEditingPatologia(p)}
                      className="text-sm text-text-secondary hover:text-text-primary underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setPatologiaAEliminar(p)}
                      className="text-sm text-text-primary underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mostrandoAltaAntecedentePatologia ? (
            <div className="border-2 border-dashed border-primary rounded-lg bg-primary/10 p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-text-secondary">
                  ¿Qué querés agregar? <span className="text-text-primary">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['antecedente', 'Antecedente'],
                    ['patologia', 'Patología'],
                  ].map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTipoAlta(valor)}
                      className={
                        'rounded-lg px-4 py-2 text-base font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ' +
                        (tipoAlta === valor
                          ? 'bg-accent-marino text-white border-accent-marino shadow-sm'
                          : 'bg-surface text-text-primary border-border hover:bg-background')
                      }
                      style={{ minHeight: '44px' }}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              {tipoAlta === 'antecedente' ? (
                <AntecedenteEntryForm
                  pacienteId={id}
                  onClose={cerrarAltaAntecedentePatologia}
                  onSaved={handleAntecedenteGuardado}
                />
              ) : (
                <PatologiaEntryForm
                  pacienteId={id}
                  onClose={cerrarAltaAntecedentePatologia}
                  onSaved={handlePatologiaGuardada}
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => setMostrandoAltaAntecedentePatologia(true)}
              className="btn-secondary"
            >
              + Agregar antecedente o patología
            </button>
          )}
        </section>

        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Laboratorio</h2>

          {resultadosLab.length === 0 && !mostrandoNuevoResultado && (
            <p className="text-base text-text-secondary mb-4">No hay resultados de laboratorio cargados.</p>
          )}

          {resultadosLab.length > 0 && (
            <div className="space-y-4 mb-4">
              {TIPOS_EXAMEN.filter(({ nombre }) =>
                resultadosLab.some((r) => r.tipo_examen === nombre)
              ).map(({ nombre }) => (
                <div key={nombre}>
                  <h3 className="text-base font-semibold text-text-primary mb-1">{nombre}</h3>
                  <ul className="space-y-2">
                    {resultadosLab
                      .filter((r) => r.tipo_examen === nombre)
                      .map((r) => (
                        <li
                          key={r.id}
                          className="border-l-4 border-primary rounded-r-lg bg-surface pl-3 py-2 text-base text-text-primary flex flex-wrap items-start justify-between gap-2"
                        >
                          <span className="flex gap-2">
                            <span className="text-text-secondary shrink-0">
                              {formatFecha(r.fecha)} —
                            </span>
                            <span>{r.resultado}</span>
                          </span>
                          <span className="flex gap-3 shrink-0">
                            <button
                              onClick={() => setEditingResultado(r)}
                              className="text-sm text-text-secondary hover:text-text-primary underline"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setResultadoAEliminar(r)}
                              className="text-sm text-text-primary underline"
                            >
                              Eliminar
                            </button>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {mostrandoNuevoResultado ? (
            <div className="border-2 border-dashed border-primary rounded-lg bg-primary/10 p-4 sm:p-6">
              <LaboratorioEntryForm
                pacienteId={id}
                onClose={() => setMostrandoNuevoResultado(false)}
                onCreated={handleResultadosCreados}
              />
            </div>
          ) : (
            <button onClick={() => setMostrandoNuevoResultado(true)} className="btn-secondary">
              + Cargar resultados
            </button>
          )}
        </section>
          </div>

          {mostrarResumen && (
            // Pedido explícito del cliente: que el resumen de Patologías/Antecedentes y
            // Medicación "acompañe" el scroll en vez de quedar arriba de todo y perderse de
            // vista al bajar — `lg:sticky lg:top-4` lo fija a 1rem del borde superior del
            // viewport a partir de `lg` (por debajo de eso, se apila como una sección más,
            // no hay espacio para una columna lateral). El cartel de alergias NO se mueve
            // acá — sigue arriba de todo en la columna principal, es una señal distinta.
            <aside className="mt-6 lg:mt-0 lg:sticky lg:top-4 bg-surface border border-border rounded-lg p-4 space-y-3">
              {(patologiasParaResumen.length > 0 || antecedentesResaltados.length > 0) && (
                <div>
                  <p className="font-semibold text-text-primary">Patologías y Antecedentes</p>
                  <ul className="text-base space-y-1">
                    {patologiasParaResumen.map((p) => (
                      <li
                        key={`patologia-${p.id}`}
                        className={
                          'rounded-md px-2 py-1 border-l-4 text-text-primary ' +
                          (claseColorResaltado(p.color) || 'border-transparent')
                        }
                      >
                        {p.nombre}
                      </li>
                    ))}
                    {antecedentesResaltados.map((a) => (
                      <li
                        key={`antecedente-${a.id}`}
                        className={
                          'rounded-md px-2 py-1 border-l-4 text-text-primary ' + claseColorResaltado(a.color)
                        }
                      >
                        {a.descripcion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {medicacionActiva.length > 0 && (
                <div>
                  <p className="font-semibold text-text-primary">Medicación actual</p>
                  <ul className="text-text-primary text-base list-disc list-inside">
                    {medicacionActiva.map((m) => (
                      <li key={m.id}>
                        {m.nombre}
                        {m.dosis ? ` — ${m.dosis}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>

      {editingConsulta && (
        <ConsultaEntryForm
          pacienteId={id}
          consulta={editingConsulta}
          onClose={() => setEditingConsulta(null)}
          onSaved={handleConsultaGuardada}
        />
      )}

      {editingAntecedente && (
        <AntecedenteEntryForm
          pacienteId={id}
          antecedente={editingAntecedente}
          onClose={() => setEditingAntecedente(null)}
          onSaved={handleAntecedenteGuardado}
        />
      )}

      {editingPatologia && (
        <PatologiaEntryForm
          pacienteId={id}
          patologia={editingPatologia}
          onClose={() => setEditingPatologia(null)}
          onSaved={handlePatologiaGuardada}
        />
      )}

      {showEditModal && (
        <PacienteFormModal
          paciente={paciente}
          onClose={() => setShowEditModal(false)}
          onSaved={handlePacienteGuardado}
        />
      )}

      {showExportModal && (
        <ExportarPdfModal
          datos={{
            paciente,
            antecedentes,
            patologias,
            medicacionHabitual,
            consultas,
            resultadosLab,
            documentos,
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {editingResultado && (
        <EditarResultadoLaboratorioModal
          resultado={editingResultado}
          onClose={() => setEditingResultado(null)}
          onSaved={handleResultadoActualizado}
        />
      )}

      {antecedenteAEliminar && (
        <ConfirmarConProfesionalModal
          titulo="Eliminar antecedente"
          mensaje="Deja de verse en la ficha del paciente. El registro se conserva internamente por la normativa de historia clínica (10 años) — no se puede deshacer desde la aplicación."
          textoConfirmar="Eliminar"
          onCancelar={() => setAntecedenteAEliminar(null)}
          onConfirmar={confirmarEliminarAntecedente}
        />
      )}

      {patologiaAEliminar && (
        <ConfirmarConProfesionalModal
          titulo="Eliminar patología"
          mensaje="Deja de verse en la ficha del paciente. El registro se conserva internamente por la normativa de historia clínica (10 años) — no se puede deshacer desde la aplicación."
          textoConfirmar="Eliminar"
          onCancelar={() => setPatologiaAEliminar(null)}
          onConfirmar={confirmarEliminarPatologia}
        />
      )}

      {consultaAEliminar && (
        <ConfirmarConProfesionalModal
          titulo="Eliminar consulta"
          mensaje="Deja de verse en la ficha, junto con sus documentos adjuntos. Los registros se conservan internamente por la normativa de historia clínica (10 años) — no se puede deshacer desde la aplicación."
          textoConfirmar="Eliminar"
          onCancelar={() => setConsultaAEliminar(null)}
          onConfirmar={confirmarEliminarConsulta}
        />
      )}

      {resultadoAEliminar && (
        <ConfirmarConProfesionalModal
          titulo="Eliminar resultado de laboratorio"
          mensaje="Deja de verse en la ficha del paciente. El registro se conserva internamente por la normativa de historia clínica (10 años) — no se puede deshacer desde la aplicación."
          textoConfirmar="Eliminar"
          onCancelar={() => setResultadoAEliminar(null)}
          onConfirmar={confirmarEliminarResultado}
        />
      )}
    </div>
  )
}

function Dato({ label, value }) {
  return (
    <div>
      <dt className="text-text-secondary text-sm">{label}</dt>
      <dd className="text-text-primary">{value || '—'}</dd>
    </div>
  )
}

function ConsultaCard({ consulta: c, documentos, onDocumentoSubido, onEditar, onEliminar }) {
  const vitales = signosVitales(c)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <span className="text-base font-semibold text-text-primary">
          {formatFecha(c.fecha, { dateStyle: 'medium' })}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            Atendió: {c.profesionales?.nombre || 'sin asignar'}
          </span>
          <button onClick={onEditar} className="text-sm text-text-secondary hover:text-text-primary underline">
            Editar
          </button>
          <button onClick={onEliminar} className="text-sm text-text-primary underline">
            Eliminar
          </button>
        </div>
      </div>

      <dl className="space-y-3 text-base">
        {CAMPOS_CONSULTA.filter(([campo]) => c[campo]).map(([campo, label]) => (
          <div key={campo}>
            <dt className="text-text-secondary text-sm">{label}</dt>
            <dd className="text-text-primary">{c[campo]}</dd>
          </div>
        ))}
        {c.proximo_control && (
          <div>
            <dt className="text-text-secondary text-sm">Próximo control</dt>
            <dd className="text-text-primary">{formatFecha(c.proximo_control)}</dd>
          </div>
        )}
      </dl>

      {vitales.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {vitales.map(([label, value]) => (
            <span
              key={label}
              className="text-sm bg-background border border-border rounded-md px-2 py-1 text-text-secondary"
            >
              {label}: {value}
            </span>
          ))}
        </div>
      )}

      <DocumentosConsulta
        consultaId={c.id}
        documentos={documentos}
        onUploaded={onDocumentoSubido}
      />
    </div>
  )
}

function IconoAlerta() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-alert shrink-0 mt-0.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      />
    </svg>
  )
}
