import { useState } from 'react'
import { exportarReporteGeneral } from '@/lib/pdfExportMedicamentos'

// Rango de fechas obligatorio pedido explícitamente para el reporte general — a diferencia
// de la Variante 1 (ligada a un medicamento puntual, exporta lo que ya está filtrado en
// pantalla), esta no depende de ningún filtro de HistorialMovimientos.jsx: siempre pide su
// propio rango acá.
export default function ReporteGeneralPdfModal({ movimientos, onClose }) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  async function handleSubmit(e) {
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

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Reporte general de movimientos</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-text-secondary">
              Incluye todos los medicamentos con movimientos en el rango elegido —también los
              dados de baja— agrupados, con un resumen y un ranking de consumo al final.
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

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
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
