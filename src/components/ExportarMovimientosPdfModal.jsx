import { useState } from 'react'
import { identificarMedicamento } from '@/lib/medicamentos'
import { exportarHistorialMedicamento, exportarReporteGeneral } from '@/lib/pdfExportMedicamentos'

const initialFiltro = { medicamentoId: '', tipo: '', desde: '', hasta: '' }

// Mismo criterio que movimientosFiltrados en HistorialMovimientos.jsx (medicamento + tipo +
// rango de fechas), sin la búsqueda por DNI/quién registró — esa es una conveniencia de la
// tabla en pantalla, no tiene sentido acá donde el filtro es independiente de la pantalla de
// fondo. Devuelve en el mismo orden que se ve en pantalla (más reciente primero).
function filtrarMovimientos(movimientos, { medicamentoId, tipo, desde, hasta }) {
  return movimientos
    .filter((m) => m.lotes?.medicamento_id === medicamentoId)
    .filter((m) => !tipo || m.tipo === tipo)
    .filter((m) => !desde || m.fecha.slice(0, 10) >= desde)
    .filter((m) => !hasta || m.fecha.slice(0, 10) <= hasta)
    .slice()
    .reverse()
}

// Selector unificado, mismo patrón que ExportarPdfModal.jsx (historia clínica del
// paciente) — un solo botón de entrada ("Exportar PDF") en HistorialMovimientos.jsx que
// abre este modal con las dos variantes a elegir, en vez de dos botones sueltos en
// distintos lugares de la pantalla. Las dos variantes necesitan datos que el primer paso no
// tiene (qué medicamento en un caso, qué rango de fechas en el otro) — en vez de modales
// aparte, cada una es un segundo paso ADENTRO del mismo modal (`paso`), mismo criterio de
// disclosure progresivo que ya usa "+ Agregar medicamento nuevo" en EntradaStockModal.jsx.
//
// Ninguna de las dos variantes depende de los filtros que estén puestos en
// HistorialMovimientos.jsx en ese momento — el medicamento/tipo/fechas se eligen de nuevo
// acá adentro. `filtroInicial` solo se usa para PRECARGAR el formulario de "Historial de
// este medicamento" con lo que ya estaba filtrado en pantalla, como conveniencia — no como
// una dependencia real (se puede cambiar todo, incluido el medicamento, sin salir del modal).
export default function ExportarMovimientosPdfModal({ medicamentos, movimientos, filtroInicial, onClose }) {
  const [paso, setPaso] = useState('elegir')
  const [filtro, setFiltro] = useState({ ...initialFiltro, ...filtroInicial })
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)

  function handleChangeFiltro(campo) {
    return (e) => setFiltro((prev) => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleSubmitHistorial(e) {
    e.preventDefault()
    setError('')

    const medicamento = medicamentos.find((m) => m.id === filtro.medicamentoId)
    if (!medicamento) {
      setError('Elegí un medicamento antes de generar el PDF.')
      return
    }

    setGenerando(true)

    try {
      await exportarHistorialMedicamento({
        medicamento,
        movimientos: filtrarMovimientos(movimientos, filtro),
        filtros: { tipo: filtro.tipo, desde: filtro.desde, hasta: filtro.hasta },
      })
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

  if (paso === 'historialMedicamento') {
    return (
      <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
        <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-sm">
          <form onSubmit={handleSubmitHistorial}>
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Historial de un medicamento</h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Medicamento <span className="text-text-primary">*</span>
                </label>
                <select
                  required
                  value={filtro.medicamentoId}
                  onChange={handleChangeFiltro('medicamentoId')}
                  className="input"
                >
                  <option value="" disabled>
                    Elegir medicamento...
                  </option>
                  {medicamentos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {identificarMedicamento(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary">Tipo</label>
                <select value={filtro.tipo} onChange={handleChangeFiltro('tipo')} className="input">
                  <option value="">Todos</option>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Desde</label>
                  <input
                    type="date"
                    value={filtro.desde}
                    onChange={handleChangeFiltro('desde')}
                    className="input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Hasta</label>
                  <input
                    type="date"
                    value={filtro.hasta}
                    onChange={handleChangeFiltro('hasta')}
                    className="input"
                  />
                </div>
              </div>

              <p className="text-sm text-text-secondary">
                Tipo y fechas son opcionales — sin elegir nada, exporta el historial completo
                del medicamento.
              </p>
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
            onClick={() => setPaso('historialMedicamento')}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left"
          >
            <span>Historial de un medicamento</span>
            <span className="text-sm font-normal text-text-secondary">
              Elegís el medicamento (y, si querés, tipo y rango de fechas) en el paso
              siguiente.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPaso('reporteGeneral')}
            className="btn-secondary w-full flex flex-col items-start gap-1 text-left"
          >
            <span>Reporte general</span>
            <span className="text-sm font-normal text-text-secondary">
              Todos los medicamentos con movimientos en un rango de fechas a elegir, con
              ranking de consumo.
            </span>
          </button>
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
