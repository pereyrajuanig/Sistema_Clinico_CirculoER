import { useState } from 'react'
import { exportarHistoriaClinica } from '@/lib/pdfExport'

// Selector "Completo"/"Resumen" pedido por RF-19 — no pide ningún profesional ni confirma
// nada en la base (es una exportación de lectura, no una mutación), así que no reusa
// ConfirmarConProfesionalModal ni auditoría: solo arma el PDF en el navegador y lo descarga.
export default function ExportarPdfModal({ datos, onClose }) {
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState('')

  async function elegir(variante) {
    setError('')
    setGenerando(variante)

    try {
      await exportarHistoriaClinica(variante, datos)
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo generar el PDF.')
    } finally {
      setGenerando('')
    }
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Exportar historia clínica</h2>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          <button
            type="button"
            onClick={() => elegir('completo')}
            disabled={Boolean(generando)}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{generando === 'completo' ? 'Generando...' : 'Completo'}</span>
            <span className="text-sm font-normal text-text-secondary">
              Todo el historial: antecedentes, patologías, medicación, consultas en orden
              cronológico y laboratorio.
            </span>
          </button>

          <button
            type="button"
            onClick={() => elegir('resumen')}
            disabled={Boolean(generando)}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{generando === 'resumen' ? 'Generando...' : 'Resumen'}</span>
            <span className="text-sm font-normal text-text-secondary">
              Datos básicos, patologías y medicación activas, alergias y últimos signos
              vitales.
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
