import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MedicamentoFormModal from '@/components/MedicamentoFormModal'
import LotesMedicamentoModal from '@/components/LotesMedicamentoModal'
import Header from '@/components/Header'
import { formatearPresentacion, identificarMedicamento } from '@/lib/medicamentos'

// Lista separada de los medicamentos dados de baja (activo = false) — antes se mostraban
// mezclados en la tabla principal de /medicamentos con una etiqueta "(dado de baja)", pero
// eso ensuciaba el listado del día a día. Acá siguen totalmente accesibles (editar, ver
// lotes, reactivar) porque un medicamento inactivo no pierde su historial — solo no puede
// elegirse para nuevas entradas de stock (ver reglas de CRUD de medicamentos en CLAUDE.md).
export default function MedicamentosInactivos() {
  const [medicamentos, setMedicamentos] = useState([])
  const [stockPorMedicamento, setStockPorMedicamento] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMedicamentoModal, setShowMedicamentoModal] = useState(false)
  const [editingMedicamento, setEditingMedicamento] = useState(null)
  const [medicamentoParaLotes, setMedicamentoParaLotes] = useState(null)

  async function fetchTodo() {
    setLoading(true)
    setError('')

    const [medsRes, stockRes] = await Promise.all([
      supabase.from('medicamentos').select('*').eq('activo', false).order('nombre'),
      supabase.from('stock_por_medicamento').select('*'),
    ])

    setLoading(false)

    const primerError = medsRes.error || stockRes.error
    if (primerError) {
      setError(primerError.message)
      return
    }

    const stockMap = Object.fromEntries(
      stockRes.data.map((s) => [s.medicamento_id, Number(s.stock_total)])
    )

    setMedicamentos(medsRes.data)
    setStockPorMedicamento(stockMap)
  }

  useEffect(() => {
    fetchTodo()
  }, [])

  // MedicamentoFormModal nunca toca `activo` (no tiene ese campo) — reactivar es un
  // botón aparte acá abajo, así que un guardado siempre sigue siendo inactivo
  function handleMedicamentoGuardado(guardado) {
    setMedicamentos((prev) =>
      prev.map((m) => (m.id === guardado.id ? guardado : m)).sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
    setShowMedicamentoModal(false)
    setEditingMedicamento(null)
  }

  async function handleReactivar(medicamento) {
    if (!window.confirm(`¿Reactivar "${identificarMedicamento(medicamento)}"? Vuelve a poder elegirse para nuevas entradas de stock y reaparece en el listado principal.`)) {
      return
    }

    const { data, error } = await supabase
      .from('medicamentos')
      .update({ activo: true })
      .eq('id', medicamento.id)
      .select()
      .single()

    if (error) {
      setError(error.message)
      return
    }

    setMedicamentos((prev) => prev.filter((m) => m.id !== data.id))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Medicamentos dados de baja"
        actions={[{ label: '← Volver a medicamentos', to: '/medicamentos', variant: 'secondary' }]}
      />

      <main className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {error && <p className="text-base text-text-primary">{error}</p>}

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : medicamentos.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              No hay medicamentos dados de baja.
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
                  {medicamentos.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-primary">{m.nombre}</td>
                      <td className="px-4 py-3 text-text-primary">{m.concentracion || '—'}</td>
                      <td className="px-4 py-3 text-text-primary">{m.droga || '—'}</td>
                      <td className="px-4 py-3 text-text-primary">{formatearPresentacion(m) || '—'}</td>
                      <td className="px-4 py-3 text-text-primary">{stockPorMedicamento[m.id] || 0}</td>
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
                            onClick={() => handleReactivar(m)}
                            className="text-sm text-text-secondary hover:text-text-primary underline"
                          >
                            Reactivar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </div>
  )
}
