import { describe, it, expect, vi, afterEach } from 'vitest'
import { capitalizarPalabras, formatearMayuscula, calcularEdad } from './pacientes'

describe('capitalizarPalabras', () => {
  it('pone en mayúscula la primera letra de cada palabra y el resto en minúscula', () => {
    expect(capitalizarPalabras('juan CARLOS pérez')).toBe('Juan Carlos Pérez')
  })

  it('funciona con una sola palabra', () => {
    expect(capitalizarPalabras('GONZALEZ')).toBe('Gonzalez')
  })

  it('no rompe con acentos ni con la Ñ', () => {
    expect(capitalizarPalabras('maría ñañez')).toBe('María Ñañez')
  })

  it('devuelve el valor tal cual si es vacío o null', () => {
    expect(capitalizarPalabras('')).toBe('')
    expect(capitalizarPalabras(null)).toBe(null)
    expect(capitalizarPalabras(undefined)).toBe(undefined)
  })
})

describe('formatearMayuscula', () => {
  it('pasa el valor a mayúscula sostenida sin importar cómo esté guardado', () => {
    expect(formatearMayuscula('iosper')).toBe('IOSPER')
    expect(formatearMayuscula('Iosper')).toBe('IOSPER')
    expect(formatearMayuscula('IOSPER')).toBe('IOSPER')
  })

  it('devuelve el valor tal cual si es vacío o null (no lo pisa con string vacío)', () => {
    expect(formatearMayuscula('')).toBe('')
    expect(formatearMayuscula(null)).toBe(null)
  })
})

describe('calcularEdad', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calcula bien cuando ya pasó el cumpleaños este año', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15)) // 15/06/2026 en hora local — evita el desfasaje
    expect(calcularEdad('1990-01-01')).toBe(36)
  })

  it('todavía no resta un año de más cuando el cumpleaños es hoy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15)) // 15/06/2026 en hora local — evita el desfasaje
    expect(calcularEdad('1990-06-15')).toBe(36)
  })

  it('no suma el año todavía si el cumpleaños de este año no llegó', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15)) // 15/06/2026 en hora local — evita el desfasaje
    expect(calcularEdad('1990-12-25')).toBe(35)
  })

  it('devuelve null si no hay fecha de nacimiento cargada', () => {
    expect(calcularEdad(null)).toBe(null)
    expect(calcularEdad('')).toBe(null)
  })
})
