import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import NuevaConsultaModal from '@/components/NuevaConsultaModal'
import DocumentosConsulta from '@/components/DocumentosConsulta'
import AntecedenteFormModal from '@/components/AntecedenteFormModal'
import PacienteFormModal from '@/components/PacienteFormModal'
import LaboratorioFormModal from '@/components/LaboratorioFormModal'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'
import { TIPOS_EXAMEN } from '@/lib/laboratorio'
import { formatearDni } from '@/lib/dni'
import ThemeToggle from '@/components/ThemeToggle'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

const CAMPOS_CONSULTA = [
  ['motivo', 'Motivo'],
  ['examen_fisico', 'Examen físico'],
  ['diagnostico', 'Diagnóstico'],
  ['tratamiento', 'Tratamiento'],
  ['medicacion', 'Medicación'],
  ['evolucion', 'Evolución'],
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
  const [paciente, setPaciente] = useState(null)
  const [antecedentes, setAntecedentes] = useState([])
  const [consultas, setConsultas] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [resultadosLab, setResultadosLab] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showAntecedenteModal, setShowAntecedenteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLabModal, setShowLabModal] = useState(false)
  const [editingConsulta, setEditingConsulta] = useState(null)
  const [editingAntecedente, setEditingAntecedente] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      setError('')

      const [pacienteRes, antecedentesRes, consultasRes, labRes] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase
          .from('antecedentes')
          .select('*')
          .eq('paciente_id', id)
          .order('created_at'),
        supabase
          .from('consultas')
          .select('*, profesionales(nombre)')
          .eq('paciente_id', id)
          .order('fecha', { ascending: false }),
        supabase
          .from('resultados_laboratorio')
          .select('*')
          .eq('paciente_id', id)
          .order('fecha', { ascending: false }),
      ])

      setLoading(false)

      const primerError =
        pacienteRes.error || antecedentesRes.error || consultasRes.error || labRes.error
      if (primerError) {
        setError(primerError.message)
        return
      }

      setPaciente(pacienteRes.data)
      setAntecedentes(antecedentesRes.data)
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
      setShowModal(true)
    }
  }, [location.state])

  function handlePacienteGuardado(pacienteActualizado) {
    setPaciente(pacienteActualizado)
    setShowEditModal(false)
  }

  function handleAntecedenteGuardado(antecedenteGuardado) {
    setAntecedentes((prev) => {
      const existe = prev.some((a) => a.id === antecedenteGuardado.id)
      return existe
        ? prev.map((a) => (a.id === antecedenteGuardado.id ? antecedenteGuardado : a))
        : [...prev, antecedenteGuardado]
    })
    setShowAntecedenteModal(false)
    setEditingAntecedente(null)
  }

  async function handleEliminarAntecedente(antecedenteId) {
    if (!window.confirm('¿Eliminar este antecedente? Esta acción no se puede deshacer.')) return

    const { error } = await supabase.from('antecedentes').delete().eq('id', antecedenteId)

    if (error) {
      setError(error.message)
      return
    }

    setAntecedentes((prev) => prev.filter((a) => a.id !== antecedenteId))
  }

  function handleConsultaGuardada(consultaGuardada) {
    setConsultas((prev) => {
      const existe = prev.some((c) => c.id === consultaGuardada.id)
      const siguiente = existe
        ? prev.map((c) => (c.id === consultaGuardada.id ? consultaGuardada : c))
        : [consultaGuardada, ...prev]
      return siguiente.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    })
    setShowModal(false)
    setEditingConsulta(null)
  }

  async function handleEliminarConsulta(consultaId) {
    if (
      !window.confirm(
        '¿Eliminar esta consulta? Se van a borrar también sus documentos adjuntos. Esta acción no se puede deshacer.'
      )
    ) {
      return
    }

    const documentosDeConsulta = documentos.filter((d) => d.consulta_id === consultaId)

    if (documentosDeConsulta.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('documentos')
        .remove(documentosDeConsulta.map((d) => d.url))

      if (storageError) {
        setError(storageError.message)
        return
      }

      const { error: documentosError } = await supabase
        .from('documentos')
        .delete()
        .eq('consulta_id', consultaId)

      if (documentosError) {
        setError(documentosError.message)
        return
      }
    }

    const { error } = await supabase.from('consultas').delete().eq('id', consultaId)

    if (error) {
      setError(error.message)
      return
    }

    setConsultas((prev) => prev.filter((c) => c.id !== consultaId))
    setDocumentos((prev) => prev.filter((d) => d.consulta_id !== consultaId))
  }

  function handleResultadosCreados(nuevosResultados) {
    setResultadosLab((prev) =>
      [...prev, ...nuevosResultados].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    )
    setShowLabModal(false)
  }

  if (loading) {
    return (
      <p className="p-10 text-center text-text-secondary text-base">Cargando historia clínica...</p>
    )
  }

  if (error) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-base text-alert">{error}</p>
        <Link to="/" className="text-base text-text-secondary hover:text-text-primary underline">
          Volver a pacientes
        </Link>
      </div>
    )
  }

  const alergias = antecedentes.filter((a) => a.tipo === 'alergia')

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-6 py-4">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-20 w-20 object-contain" />
            <div>
              <h1 className="text-4xl font-bold text-text-primary">
                {paciente.apellido}, {paciente.nombre}
              </h1>
              <p className="text-base font-medium text-text-primary">DNI {formatearDni(paciente.dni)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              to="/"
              className="btn-secondary inline-flex items-center gap-1.5 border border-border px-3 py-1.5"
            >
              ← Volver a pacientes
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {alergias.length > 0 && (
          <div className="bg-alert/10 border border-alert rounded-lg p-4 flex gap-3 items-start">
            <IconoAlerta />
            <div>
              <p className="font-semibold text-alert">Alergias registradas</p>
              <ul className="text-alert text-base list-disc list-inside">
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
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-primary text-accent-marino rounded-lg px-3 py-1.5 text-base font-semibold transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Editar
            </button>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-base">
            <Dato label="Fecha de nacimiento" value={formatFecha(paciente.fecha_nacimiento)} />
            <Dato label="Sexo / género" value={paciente.sexo} />
            <Dato label="Teléfono" value={paciente.telefono} />
            <Dato label="Dirección" value={paciente.direccion} />
            <Dato label="Contacto familiar" value={paciente.contacto_familiar} />
            <Dato label="Obra social" value={paciente.obra_social} />
            <Dato label="Grupo sanguíneo" value={paciente.grupo_sanguineo} />
            <Dato label="Ocupación" value={paciente.ocupacion} />
            <Dato label="Estado civil" value={paciente.estado_civil} />
          </dl>
        </section>

        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Consultas</h2>
            <button
              onClick={() => {
                setEditingConsulta(null)
                setShowModal(true)
              }}
              className="btn-primary px-3 py-1.5"
            >
              + Nueva consulta
            </button>
          </div>
          {consultas.length === 0 ? (
            <p className="text-base text-text-secondary">No hay consultas registradas.</p>
          ) : (
            <div className="space-y-4">
              {consultas.map((c) => (
                <ConsultaCard
                  key={c.id}
                  consulta={c}
                  documentos={documentos.filter((d) => d.consulta_id === c.id)}
                  onDocumentoSubido={(doc) => setDocumentos((prev) => [...prev, doc])}
                  onEditar={() => {
                    setEditingConsulta(c)
                    setShowModal(true)
                  }}
                  onEliminar={() => handleEliminarConsulta(c.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Antecedentes</h2>
            <button
              onClick={() => {
                setEditingAntecedente(null)
                setShowAntecedenteModal(true)
              }}
              className="btn-primary px-3 py-1.5"
            >
              + Agregar antecedente
            </button>
          </div>
          {antecedentes.length === 0 ? (
            <p className="text-base text-text-secondary">No hay antecedentes registrados.</p>
          ) : (
            <ul className="space-y-2">
              {antecedentes.map((a) => (
                <li key={a.id} className="text-base flex items-start justify-between gap-2">
                  <div className="flex gap-2">
                    <span className="shrink-0 bg-border/50 text-text-secondary rounded-md px-2 py-0.5 text-sm font-medium">
                      {TIPOS_ANTECEDENTE[a.tipo] || a.tipo}
                    </span>
                    <span className="text-text-primary">{a.descripcion}</span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => {
                        setEditingAntecedente(a)
                        setShowAntecedenteModal(true)
                      }}
                      className="text-sm text-text-secondary hover:text-text-primary underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminarAntecedente(a.id)}
                      className="text-sm text-alert hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-surface border border-border rounded-lg p-4 sm:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Laboratorio</h2>
            <button onClick={() => setShowLabModal(true)} className="btn-primary px-3 py-1.5">
              + Cargar resultados
            </button>
          </div>
          {resultadosLab.length === 0 ? (
            <p className="text-base text-text-secondary">No hay resultados de laboratorio cargados.</p>
          ) : (
            <div className="space-y-4">
              {TIPOS_EXAMEN.filter(({ nombre }) =>
                resultadosLab.some((r) => r.tipo_examen === nombre)
              ).map(({ nombre }) => (
                <div key={nombre}>
                  <h3 className="text-base font-semibold text-text-primary mb-1">{nombre}</h3>
                  <ul className="space-y-0.5">
                    {resultadosLab
                      .filter((r) => r.tipo_examen === nombre)
                      .map((r) => (
                        <li key={r.id} className="text-base text-text-primary flex gap-2">
                          <span className="text-text-secondary shrink-0">
                            {formatFecha(r.fecha)} —
                          </span>
                          <span>{r.resultado}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <NuevaConsultaModal
          pacienteId={id}
          consulta={editingConsulta}
          onClose={() => {
            setShowModal(false)
            setEditingConsulta(null)
          }}
          onSaved={handleConsultaGuardada}
        />
      )}

      {showAntecedenteModal && (
        <AntecedenteFormModal
          pacienteId={id}
          antecedente={editingAntecedente}
          onClose={() => {
            setShowAntecedenteModal(false)
            setEditingAntecedente(null)
          }}
          onSaved={handleAntecedenteGuardado}
        />
      )}

      {showEditModal && (
        <PacienteFormModal
          paciente={paciente}
          onClose={() => setShowEditModal(false)}
          onSaved={handlePacienteGuardado}
        />
      )}

      {showLabModal && (
        <LaboratorioFormModal
          pacienteId={id}
          onClose={() => setShowLabModal(false)}
          onCreated={handleResultadosCreados}
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
    <div className="border border-border rounded-lg p-4 space-y-3">
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
          <button onClick={onEliminar} className="text-sm text-alert hover:underline">
            Eliminar
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
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
