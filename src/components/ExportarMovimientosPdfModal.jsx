import { useState } from 'react'
import { identificarMedicamento } from '@/lib/medicamentos'
import { exportarHistorialMedicamento, exportarReporteGeneral } from '@/lib/pdfExportMedicamentos'

// Selector unificado, mismo patrón que ExportarPdfModal.jsx (historia clínica del
// paciente) — un solo botón de entrada ("Exportar PDF") en HistorialMovimientos.jsx que
// abre este modal con las dos variantes a elegir, en vez de dos botones sueltos en
// distintos lugares de la pantalla. La variante "Reporte general" necesita un dato más
// (el rango de fechas) que la de "Historial de este medicamento" no pide — en vez de un
// segundo modal aparte, se resuelve como un segundo paso ADENTRO del mismo modal
// (`paso === 'reporteGeneral'`), mismo criterio de disclosure progresivo que ya usa
// "+ Agregar medicamento nuevo" en EntradaStockModal.jsx.
export default function ExportarMovimientosPdfModal({
  medicamento,
  movimientos,
  movimientosFiltrados,
  filtros,
  onClose,
}) {
  const [paso, setPaso] = useState('elegir')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  async function exportarHistorial() {
    if (!medicamento) return

    setError('')
    setGenerando(true)

    try {
      await exportarHistorialMedicamento({ medicamento, movimientos: movimientosFiltrados, filtros })
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo generar el PDF.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleSubmitReporteGeneral(e) {
    e.preventDefault()
    setError('')

    if (!desde || !hasta) {
      setError('Elegí las dos fechas del rango antes de generar el PDF.')
      return
    }
    if (desde > hasta) {
      setError('"Desde" no puede ser posterior a "Hasta".')
      return
    }

    setGenerando(true)

    try {
      const enRango = movimientos.filter(
        (m) => m.fecha.slice(0, 10) >= desde && m.fecha.slice(0, 10) <= hasta
      )
      await exportarReporteGeneral({ movimientos: enRango, desde, hasta })
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo generar el PDF.')
    } finally {
      setGenerando(false)
    }
  }

  if (paso === 'reporteGeneral') {
    return (
      <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
        <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
          <form onSubmit={handleSubmitReporteGeneral}>
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Reporte general de movimientos</h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <p className="text-sm text-text-secondary">
                Incluye todos los medicamentos con movimientos en el rango elegido —también
                los dados de baja— agrupados, con un resumen y un ranking de consumo al
                final.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">
                    Desde <span className="text-text-primary">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">
                    Hasta <span className="text-text-primary">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

            <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-between gap-3">
              <button type="button" onClick={() => setPaso('elegir')} className="btn-secondary">
                ‹ Volver
              </button>
              <button type="submit" disabled={generando} className="btn-primary">
                {generando ? 'Generando...' : 'Generar PDF'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Exportar movimientos de stock</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          <button
            type="button"
            onClick={exportarHistorial}
            disabled={!medicamento || generando}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{generando ? 'Generando...' : 'Historial de este medicamento'}</span>
            <span className="text-sm font-normal text-text-secondary">
              {medicamento
                ? `Exporta exactamente lo filtrado en pantalla para ${identificarMedicamento(medicamento)} (mismo tipo y rango de fechas ya aplicados).`
                : 'Elegí un medicamento en el filtro de arriba para habilitar esta opción.'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPaso('reporteGeneral')}
            disabled={generando}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Reporte general</span>
            <span className="text-sm font-normal text-text-secondary">
              Todos los medicamentos con movimientos en un rango de fechas a elegir, con
              ranking de consumo.
            </span>
          </button>

          {error && <p className="text-base text-text-primary">{error}</p>}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
