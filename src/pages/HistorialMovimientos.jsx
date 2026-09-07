import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { limpiarDni } from '@/lib/dni'
import { identificarMedicamento } from '@/lib/medicamentos'
import CorregirMovimientoModal from '@/components/CorregirMovimientoModal'
import ThemeToggle from '@/components/ThemeToggle'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

function formatFechaHora(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

// Calcula el saldo acumulado de stock, por medicamento, recorriendo los movimientos en
// orden cronológico — mezclar el saldo de medicamentos distintos no tendría sentido
function conSaldoPorMedicamento(movimientosAsc) {
  const saldoPorMedicamento = {}

  return movimientosAsc.map((m) => {
    const medicamentoId = m.lotes?.medicamento_id
    const saldoActual = saldoPorMedicamento[medicamentoId] || 0
    const nuevoSaldo = saldoActual + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad)
    saldoPorMedicamento[medicamentoId] = nuevoSaldo
    return { ...m, saldo: nuevoSaldo }
  })
}

export default function HistorialMovimientos() {
  const [medicamentos, setMedicamentos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroMedicamento, setFiltroMedicamento] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [movimientoACorregir, setMovimientoACorregir] = useState(null)

  async function fetchTodo() {
    setLoading(true)
    setError('')

    const [medRes, movRes] = await Promise.all([
      supabase.from('medicamentos').select('id, nombre, concentracion').order('nombre'),
      // Orden ascendente para poder calcular el saldo acumulado antes de mostrarlo
      // del más reciente al más viejo
      supabase
        .from('movimientos_stock')
        .select(
          'id, lote_id, tipo, cantidad, fecha, motivo, lotes!inner(numero_lote, fecha_vencimiento, medicamento_id, medicamentos(nombre, concentracion)), profesionales(nombre), pacientes(id, nombre, apellido, dni), consultas(id, fecha)'
        )
        .order('fecha', { ascending: true }),
    ])

    setLoading(false)

    const primerError = medRes.error || movRes.error
    if (primerError) {
      setError(primerError.message)
      return
    }

    setMedicamentos(medRes.data)
    setMovimientos(conSaldoPorMedicamento(movRes.data))
  }

  useEffect(() => {
    fetchTodo()
  }, [])

  const movimientosFiltrados = useMemo(() => {
    const busquedaTexto = busqueda.trim().toLowerCase()
    const busquedaDni = limpiarDni(busqueda)

    return movimientos
      .filter((m) => !filtroMedicamento || m.lotes?.medicamento_id === filtroMedicamento)
      .filter((m) => !filtroTipo || m.tipo === filtroTipo)
      .filter((m) => !filtroDesde || m.fecha.slice(0, 10) >= filtroDesde)
      .filter((m) => !filtroHasta || m.fecha.slice(0, 10) <= filtroHasta)
      .filter((m) => {
        if (!busquedaTexto) return true
        const coincideRegistro = m.profesionales?.nombre?.toLowerCase().includes(busquedaTexto)
        const coincideDni = busquedaDni && m.pacientes?.dni?.includes(busquedaDni)
        return coincideRegistro || coincideDni
      })
      .slice()
      .reverse()
  }, [movimientos, filtroMedicamento, filtroTipo, filtroDesde, filtroHasta, busqueda])

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <h1 className="text-4xl font-bold text-text-primary">Historial de movimientos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/medicamentos" className="btn-secondary px-3 py-1.5">
            ← Volver a medicamentos
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4">
        {error && <p className="text-base text-text-primary">{error}</p>}

        <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1 w-full sm:w-auto sm:max-w-50">
            <label className="text-sm text-text-secondary">Buscar (DNI o quién registró)</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: 12345678 o Juan Pereyra"
              className="input"
            />
          </div>

          <div className="space-y-1 w-full sm:w-auto sm:max-w-45">
            <label className="text-sm text-text-secondary">Medicamento</label>
            <select
              value={filtroMedicamento}
              onChange={(e) => setFiltroMedicamento(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              {medicamentos.map((m) => (
                <option key={m.id} value={m.id}>
                  {identificarMedicamento(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-full sm:w-auto sm:max-w-32.5">
            <label className="text-sm text-text-secondary">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input"
            >
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </div>

          <div className="space-y-1 w-full sm:w-auto">
            <label className="text-sm text-text-secondary">Desde</label>
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
              className="input sm:w-40"
            />
          </div>

          <div className="space-y-1 w-full sm:w-auto">
            <label className="text-sm text-text-secondary">Hasta</label>
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => setFiltroHasta(e.target.value)}
              className="input sm:w-40"
            />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : movimientosFiltrados.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              {movimientos.length === 0
                ? 'Todavía no hay movimientos de stock registrados.'
                : 'No hay movimientos que coincidan con el filtro.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Fecha y hora</th>
                    <th className="px-4 py-3 font-medium">Medicamento</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Lote</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Registró</th>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Consulta</th>
                    <th className="px-4 py-3 font-medium">Motivo</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-primary whitespace-nowrap">
                        {formatFechaHora(m.fecha)}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {identificarMedicamento(m.lotes?.medicamentos) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'text-sm font-semibold rounded-md px-2 py-1 border ' +
                            (m.tipo === 'entrada'
                              ? 'bg-success/10 border-success text-text-primary'
                              : 'bg-alert/10 border-alert text-text-primary')
                          }
                        >
                          {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary whitespace-nowrap">
                        {m.lotes?.numero_lote || 'Sin número'} — vence{' '}
                        {formatFecha(m.lotes?.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-3 text-text-primary">{m.cantidad}</td>
                      <td className="px-4 py-3 text-text-primary">{m.saldo}</td>
                      <td className="px-4 py-3 text-text-primary">
                        {m.profesionales?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {m.pacientes ? (
                          <Link to={`/pacientes/${m.pacientes.id}`} className="hover:underline">
                            {m.pacientes.apellido}, {m.pacientes.nombre}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {m.consultas && m.pacientes ? (
                          <Link to={`/pacientes/${m.pacientes.id}`} className="hover:underline">
                            Consulta del {formatFecha(m.consultas.fecha.slice(0, 10))}
                          </Link>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-primary">{m.motivo || '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setMovimientoACorregir(m)}
                          className="text-sm text-text-secondary hover:text-text-primary underline whitespace-nowrap"
                        >
                          Corregir este movimiento
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {movimientoACorregir && (
        <CorregirMovimientoModal
          movimiento={movimientoACorregir}
          onClose={() => setMovimientoACorregir(null)}
          onRegistrado={() => {
            setMovimientoACorregir(null)
            fetchTodo()
          }}
        />
      )}
    </div>
  )
}
