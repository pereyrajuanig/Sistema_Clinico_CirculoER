// Dado un array de movimientos_stock (tipo 'entrada'/'salida' + cantidad + lote_id), calcula
// el stock_actual por lote — misma cuenta que hace la vista stock_por_lote en la base (suma de
// entradas menos suma de salidas, por lote). Se usa para testear el algoritmo de FEFO sin
// mockear Supabase, mismo criterio que combinarCampos/combinarSimple en laboratorio.js: la
// vista SQL sigue siendo la fuente de verdad real en producción (no está versionada, ver
// CLAUDE.md), esto es un modelo puro de la misma regla para poder escribir tests de verdad.
export function calcularStockPorLote(movimientos) {
  const stockPorLote = new Map()
  for (const m of movimientos) {
    const actual = stockPorLote.get(m.lote_id) || 0
    const delta = m.tipo === 'entrada' ? m.cantidad : -m.cantidad
    stockPorLote.set(m.lote_id, actual + delta)
  }
  return stockPorLote
}

// Mismo criterio FEFO (First Expired, First Out) que la query real de SalidaStockModal.jsx:
// .gt('stock_actual', 0).order('fecha_vencimiento', { ascending: true }).limit(1) — un lote en
// stock exactamente 0 queda excluido, nunca vuelve a sugerirse solo hasta que entre stock nuevo.
export function elegirLoteFEFO(lotes) {
  const disponibles = lotes.filter((l) => l.stock_actual > 0)
  if (disponibles.length === 0) return null

  return [...disponibles].sort((a, b) => {
    if (a.fecha_vencimiento < b.fecha_vencimiento) return -1
    if (a.fecha_vencimiento > b.fecha_vencimiento) return 1
    return 0
  })[0]
}

// Misma validación que handleSubmit de SalidaStockModal.jsx — extraída para poder testearla sin
// mockear Supabase. Decisión explícita del cliente para el caso "pide más de lo que tiene el
// lote FEFO": rechazar la operación con un mensaje que indique la acción a seguir, NO dividir
// automáticamente entre dos lotes.
export function validarCantidadSalida(loteSugerido, cantidad) {
  if (!loteSugerido) {
    return 'Este medicamento no tiene stock disponible en ningún lote.'
  }
  if (Number(cantidad) > loteSugerido.stock_actual) {
    return `Este lote solo tiene ${loteSugerido.stock_actual} unidades disponibles — registrá el resto en una segunda salida.`
  }
  return null
}
