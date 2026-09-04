import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import PacienteFormModal from '@/components/PacienteFormModal'

export default function Pacientes() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
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

    return pacientes.filter((p) =>
      [p.nombre, p.apellido, p.dni].some((campo) => campo?.toLowerCase().includes(query))
    )
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
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-slate-800">Pacientes</h1>
        <button onClick={logout} className="btn-secondary px-3 py-1.5">
          Cerrar sesión
        </button>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-slate-400 text-sm">Cargando pacientes...</p>
          ) : pacientesFiltrados.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">
              {pacientes.length === 0
                ? 'Todavía no hay pacientes cargados.'
                : 'No se encontraron pacientes con esa búsqueda.'}
            </p>
          ) : (
            <>
              {/* Pantallas chicas: lista de tarjetas, más fácil de tocar que una tabla */}
              <ul className="sm:hidden divide-y divide-slate-100">
                {pacientesOrdenados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/pacientes/${p.id}`)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      <p className="text-sm text-slate-800">
                        {p.apellido}, {p.nombre}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">DNI {p.dni}</p>
                      {(p.telefono || p.obra_social) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[p.telefono, p.obra_social].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Pantallas medianas y grandes: tabla completa y ordenable */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
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
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-slate-800">
                          {p.apellido}, {p.nombre}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.dni}</td>
                        <td className="px-4 py-3 text-slate-600">{p.telefono || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.obra_social || '—'}</td>
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
    </div>
  )
}

function SortableTh({ field, label, sort, direction, onSort }) {
  const activo = sort === field

  return (
    <th
      onClick={() => onSort(field)}
      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
    >
      {label}
      {activo && <span className="ml-1">{direction === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
}
