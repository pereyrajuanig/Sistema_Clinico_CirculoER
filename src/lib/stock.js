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

// Fecha de HOY en formato YYYY-MM-DD, en horario LOCAL — a propósito sin pasar por
// toISOString().slice(0, 10) (que convierte a UTC primero): en Argentina (UTC-3) eso puede
// devolver la fecha de MAÑANA para cualquier hora de la noche, corriendo un día el corte de
// "vencido"/"por vencer" justo en el caso límite que más importa (cerca de medianoche). Mismo
// criterio ya usado en fechaLocalISO() de ConsumoDelMes.jsx — se centraliza acá porque ahora
// lo necesitan varios lugares del módulo de stock, no solo esa pantalla.
export function hoyLocalISO() {
  const ahora = new Date()
  return formatearFechaLocal(ahora)
}

// Suma (o resta, con un número negativo) días a una fecha ISO (YYYY-MM-DD) devolviendo
// también en formato ISO local — mismo criterio de arriba, para no mezclar horario local y UTC
// en la misma cuenta de días.
export function sumarDiasISO(fechaISO, dias) {
  const fecha = new Date(fechaISO + 'T00:00:00')
  fecha.setDate(fecha.getDate() + dias)
  return formatearFechaLocal(fecha)
}

function formatearFechaLocal(fecha) {
  const año = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

// Un lote está vencido si su fecha de vencimiento ya PASÓ — hoy todavía cuenta como válido
// (mismo criterio "best before" de la industria: se puede usar hasta el final del día de
// vencimiento, no antes).
export function loteVencido(fechaVencimiento, hoy = hoyLocalISO()) {
  return fechaVencimiento < hoy
}

// "Por vencer" y "vencido" son estados EXCLUYENTES a propósito — antes una sola función
// (estaProximoAVencer, ya sacada de SalidaStockModal.jsx) devolvía true para las dos cosas, lo
// que mostraba el mismo aviso suave ("está próximo a vencer") para un lote que en realidad ya
// venció, además de dejarlo ELEGIBLE para una salida real (ver elegirLoteFEFO más abajo).
export function loteProximoAVencer(fechaVencimiento, dias = 30, hoy = hoyLocalISO()) {
  if (loteVencido(fechaVencimiento, hoy)) return false
  return fechaVencimiento <= sumarDiasISO(hoy, dias)
}

// Mismo criterio FEFO (First Expired, First Out) que la query real de SalidaStockModal.jsx:
// .gt('stock_actual', 0).gte('fecha_vencimiento', hoy).order('fecha_vencimiento', { ascending:
// true }) — un lote en stock exactamente 0, o YA VENCIDO, queda excluido de la sugerencia.
// Excluir vencidos es a propósito: no hay ningún caso de uso real donde deba ofrecerse un lote
// vencido para una administración real a un paciente (pedido explícito del cliente, tras un
// caso real de un medicamento vencido que igual aparecía sugerido).
export function elegirLoteFEFO(lotes, hoy = hoyLocalISO()) {
  const disponibles = lotes.filter((l) => l.stock_actual > 0 && !loteVencido(l.fecha_vencimiento, hoy))
  if (disponibles.length === 0) return null

  return [...disponibles].sort((a, b) => {
    if (a.fecha_vencimiento < b.fecha_vencimiento) return -1
    if (a.fecha_vencimiento > b.fecha_vencimiento) return 1
    return 0
  })[0]
}

// Etiqueta legible para el tercer tipo de movimiento (`baja`, ver DarDeBajaLoteModal.jsx) —
// centralizada porque HistorialMovimientos.jsx, CorregirMovimientoModal.jsx y
// pdfExportMedicamentos.js repetían el mismo `tipo === 'entrada' ? 'Entrada' : 'Salida'`, que
// etiquetaba mal una baja como "Salida".
export function etiquetaTipoMovimiento(tipo) {
  if (tipo === 'entrada') return 'Entrada'
  if (tipo === 'baja') return 'Baja'
  return 'Salida'
}

// Validación de una cantidad contra un lote puntual (también usada por los tests históricos).
export function validarCantidadSalida(loteSugerido, cantidad) {
  if (!loteSugerido) {
    return 'Este medicamento no tiene stock disponible en ningún lote.'
  }
  if (Number(cantidad) > loteSugerido.stock_actual) {
    return `Este lote solo tiene ${loteSugerido.stock_actual} unidades disponibles.`
  }
  return null
}

// Propone el reparto completo por vencimiento. Nunca asigna más stock del disponible;
// si no alcanza, la validación indica el faltante y no permite guardar una entrega parcial.
export function distribuirSalida(lotes, cantidad, hoy = hoyLocalISO()) {
  let restante = Number(cantidad)
  if (!Number.isSafeInteger(restante) || restante <= 0) return {}
  const distribucion = {}
  const disponibles = lotes.filter((l) => l.stock_actual > 0 && !loteVencido(l.fecha_vencimiento, hoy))
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.lote_id.localeCompare(b.lote_id))
  for (const lote of disponibles) {
    if (restante === 0) break
    const asignada = Math.min(restante, Number(lote.stock_actual))
    distribucion[lote.lote_id] = asignada
    restante -= asignada
  }
  return distribucion
}

export function validarDistribucionSalida(lotes, cantidad, distribucion, hoy = hoyLocalISO()) {
  const total = Number(cantidad)
  if (!Number.isSafeInteger(total) || total <= 0 || total > 2147483647) {
    return 'Ingresá una cantidad total entera mayor a cero.'
  }
  const disponibles = lotes.filter((l) => l.stock_actual > 0 && !loteVencido(l.fecha_vencimiento, hoy))
  const stock = disponibles.reduce((suma, lote) => suma + Number(lote.stock_actual), 0)
  if (stock < total) return `Hay ${stock} unidades disponibles entre los lotes habilitados. Faltan ${total - stock} para completar la entrega.`
  let asignado = 0
  for (const [loteId, valor] of Object.entries(distribucion)) {
    const unidades = Number(valor)
    if (!Number.isSafeInteger(unidades) || unidades < 0) return 'Las cantidades por lote deben ser números enteros mayores o iguales a cero.'
    if (unidades === 0) continue
    const lote = disponibles.find((l) => l.lote_id === loteId)
    if (!lote) return 'Uno de los lotes ya no está habilitado. Recalculá la distribución.'
    if (unidades > Number(lote.stock_actual)) return `El lote ${lote.numero_lote || '(sin número)'} solo tiene ${lote.stock_actual} unidades disponibles.`
    asignado += unidades
  }
  if (asignado < total) return `Faltan asignar ${total - asignado} unidades para completar la entrega.`
  if (asignado > total) return `Hay ${asignado - total} unidades de más en la distribución.`
  return null
}
