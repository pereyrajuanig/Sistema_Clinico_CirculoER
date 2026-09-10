import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import { formatearDni } from '@/lib/dni'

const LIMITE = 50

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

function formatFechaHora(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
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

// Feed global de las últimas consultas cargadas, de todos los pacientes juntas — para
// tener un pantallazo de lo que se va registrando sin tener que entrar paciente por
// paciente. Es de solo lectura a propósito: editar/eliminar una consulta sigue
// haciéndose únicamente desde la ficha del paciente (HistoriaClinica.jsx), donde ya
// está resuelta la auditoría y el selector de "¿quién edita?" — duplicar eso acá no
// aporta nada. `fecha` se usa para ordenar (no `created_at`): en consultas `fecha` se
// fija una sola vez al crear (`new Date().toISOString()`, ver NuevaConsultaModal.jsx) y
// nunca se toca en la edición, así que equivale al momento real de carga.
export default function UltimasConsultas() {
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchConsultas() {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('consultas')
        .select('*, pacientes(id, nombre, apellido, dni), profesionales!profesional_id(nombre)')
        .is('eliminado_en', null)
        .order('fecha', { ascending: false })
        .limit(LIMITE)

      setLoading(false)

      if (error) {
        setError(error.message)
        return
      }

      setConsultas(data)
    }

    fetchConsultas()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Últimas consultas"
        actions={[{ label: '← Volver a pacientes', to: '/', variant: 'secondary' }]}
      />

      <main className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        {error && <p className="text-base text-text-primary">{error}</p>}

        {loading ? (
          <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
        ) : consultas.length === 0 ? (
          <p className="p-10 text-center text-text-secondary text-base">
            Todavía no hay consultas cargadas.
          </p>
        ) : (
          <div className="space-y-4">
            {consultas.map((c) => (
              <ConsultaFeedCard key={c.id} consulta={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ConsultaFeedCard({ consulta: c }) {
  const vitales = signosVitales(c)

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <Link
          to={`/pacientes/${c.pacientes?.id}`}
          className="text-base font-semibold text-text-primary hover:underline"
        >
          {c.pacientes ? `${c.pacientes.apellido}, ${c.pacientes.nombre}` : 'Paciente'}
          {c.pacientes?.dni && (
            <span className="text-text-secondary font-normal"> — DNI {formatearDni(c.pacientes.dni)}</span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{formatFechaHora(c.fecha)}</span>
          <span className="text-sm text-text-secondary">
            Atendió: {c.profesionales?.nombre || 'sin asignar'}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
        {CAMPOS_CONSULTA.filter(([campo]) => c[campo]).map(([campo, label]) => (
          <div key={campo}>
            <dt className="text-text-secondary text-sm">{label}</dt>
            <dd className="text-text-primary">{c[campo]}</dd>
          </div>
        ))}
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
    </div>
  )
}
