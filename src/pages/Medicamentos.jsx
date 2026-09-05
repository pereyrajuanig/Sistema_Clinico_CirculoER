import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import MedicamentoFormModal from '@/components/MedicamentoFormModal'
import EntradaStockModal from '@/components/EntradaStockModal'
import SalidaStockModal from '@/components/SalidaStockModal'
import LotesMedicamentoModal from '@/components/LotesMedicamentoModal'
import ThemeToggle from '@/components/ThemeToggle'
import logo from '@/assets/Logo-Circulo_FondoTransparente.png'

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
  const [medicamentoCreado, setMedicamentoCreado] = useState(null)
  const [medicamentoIdParaEntrada, setMedicamentoIdParaEntrada] = useState('')
  const [editingMedicamento, setEditingMedicamento] = useState(null)
  const [medicamentoParaLotes, setMedicamentoParaLotes] = useState(null)

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

  function nombreMedicamento(medicamentoId) {
    return medicamentos.find((m) => m.id === medicamentoId)?.nombre || 'Medicamento'
  }

  function handleMedicamentoGuardado(guardado) {
    setMedicamentos((prev) => {
      const existe = prev.some((m) => m.id === guardado.id)
      const siguiente = existe
        ? prev.map((m) => (m.id === guardado.id ? guardado : m))
        : [...prev, guardado]
      return siguiente.sort((a, b) => a.nombre.localeCompare(b.nombre))
    })
    setShowMedicamentoModal(false)
    setEditingMedicamento(null)
    if (!editingMedicamento) setMedicamentoCreado(guardado)
  }

  async function handleToggleActivo(medicamento) {
    const activar = medicamento.activo === false

    if (!activar && !window.confirm(`¿Dar de baja "${medicamento.nombre}"? No va a poder elegirse para nuevas entradas de stock, pero sigue visible en el listado y en el historial.`)) {
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
      <header className="bg-surface border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <h1 className="text-4xl font-bold text-text-primary">Medicamentos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="btn-secondary border border-border px-3 py-1.5">
            ← Volver a pacientes
          </Link>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {error && <p className="text-base text-alert">{error}</p>}

        {(medicamentosBajoMinimo.length > 0 || lotesPorVencer.length > 0) && (
          <div className="bg-alert/10 border border-alert rounded-lg p-4 space-y-3">
            {medicamentosBajoMinimo.length > 0 && (
              <div>
                <p className="font-semibold text-alert">Stock por debajo del mínimo</p>
                <ul className="text-alert text-base list-disc list-inside">
                  {medicamentosBajoMinimo.map((m) => (
                    <li key={m.id}>
                      {m.nombre}: {stockPorMedicamento[m.id] || 0} (mínimo {m.stock_minimo})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lotesPorVencer.length > 0 && (
              <div>
                <p className="font-semibold text-alert">Lotes a 30 días o menos de vencer</p>
                <ul className="text-alert text-base list-disc list-inside">
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

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setEditingMedicamento(null)
              setShowMedicamentoModal(true)
            }}
            className="btn-primary"
          >
            + Nuevo medicamento
          </button>
          <button onClick={() => setShowEntradaModal(true)} className="btn-secondary border border-border">
            + Registrar entrada
          </button>
          <button onClick={() => setShowSalidaModal(true)} className="btn-secondary border border-border">
            + Registrar salida
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : medicamentos.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              Todavía no hay medicamentos cargados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Presentación</th>
                    <th className="px-4 py-3 font-medium">Stock total</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {medicamentos.map((m) => {
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
                        <td className="px-4 py-3 text-text-primary">{m.presentacion || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={bajoMinimo ? 'text-alert font-semibold' : 'text-text-primary'}>
                            {stock}
                          </span>
                          {bajoMinimo && (
                            <span className="ml-2 text-sm text-alert">(bajo el mínimo)</span>
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
                              className={inactivo ? 'text-sm text-text-secondary hover:text-text-primary underline' : 'text-sm text-alert hover:underline'}
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
          medicamentoNombre={medicamentoParaLotes.nombre}
          onClose={() => setMedicamentoParaLotes(null)}
          onCambio={fetchTodo}
        />
      )}

      {showEntradaModal && (
        <EntradaStockModal
          medicamentos={medicamentosActivos}
          medicamentoIdInicial={medicamentoIdParaEntrada}
          onClose={() => {
            setShowEntradaModal(false)
            setMedicamentoIdParaEntrada('')
          }}
          onRegistrado={() => {
            setMedicamentoIdParaEntrada('')
            handleMovimientoRegistrado(setShowEntradaModal)
          }}
        />
      )}

      {showSalidaModal && (
        <SalidaStockModal
          medicamentos={medicamentos}
          onClose={() => setShowSalidaModal(false)}
          onRegistrado={() => handleMovimientoRegistrado(setShowSalidaModal)}
        />
      )}

      {medicamentoCreado && (
        <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm p-6 text-center space-y-4">
            <p className="text-text-primary text-lg font-semibold">
              Medicamento cargado: {medicamentoCreado.nombre}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setMedicamentoCreado(null)} className="btn-secondary">
                Volver
              </button>
              <button
                onClick={() => {
                  setMedicamentoIdParaEntrada(medicamentoCreado.id)
                  setMedicamentoCreado(null)
                  setShowEntradaModal(true)
                }}
                className="btn-primary"
              >
                Registrar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
