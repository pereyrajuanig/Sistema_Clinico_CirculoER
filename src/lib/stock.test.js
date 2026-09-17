import { describe, it, expect } from 'vitest'
import {
  calcularStockPorLote,
  elegirLoteFEFO,
  validarCantidadSalida,
  hoyLocalISO,
  sumarDiasISO,
  loteVencido,
  loteProximoAVencer,
  etiquetaTipoMovimiento,
} from './stock'

// Fecha de referencia fija para no depender de la fecha real del sistema en los tests que ya
// existían antes de agregar el filtro de vencidos (todos con fecha_vencimiento en 2026,
// pensados para probar FEFO por stock, no por vencimiento).
const HOY_FIJO = '2026-01-01'

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
    expect(elegirLoteFEFO(lotes, HOY_FIJO).lote_id).toBe('L2')
  })

  it('un lote en stock exactamente 0 queda excluido de la sugerencia', () => {
    const lotes = [
      { lote_id: 'L1', stock_actual: 0, fecha_vencimiento: '2026-06-01' },
      { lote_id: 'L2', stock_actual: 5, fecha_vencimiento: '2026-12-01' },
    ]
    expect(elegirLoteFEFO(lotes, HOY_FIJO).lote_id).toBe('L2')
  })

  it('devuelve null si ningún lote tiene stock disponible', () => {
    const lotes = [{ lote_id: 'L1', stock_actual: 0, fecha_vencimiento: '2026-06-01' }]
    expect(elegirLoteFEFO(lotes, HOY_FIJO)).toBeNull()
  })

  // Caso real que motivó este cambio: un medicamento vencido con stock remanente aparecía
  // como PRIMERA sugerencia (por ser el que "vence antes" de todos) — ver CLAUDE.md, auditoría
  // de fechas de vencimiento.
  it('un lote vencido queda excluido de la sugerencia aunque tenga stock y sea el que vence antes', () => {
    const lotes = [
      { lote_id: 'L1', stock_actual: 20, fecha_vencimiento: '2025-01-01' }, // vencido
      { lote_id: 'L2', stock_actual: 5, fecha_vencimiento: '2026-06-01' },
    ]
    expect(elegirLoteFEFO(lotes, HOY_FIJO).lote_id).toBe('L2')
  })

  it('devuelve null si el único lote con stock está vencido', () => {
    const lotes = [{ lote_id: 'L1', stock_actual: 20, fecha_vencimiento: '2025-01-01' }]
    expect(elegirLoteFEFO(lotes, HOY_FIJO)).toBeNull()
  })
})

describe('loteVencido', () => {
  it('un lote con fecha anterior a hoy está vencido', () => {
    expect(loteVencido('2026-01-01', '2026-01-02')).toBe(true)
  })

  it('un lote que vence HOY todavía no está vencido (se puede usar hasta el final del día)', () => {
    expect(loteVencido('2026-01-02', '2026-01-02')).toBe(false)
  })

  it('un lote con fecha futura no está vencido', () => {
    expect(loteVencido('2026-01-03', '2026-01-02')).toBe(false)
  })
})

describe('sumarDiasISO', () => {
  it('suma días cruzando el fin de mes correctamente', () => {
    expect(sumarDiasISO('2026-01-25', 10)).toBe('2026-02-04')
  })

  it('con 0 días devuelve la misma fecha', () => {
    expect(sumarDiasISO('2026-01-25', 0)).toBe('2026-01-25')
  })
})

describe('loteProximoAVencer', () => {
  it('es true si vence dentro de la ventana de días pedida', () => {
    expect(loteProximoAVencer('2026-01-15', 30, '2026-01-01')).toBe(true)
  })

  it('es false si vence más adelante de la ventana pedida', () => {
    expect(loteProximoAVencer('2026-03-01', 30, '2026-01-01')).toBe(false)
  })

  // El caso que motivó separar estas dos funciones: antes un solo chequeo (fecha <= hoy +
  // días) daba `true` tanto para "por vencer" como para "ya vencido", mostrando el mismo aviso
  // suave para las dos cosas.
  it('es false para un lote YA VENCIDO — "por vencer" y "vencido" son estados excluyentes', () => {
    expect(loteProximoAVencer('2025-12-01', 30, '2026-01-01')).toBe(false)
    expect(loteVencido('2025-12-01', '2026-01-01')).toBe(true)
  })
})

describe('hoyLocalISO', () => {
  it('devuelve una fecha en formato YYYY-MM-DD', () => {
    expect(hoyLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('etiquetaTipoMovimiento', () => {
  it('traduce los tres tipos de movimiento', () => {
    expect(etiquetaTipoMovimiento('entrada')).toBe('Entrada')
    expect(etiquetaTipoMovimiento('salida')).toBe('Salida')
    expect(etiquetaTipoMovimiento('baja')).toBe('Baja')
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

    let sugerido = elegirLoteFEFO(lotes, HOY_FIJO)
    expect(validarCantidadSalida(sugerido, 4)).toBeNull()
    movimientos = [...movimientos, { lote_id: 'L1', tipo: 'salida', cantidad: 4, paciente_id: 'P1' }]

    // Segunda salida para el MISMO paciente, mismo medicamento: se recalcula el stock del
    // lote con el movimiento anterior ya aplicado y se valida de nuevo.
    lotes = [
      { lote_id: 'L1', stock_actual: calcularStockPorLote(movimientos).get('L1'), fecha_vencimiento: '2026-12-01' },
    ]
    sugerido = elegirLoteFEFO(lotes, HOY_FIJO)
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

    let sugerido = elegirLoteFEFO(lotes, HOY_FIJO)
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
    sugerido = elegirLoteFEFO(lotes, HOY_FIJO)
    expect(sugerido.lote_id).toBe('L2')
    expect(validarCantidadSalida(sugerido, 3)).toBeNull()
  })
})
