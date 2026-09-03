import { useAuth } from '@/lib/AuthContext'

export default function Pacientes() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-slate-800">Pacientes</h1>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="p-6">
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400">
          Acá va el listado de pacientes y el acceso a cada historia clínica.
          <br />
          Próximo paso de desarrollo.
        </div>
      </main>
    </div>
  )
}
