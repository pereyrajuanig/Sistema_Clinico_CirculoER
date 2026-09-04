import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { formatearDni } from '@/lib/dni'
import ThemeToggle from '@/components/ThemeToggle'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

function formatFecha(value) {
  if (!value) return ''
  // new Date('2026-01-15') se interpreta en UTC — sumamos el offset para no mostrar el día anterior
  const fecha = new Date(value + 'T00:00:00')
  return fecha.toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

function estaVencido(proximoControl) {
  const hoy = new Date().toISOString().slice(0, 10)
  return proximoControl < hoy
}

export default function ProximosControles() {
  const [controles, setControles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchControles() {
      setLoading(true)
      setError('')

      // Traemos todas las consultas ordenadas por fecha descendente: la primera que
      // aparece para cada paciente es su consulta más reciente
      const { data, error } = await supabase
        .from('consultas')
        .select('paciente_id, fecha, proximo_control, pacientes(nombre, apellido, telefono, dni)')
        .order('fecha', { ascending: false })

      setLoading(false)

      if (error) {
        setError(error.message)
        return
      }

      const vistos = new Set()
      const ultimaPorPaciente = []

      for (const consulta of data) {
        if (vistos.has(consulta.paciente_id)) continue
        vistos.add(consulta.paciente_id)
        if (consulta.proximo_control) ultimaPorPaciente.push(consulta)
      }

      ultimaPorPaciente.sort((a, b) => a.proximo_control.localeCompare(b.proximo_control))

      setControles(ultimaPorPaciente)
    }

    fetchControles()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <h1 className="text-4xl font-bold text-text-primary">Próximos controles</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="btn-secondary border border-border px-3 py-1.5">
            ← Volver a pacientes
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        {error && <p className="text-base text-alert">{error}</p>}

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : controles.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              No hay controles pendientes — ningún paciente tiene un próximo control cargado
              en su consulta más reciente.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {controles.map((c) => (
                <li key={c.paciente_id} className="p-4 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <Link
                      to={`/pacientes/${c.paciente_id}`}
                      className="text-base font-semibold text-text-primary hover:underline"
                    >
                      {c.pacientes?.apellido}, {c.pacientes?.nombre}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      DNI {formatearDni(c.pacientes?.dni)}
                      {c.pacientes?.telefono && ` · Tel: ${c.pacientes.telefono}`}
                    </p>
                  </div>
                  <span
                    className={
                      'text-sm font-semibold rounded-md px-2 py-1 ' +
                      (estaVencido(c.proximo_control)
                        ? 'bg-alert/10 text-alert border border-alert'
                        : 'bg-background text-text-primary border border-border')
                    }
                  >
                    {estaVencido(c.proximo_control) ? 'Vencido: ' : 'Control: '}
                    {formatFecha(c.proximo_control)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
