import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

function formatFecha(value) {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('es-AR', { dateStyle: 'medium' })
}

// YYYY-MM-DD en horario LOCAL — a propósito no usa toISOString().slice(0, 10), que
// convierte a UTC primero: en Argentina (UTC-3) eso puede devolver la fecha de mañana
// para cualquier hora de la noche, corriendo el rango un día — mismo tipo de bug que ya
// se cuidó en el resto de la app (ver formatFechaAR en src/lib/pdf.js).
function fechaLocalISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Consumo del mes (pedido explícito del cliente): pantalla aparte de Medicamentos.jsx,
// autocontenida — hace su propia consulta acotada (solo salidas del mes en curso, no todo
// el historial de movimientos_stock como HistorialMovimientos.jsx) en vez de reusar el
// estado de esa pantalla, porque acá alcanza con muchos menos datos.
export default function ConsumoDelMes() {
  const navigate = useNavigate()
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // El período se recalcula solo cada vez que se entra a esta pantalla (este componente
  // se remonta entero en cada navegación acá, así que calcularlo en el cuerpo del
  // componente ya cumple "se recalcula cada vez que se entra") — nunca hay selector de
  // fechas, a propósito.
  const primerDiaMes = fechaLocalISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const hoy = fechaLocalISO(new Date())

  useEffect(() => {
    async function fetchConsumo() {
      setLoading(true)
      setError('')

      // Sin cota superior a propósito: `fecha` se fija una sola vez al crear el
      // movimiento (siempre "ahora", nunca backdateable — ver NuevaConsultaModal.jsx/
      // SalidaStockModal.jsx), así que nunca puede haber un movimiento a futuro; "hasta
      // hoy" ya se cumple solo con filtrar desde el 1° del mes.
      const [movRes, stockRes] = await Promise.all([
        supabase
          .from('movimientos_stock')
          .select('cantidad, lotes!inner(medicamento_id, medicamentos(nombre, concentracion))')
          .eq('tipo', 'salida')
          .gte('fecha', `${primerDiaMes}T00:00:00`),
        supabase.from('stock_por_medicamento').select('medicamento_id, stock_total'),
      ])

      setLoading(false)

      const primerError = movRes.error || stockRes.error
      if (primerError) {
        setError(primerError.message)
        return
      }

      const stockPorMedicamento = Object.fromEntries(
        stockRes.data.map((s) => [s.medicamento_id, Number(s.stock_total)])
      )

      // Agrupa por medicamento — solo entran acá los que tuvieron al menos una salida en
      // el mes, porque el grupo se crea recién cuando aparece la primera fila que matchea
      const porMedicamento = new Map()
      movRes.data.forEach((m) => {
        const medicamentoId = m.lotes?.medicamento_id
        if (!porMedicamento.has(medicamentoId)) {
          porMedicamento.set(medicamentoId, {
            medicamentoId,
            nombre: m.lotes?.medicamentos?.nombre,
            concentracion: m.lotes?.medicamentos?.concentracion,
            totalSalida: 0,
          })
        }
        porMedicamento.get(medicamentoId).totalSalida += m.cantidad
      })

      const filasOrdenadas = [...porMedicamento.values()]
        .map((f) => ({ ...f, stockActual: stockPorMedicamento[f.medicamentoId] ?? 0 }))
        .sort((a, b) => b.totalSalida - a.totalSalida || a.nombre.localeCompare(b.nombre))

      setFilas(filasOrdenadas)
    }

    fetchConsumo()
  }, [primerDiaMes])

  function verReporteCompleto() {
    navigate('/medicamentos/historial', {
      state: { abrirReporteGeneral: true, desde: primerDiaMes, hasta: hoy },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Consumo del mes"
        subtitle={
          <p className="text-base font-medium text-text-primary truncate">
            Del {formatFecha(primerDiaMes)} al {formatFecha(hoy)}
          </p>
        }
        actions={[
          { label: '← Volver a historial de movimientos', to: '/medicamentos/historial', variant: 'secondary' },
        ]}
      />

      <main className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
        {error && <p className="text-base text-text-primary">{error}</p>}

        <div className="flex justify-end">
          <button type="button" onClick={verReporteCompleto} className="btn-secondary">
            Ver reporte completo en PDF
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
          ) : filas.length === 0 ? (
            <p className="p-10 text-center text-text-secondary text-base">
              Todavía no hubo salidas de stock este mes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Marca Comercial</th>
                    <th className="px-4 py-3 font-medium">Concentración</th>
                    <th className="px-4 py-3 font-medium">Salidas del mes</th>
                    <th className="px-4 py-3 font-medium">Stock actual</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.medicamentoId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-primary">{f.nombre}</td>
                      <td className="px-4 py-3 text-text-primary">{f.concentracion || '—'}</td>
                      <td className="px-4 py-3 text-text-primary font-semibold">{f.totalSalida}</td>
                      <td className="px-4 py-3 text-text-primary">{f.stockActual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
