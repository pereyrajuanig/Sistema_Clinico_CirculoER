import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import PacienteFormModal from '@/components/PacienteFormModal'

export default function Pacientes() {
  const { logout } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

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

  function handleCreated(nuevoPaciente) {
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
        <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-800">
          Cerrar sesión
        </button>
      </header>

      <main className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input sm:max-w-xs"
          />
          <button
            onClick={() => setShowModal(true)}
            className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700"
          >
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Apellido y nombre</th>
                  <th className="px-4 py-3 font-medium">DNI</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Obra social</th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
          )}
        </div>
      </main>

      {showModal && (
        <PacienteFormModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
