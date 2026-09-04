import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import NuevaConsultaModal from '@/components/NuevaConsultaModal'

const TIPOS_ANTECEDENTE = {
  alergia: 'Alergia',
  patologico: 'Patológico',
  quirurgico: 'Quirúrgico',
  familiar: 'Familiar / hereditario',
  habito: 'Hábito',
  vacuna: 'Vacuna',
  medicacion_cronica: 'Medicación crónica',
}

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
  const [paciente, setPaciente] = useState(null)
  const [antecedentes, setAntecedentes] = useState([])
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      setError('')

      const [pacienteRes, antecedentesRes, consultasRes] = await Promise.all([
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
      ])

      setLoading(false)

      const primerError = pacienteRes.error || antecedentesRes.error || consultasRes.error
      if (primerError) {
        setError(primerError.message)
        return
      }

      setPaciente(pacienteRes.data)
      setAntecedentes(antecedentesRes.data)
      setConsultas(consultasRes.data)
    }

    fetchAll()
  }, [id])

  function handleConsultaCreada(nuevaConsulta) {
    setConsultas((prev) =>
      [nuevaConsulta, ...prev].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    )
    setShowModal(false)
  }

  if (loading) {
    return <p className="p-10 text-center text-slate-400 text-sm">Cargando historia clínica...</p>
  }

  if (error) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 underline">
          Volver a pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
          ← Volver a pacientes
        </Link>
        <h1 className="text-lg font-semibold text-slate-800 mt-1">
          {paciente.apellido}, {paciente.nombre}
        </h1>
        <p className="text-sm text-slate-500">DNI {paciente.dni}</p>
      </header>

      <main className="p-6 space-y-6 max-w-4xl mx-auto">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Datos del paciente</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Antecedentes</h2>
          {antecedentes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay antecedentes registrados.</p>
          ) : (
            <ul className="space-y-2">
              {antecedentes.map((a) => (
                <li key={a.id} className="text-sm flex gap-2">
                  <span className="shrink-0 bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 text-xs font-medium">
                    {TIPOS_ANTECEDENTE[a.tipo] || a.tipo}
                  </span>
                  <span className="text-slate-700">{a.descripcion}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Consultas</h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-slate-800 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
            >
              + Nueva consulta
            </button>
          </div>
          {consultas.length === 0 ? (
            <p className="text-sm text-slate-400">No hay consultas registradas.</p>
          ) : (
            <div className="space-y-4">
              {consultas.map((c) => (
                <ConsultaCard key={c.id} consulta={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <NuevaConsultaModal
          pacienteId={id}
          onClose={() => setShowModal(false)}
          onCreated={handleConsultaCreada}
        />
      )}
    </div>
  )
}

function Dato({ label, value }) {
  return (
    <div>
      <dt className="text-slate-400 text-xs">{label}</dt>
      <dd className="text-slate-700">{value || '—'}</dd>
    </div>
  )
}

function ConsultaCard({ consulta: c }) {
  const vitales = signosVitales(c)

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <span className="text-sm font-medium text-slate-800">
          {formatFecha(c.fecha, { dateStyle: 'medium' })}
        </span>
        <span className="text-xs text-slate-500">
          Atendió: {c.profesionales?.nombre || 'sin asignar'}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {CAMPOS_CONSULTA.filter(([campo]) => c[campo]).map(([campo, label]) => (
          <div key={campo}>
            <dt className="text-slate-400 text-xs">{label}</dt>
            <dd className="text-slate-700">{c[campo]}</dd>
          </div>
        ))}
        {c.proximo_control && (
          <div>
            <dt className="text-slate-400 text-xs">Próximo control</dt>
            <dd className="text-slate-700">{formatFecha(c.proximo_control)}</dd>
          </div>
        )}
      </dl>

      {vitales.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {vitales.map(([label, value]) => (
            <span
              key={label}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-600"
            >
              {label}: {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
