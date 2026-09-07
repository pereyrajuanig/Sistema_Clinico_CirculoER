import { describe, it, expect } from 'vitest'
import { limpiarDni, formatearDni } from './dni'

describe('limpiarDni', () => {
  it('deja solo dígitos', () => {
    expect(limpiarDni('12.345.678')).toBe('12345678')
  })

  it('saca espacios y guiones', () => {
    expect(limpiarDni('12 345-678')).toBe('12345678')
  })

  it('no rompe si ya viene limpio', () => {
    expect(limpiarDni('12345678')).toBe('12345678')
  })

  it('devuelve string vacío para null/undefined/vacío', () => {
    expect(limpiarDni(null)).toBe('')
    expect(limpiarDni(undefined)).toBe('')
    expect(limpiarDni('')).toBe('')
  })
})

describe('formatearDni', () => {
  it('agrega puntos de miles a un DNI de 8 dígitos', () => {
    expect(formatearDni('12345678')).toBe('12.345.678')
  })

  it('agrega puntos de miles a un DNI de 7 dígitos', () => {
    expect(formatearDni('1234567')).toBe('1.234.567')
  })

  it('vuelve a formatear un valor que ya tenía puntos, sin duplicarlos', () => {
    expect(formatearDni('12.345.678')).toBe('12.345.678')
  })

  it('devuelve string vacío si no hay dígitos', () => {
    expect(formatearDni('')).toBe('')
    expect(formatearDni(null)).toBe('')
  })
})
