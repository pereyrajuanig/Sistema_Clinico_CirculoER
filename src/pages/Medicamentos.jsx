import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MedicamentoFormModal from '@/components/MedicamentoFormModal'
import EntradaStockModal from '@/components/EntradaStockModal'
import SalidaStockModal from '@/components/SalidaStockModal'
import LotesMedicamentoModal from '@/components/LotesMedicamentoModal'
import Header from '@/components/Header'
import { formatearPresentacion, identificarMedicamento } from '@/lib/medicamentos'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

function diasHastaLimite(dias) {
  const limite = new Date()
  limite.setDate(limite.getDate() + dias)
  return limite.toISOString().slice(0, 10)
}

export default function Medicamentos() {
  const [medicamentos, setMedicamentos] = useState([])
  const [stockPorMedicamento, setStockPorMedicamento] = useState({})
  const [lotesPorVencer, setLotesPorVencer] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMedicamentoModal, setShowMedicamentoModal] = useState(false)
  const [showEntradaModal, setShowEntradaModal] = useState(false)
  const [showSalidaModal, setShowSalidaModal] = useState(false)
  const [editingMedicamento, setEditingMedicamento] = useState(null)
  const [medicamentoParaLotes, setMedicamentoParaLotes] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  async function fetchTodo() {
    setLoading(true)
    setError('')

    const [medsRes, stockRes, lotesRes] = await Promise.all([
      supabase.from('medicamentos').select('*').order('nombre'),
      supabase.from('stock_por_medicamento').select('*'),
      supabase
        .from('stock_por_lote')
        .select('*')
        .gt('stock_actual', 0)
        .lte('fecha_vencimiento', diasHastaLimite(30))
        .order('fecha_vencimiento', { ascending: true }),
    ])

    setLoading(false)

    const primerError = medsRes.error || stockRes.error || lotesRes.error
    if (primerError) {
      setError(primerError.message)
      return
    }

    const stockMap = Object.fromEntries(
      stockRes.data.map((s) => [s.medicamento_id, Number(s.stock_total)])
    )

    setMedicamentos(medsRes.data)
    setStockPorMedicamento(stockMap)
    setLotesPorVencer(lotesRes.data)
  }

  useEffect(() => {
    fetchTodo()
  }, [])

  const medicamentosBajoMinimo = medicamentos.filter(
    (m) => m.activo !== false && m.stock_minimo != null && (stockPorMedicamento[m.id] || 0) < m.stock_minimo
  )

  const medicamentosActivos = medicamentos.filter((m) => m.activo !== false)

  // Busca por marca comercial (nombre) o droga — las alertas de arriba siguen mirando
  // TODOS los medicamentos, esto solo filtra lo que se ve en la tabla
  const medicamentosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase()
    if (!query) return medicamentos

    return medicamentos.filter(
      (m) => m.nombre?.toLowerCase().includes(query) || m.droga?.toLowerCase().includes(query)
    )
  }, [medicamentos, busqueda])

  function nombreMedicamento(medicamentoId) {
    return identificarMedicamento(medicamentos.find((m) => m.id === medicamentoId)) || 'Medicamento'
  }

  function handleMedicamentoGuardado(guardado) {
    setMedicamentos((prev) =>
      prev
        .map((m) => (m.id === guardado.id ? guardado : m))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
    setShowMedicamentoModal(false)
    setEditingMedicamento(null)
  }

  async function handleToggleActivo(medicamento) {
    const activar = medicamento.activo === false

    if (!activar && !window.confirm(`¿Dar de baja "${identificarMedicamento(medicamento)}"? No va a poder elegirse para nuevas entradas de stock, pero sigue visible en el listado y en el historial.`)) {
      return
    }

    const { data, error } = await supabase
      .from('medicamentos')
      .update({ activo: activar })
      .eq('id', medicamento.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }

    setMedicamentos((prev) => prev.map((m) => (m.id === data.id ? data : m)))
  }

  function handleMovimientoRegistrado(cerrarModal) {
    cerrarModal(false)
    fetchTodo()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Medicamentos"
        navLink={{
          label: 'Historial de movimientos',
          to: '/medicamentos/historial',
          variant: 'accent',
        }}
        actions={[{ label: '← Volver a pacientes', to: '/', variant: 'secondary' }]}
      />

      <main className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {error && <p className="text-base text-text-primary">{error}</p>}

        {(medicamentosBajoMinimo.length > 0 || lotesPorVencer.length > 0) && (
          <div className="bg-alert/10 border border-alert rounded-lg p-4 space-y-3">
            {medicamentosBajoMinimo.length > 0 && (
              <div>
                <p className="font-semibold text-text-primary">Stock por debajo del mínimo</p>
                <ul className="text-text-primary text-base list-disc list-inside">
                  {medicamentosBajoMinimo.map((m) => (
                    <li key={m.id}>
                      {identificarMedicamento(m)}: {stockPorMedicamento[m.id] || 0} (mínimo {m.stock_minimo})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lotesPorVencer.length > 0 && (
              <div>
                <p className="font-semibold text-text-primary">Lotes a 30 días o menos de vencer</p>
                <ul className="text-text-primary text-base list-disc list-inside">
                  {lotesPorVencer.map((l) => (
                    <li key={l.lote_id}>
                      {nombreMedicamento(l.medicamento_id)}
                      {l.numero_lote ? ` — Lote ${l.numero_lote}` : ' — sin número de lote'} — vence{' '}
                      {formatFecha(l.fecha_vencimiento)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Buscar por marca comercial o droga..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowEntradaModal(true)} className="btn-primary">
              + Nuevo medicamento
            </button>
            <button onClick={() => setShowSalidaModal(true)} className="btn-secondary">
              + Registrar salida
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : medicamentosFiltrados.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              {medicamentos.length === 0
                ? 'Todavía no hay medicamentos cargados.'
                : 'No se encontraron medicamentos con esa búsqueda.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Marca Comercial</th>
                    <th className="px-4 py-3 font-medium">Concentración</th>
                    <th className="px-4 py-3 font-medium">Droga</th>
                    <th className="px-4 py-3 font-medium">Presentación</th>
                    <th className="px-4 py-3 font-medium">Stock total</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {medicamentosFiltrados.map((m) => {
                    const stock = stockPorMedicamento[m.id] || 0
                    const inactivo = m.activo === false
                    const bajoMinimo = !inactivo && m.stock_minimo != null && stock < m.stock_minimo

                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-primary">
                          {m.nombre}
                          {inactivo && (
                            <span className="ml-2 text-sm text-text-secondary">(dado de baja)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{m.concentracion || '—'}</td>
                        <td className="px-4 py-3 text-text-primary">{m.droga || '—'}</td>
                        <td className="px-4 py-3 text-text-primary">{formatearPresentacion(m) || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={bajoMinimo ? 'text-text-primary font-semibold' : 'text-text-primary'}>
                            {stock}
                          </span>
                          {bajoMinimo && (
                            <span className="ml-2 text-sm text-text-primary">(bajo el mínimo)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => {
                                setEditingMedicamento(m)
                                setShowMedicamentoModal(true)
                              }}
                              className="text-sm text-text-secondary hover:text-text-primary underline"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setMedicamentoParaLotes(m)}
                              className="text-sm text-text-secondary hover:text-text-primary underline"
                            >
                              Ver lotes
                            </button>
                            <button
                              onClick={() => handleToggleActivo(m)}
                              className={inactivo ? 'text-sm text-text-secondary hover:text-text-primary underline' : 'text-sm text-text-primary underline'}
                            >
                              {inactivo ? 'Reactivar' : 'Dar de baja'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showMedicamentoModal && (
        <MedicamentoFormModal
          medicamento={editingMedicamento}
          onClose={() => {
            setShowMedicamentoModal(false)
            setEditingMedicamento(null)
          }}
          onSaved={handleMedicamentoGuardado}
        />
      )}

      {medicamentoParaLotes && (
        <LotesMedicamentoModal
          medicamentoId={medicamentoParaLotes.id}
          medicamentoNombre={identificarMedicamento(medicamentoParaLotes)}
          onClose={() => setMedicamentoParaLotes(null)}
          onCambio={fetchTodo}
        />
      )}

      {showEntradaModal && (
        <EntradaStockModal
          medicamentos={medicamentosActivos}
          onClose={() => setShowEntradaModal(false)}
          onRegistrado={() => handleMovimientoRegistrado(setShowEntradaModal)}
        />
      )}

      {showSalidaModal && (
        <SalidaStockModal
          medicamentos={medicamentos}
          onClose={() => setShowSalidaModal(false)}
          onRegistrado={() => handleMovimientoRegistrado(setShowSalidaModal)}
        />
      )}
    </div>
  )
}
