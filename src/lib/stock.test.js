import { describe, it, expect } from 'vitest'
import { calcularStockPorLote, elegirLoteFEFO, validarCantidadSalida } from './stock'

describe('calcularStockPorLote', () => {
  it('suma entradas y resta salidas por lote', () => {
    const movimientos = [
      { lote_id: 'L1', tipo: 'entrada', cantidad: 10 },
      { lote_id: 'L1', tipo: 'salida', cantidad: 4 },
    ]
    expect(calcularStockPorLote(movimientos).get('L1')).toBe(6)
  })

  it('deja el stock en 0 si las salidas agotan exactamente la entrada', () => {
    const movimientos = [
      { lote_id: 'L1', tipo: 'entrada', cantidad: 5 },
      { lote_id: 'L1', tipo: 'salida', cantidad: 5 },
    ]
    expect(calcularStockPorLote(movimientos).get('L1')).toBe(0)
  })

  it('mantiene el stock de lotes distintos por separado', () => {
    const movimientos = [
      { lote_id: 'L1', tipo: 'entrada', cantidad: 10 },
      { lote_id: 'L2', tipo: 'entrada', cantidad: 20 },
      { lote_id: 'L1', tipo: 'salida', cantidad: 3 },
    ]
    const stock = calcularStockPorLote(movimientos)
    expect(stock.get('L1')).toBe(7)
    expect(stock.get('L2')).toBe(20)
  })
})

describe('elegirLoteFEFO', () => {
  it('elige el lote con fecha de vencimiento más próxima entre los que tienen stock', () => {
    const lotes = [
      { lote_id: 'L1', stock_actual: 5, fecha_vencimiento: '2026-12-01' },
      { lote_id: 'L2', stock_actual: 5, fecha_vencimiento: '2026-06-01' },
    ]
    expect(elegirLoteFEFO(lotes).lote_id).toBe('L2')
  })

  it('un lote en stock exactamente 0 queda excluido de la sugerencia', () => {
    const lotes = [
      { lote_id: 'L1', stock_actual: 0, fecha_vencimiento: '2026-06-01' },
      { lote_id: 'L2', stock_actual: 5, fecha_vencimiento: '2026-12-01' },
    ]
    expect(elegirLoteFEFO(lotes).lote_id).toBe('L2')
  })

  it('devuelve null si ningún lote tiene stock disponible', () => {
    const lotes = [{ lote_id: 'L1', stock_actual: 0, fecha_vencimiento: '2026-06-01' }]
    expect(elegirLoteFEFO(lotes)).toBeNull()
  })
})

describe('validarCantidadSalida', () => {
  it('permite una cantidad menor o igual al stock del lote', () => {
    expect(validarCantidadSalida({ stock_actual: 10 }, 10)).toBeNull()
    expect(validarCantidadSalida({ stock_actual: 10 }, 4)).toBeNull()
  })

  it('rechaza si no hay ningún lote sugerido (sin stock disponible)', () => {
    expect(validarCantidadSalida(null, 5)).toMatch(/no tiene stock disponible/)
  })

  it('rechaza una cantidad mayor al stock del lote, con un mensaje que indica qué hacer', () => {
    expect(validarCantidadSalida({ stock_actual: 3 }, 5)).toMatch(/segunda salida/)
  })
})

// Estos dos tests simulan de punta a punta el flujo real de "Registrar salida" — no hay
// ninguna restricción sobre paciente_id ni en el código ni documentada en la base (ver
// CLAUDE.md, sección de auditoría de este módulo): dos salidas seguidas para el mismo paciente
// son dos filas independientes en movimientos_stock, sin ningún chequeo cruzado entre ellas más
// allá del stock real del lote.
describe('flujo real: dos salidas seguidas para el mismo paciente', () => {
  it('con stock suficiente, la segunda salida funciona sin problema', () => {
    let movimientos = [{ lote_id: 'L1', tipo: 'entrada', cantidad: 10 }]
    let lotes = [
      { lote_id: 'L1', stock_actual: calcularStockPorLote(movimientos).get('L1'), fecha_vencimiento: '2026-12-01' },
    ]

    let sugerido = elegirLoteFEFO(lotes)
    expect(validarCantidadSalida(sugerido, 4)).toBeNull()
    movimientos = [...movimientos, { lote_id: 'L1', tipo: 'salida', cantidad: 4, paciente_id: 'P1' }]

    // Segunda salida para el MISMO paciente, mismo medicamento: se recalcula el stock del
    // lote con el movimiento anterior ya aplicado y se valida de nuevo.
    lotes = [
      { lote_id: 'L1', stock_actual: calcularStockPorLote(movimientos).get('L1'), fecha_vencimiento: '2026-12-01' },
    ]
    sugerido = elegirLoteFEFO(lotes)
    expect(sugerido.stock_actual).toBe(6)
    expect(validarCantidadSalida(sugerido, 6)).toBeNull()

    movimientos = [...movimientos, { lote_id: 'L1', tipo: 'salida', cantidad: 6, paciente_id: 'P1' }]
    expect(calcularStockPorLote(movimientos).get('L1')).toBe(0)
  })

  it('si la primera salida deja el lote FEFO en stock 0, la segunda salida pasa automáticamente al siguiente lote por vencer', () => {
    let movimientos = [
      { lote_id: 'L1', tipo: 'entrada', cantidad: 5 },
      { lote_id: 'L2', tipo: 'entrada', cantidad: 8 },
    ]
    let stock = calcularStockPorLote(movimientos)
    let lotes = [
      { lote_id: 'L1', stock_actual: stock.get('L1'), fecha_vencimiento: '2026-05-01' },
      { lote_id: 'L2', stock_actual: stock.get('L2'), fecha_vencimiento: '2026-09-01' },
    ]

    let sugerido = elegirLoteFEFO(lotes)
    expect(sugerido.lote_id).toBe('L1')

    // Primera salida para el paciente P1, agota L1 exactamente (stock 0, ni negativo ni
    // "casi vacío")
    movimientos = [...movimientos, { lote_id: 'L1', tipo: 'salida', cantidad: 5, paciente_id: 'P1' }]
    stock = calcularStockPorLote(movimientos)
    lotes = [
      { lote_id: 'L1', stock_actual: stock.get('L1'), fecha_vencimiento: '2026-05-01' },
      { lote_id: 'L2', stock_actual: stock.get('L2'), fecha_vencimiento: '2026-09-01' },
    ]
    expect(stock.get('L1')).toBe(0)

    // Segunda salida para el mismo paciente P1: L1 ya no aparece como opción (stock 0), la
    // sugerencia FEFO recae en L2 sin que nadie tenga que elegirlo a mano
    sugerido = elegirLoteFEFO(lotes)
    expect(sugerido.lote_id).toBe('L2')
    expect(validarCantidadSalida(sugerido, 3)).toBeNull()
  })
})
