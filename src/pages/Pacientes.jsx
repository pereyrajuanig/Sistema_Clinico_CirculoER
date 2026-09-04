import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import PacienteFormModal from '@/components/PacienteFormModal'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'
import { limpiarDni, formatearDni } from '@/lib/dni'
import ThemeToggle from '@/components/ThemeToggle'

export default function Pacientes() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [pacienteCreado, setPacienteCreado] = useState(null)
  const [sortField, setSortField] = useState('apellido')
  const [sortDirection, setSortDirection] = useState('asc')

  async function fetchPacientes() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .order('apellido')
      .order('nombre')

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setPacientes(data)
  }

  useEffect(() => {
    fetchPacientes()
  }, [])

  const pacientesFiltrados = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return pacientes

    const queryDni = limpiarDni(search)

    return pacientes.filter((p) => {
      const coincideTexto = [p.nombre, p.apellido].some((campo) =>
        campo?.toLowerCase().includes(query)
      )
      const coincideDni = queryDni && p.dni?.includes(queryDni)
      return coincideTexto || coincideDni
    })
  }, [pacientes, search])

  const pacientesOrdenados = useMemo(() => {
    const factor = sortDirection === 'asc' ? 1 : -1

    return [...pacientesFiltrados].sort((a, b) => {
      if (sortField === 'apellido') {
        return (
          factor * (a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre))
        )
      }
      return factor * (a[sortField] || '').localeCompare(b[sortField] || '')
    })
  }, [pacientesFiltrados, sortField, sortDirection])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function handleSaved(nuevoPaciente) {
    setPacientes((prev) =>
      [...prev, nuevoPaciente].sort(
        (a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre)
      )
    )
    setShowModal(false)
    setPacienteCreado(nuevoPaciente)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <h1 className="text-4xl font-bold text-text-primary">Pacientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={logout}
            className="bg-alert text-white rounded-lg px-3 py-1.5 text-base font-semibold transition-colors hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-alert focus:ring-offset-1"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input sm:max-w-xs"
          />
          <button onClick={() => setShowModal(true)} className="btn-primary">
            + Nuevo paciente
          </button>
        </div>

        {error && <p className="text-base text-alert">{error}</p>}

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando pacientes...</p>
          ) : pacientesFiltrados.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              {pacientes.length === 0
                ? 'Todavía no hay pacientes cargados.'
                : 'No se encontraron pacientes con esa búsqueda.'}
            </p>
          ) : (
            <>
              {/* Pantallas chicas: lista de tarjetas, más fácil de tocar que una tabla */}
              <ul className="sm:hidden divide-y divide-border">
                {pacientesOrdenados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/pacientes/${p.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-background"
                    >
                      <p className="text-base text-text-primary">
                        {p.apellido}, {p.nombre}
                      </p>
                      <p className="text-sm text-text-secondary mt-0.5">DNI {formatearDni(p.dni)}</p>
                      {(p.telefono || p.obra_social) && (
                        <p className="text-sm text-text-secondary mt-0.5">
                          {[p.telefono, p.obra_social].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Pantallas medianas y grandes: tabla completa y ordenable */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-border text-left text-text-secondary">
                      <SortableTh field="apellido" label="Apellido y nombre" sort={sortField} direction={sortDirection} onSort={toggleSort} />
                      <SortableTh field="dni" label="DNI" sort={sortField} direction={sortDirection} onSort={toggleSort} />
                      <SortableTh field="telefono" label="Teléfono" sort={sortField} direction={sortDirection} onSort={toggleSort} />
                      <SortableTh field="obra_social" label="Obra social" sort={sortField} direction={sortDirection} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesOrdenados.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/pacientes/${p.id}`)}
                        className="border-b border-border last:border-0 hover:bg-background cursor-pointer"
                      >
                        <td className="px-4 py-3 text-text-primary">
                          {p.apellido}, {p.nombre}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{formatearDni(p.dni)}</td>
                        <td className="px-4 py-3 text-text-primary">{p.telefono || '—'}</td>
                        <td className="px-4 py-3 text-text-primary">{p.obra_social || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {showModal && (
        <PacienteFormModal onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}

      {pacienteCreado && (
        <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm p-6 text-center space-y-4">
            <p className="text-text-primary text-lg font-semibold">
              Paciente cargado: {pacienteCreado.apellido}, {pacienteCreado.nombre}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setPacienteCreado(null)} className="btn-secondary">
                Volver
              </button>
              <button
                onClick={() =>
                  navigate(`/pacientes/${pacienteCreado.id}`, {
                    state: { abrirNuevaConsulta: true },
                  })
                }
                className="btn-primary"
              >
                Cargar consulta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableTh({ field, label, sort, direction, onSort }) {
  const activo = sort === field

  return (
    <th
      onClick={() => onSort(field)}
      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-text-primary"
    >
      {label}
      {activo && <span className="ml-1">{direction === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
}
