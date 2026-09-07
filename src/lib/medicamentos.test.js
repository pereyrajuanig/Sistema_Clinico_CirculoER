import { describe, it, expect } from 'vitest'
import { identificarMedicamento, formatearPresentacion, mensajeErrorMedicamento } from './medicamentos'

describe('identificarMedicamento', () => {
  it('combina nombre y concentración', () => {
    expect(identificarMedicamento({ nombre: 'Paracetamol', concentracion: '500mg' })).toBe(
      'Paracetamol 500mg'
    )
  })

  it('devuelve solo el nombre si no hay concentración cargada', () => {
    expect(identificarMedicamento({ nombre: 'Paracetamol', concentracion: null })).toBe(
      'Paracetamol'
    )
    expect(identificarMedicamento({ nombre: 'Paracetamol' })).toBe('Paracetamol')
  })

  it('devuelve string vacío si no hay medicamento', () => {
    expect(identificarMedicamento(null)).toBe('')
    expect(identificarMedicamento(undefined)).toBe('')
  })

  it('distingue dos medicamentos con el mismo nombre y distinta concentración', () => {
    const a = identificarMedicamento({ nombre: 'Paracetamol', concentracion: '500mg' })
    const b = identificarMedicamento({ nombre: 'Paracetamol', concentracion: '1g' })
    expect(a).not.toBe(b)
  })
})

describe('formatearPresentacion', () => {
  it('devuelve la presentación tal cual si no es "Otra"', () => {
    expect(formatearPresentacion({ presentacion: 'Comprimidos' })).toBe('Comprimidos')
  })

  it('resuelve "Otra" al detalle cargado', () => {
    expect(
      formatearPresentacion({ presentacion: 'Otra', presentacion_detalle: 'Óvulos' })
    ).toBe('Óvulos')
  })

  it('si es "Otra" sin detalle, devuelve "Otra" en vez de vacío', () => {
    expect(formatearPresentacion({ presentacion: 'Otra', presentacion_detalle: null })).toBe(
      'Otra'
    )
  })

  it('devuelve string vacío si no hay presentación cargada', () => {
    expect(formatearPresentacion({ presentacion: null })).toBe('')
    expect(formatearPresentacion({})).toBe('')
    expect(formatearPresentacion(null)).toBe('')
  })
})

describe('mensajeErrorMedicamento', () => {
  it('traduce el error de la constraint otra_requiere_detalle a un mensaje legible', () => {
    const error = { message: 'new row violates check constraint "otra_requiere_detalle"' }
    expect(mensajeErrorMedicamento(error)).toBe('Tenés que especificar la presentación.')
  })

  it('deja pasar cualquier otro mensaje de error tal cual', () => {
    const error = { message: 'duplicate key value violates unique constraint' }
    expect(mensajeErrorMedicamento(error)).toBe(error.message)
  })

  it('no rompe si el error no tiene message', () => {
    expect(mensajeErrorMedicamento({})).toBe('Ocurrió un error inesperado.')
    expect(mensajeErrorMedicamento(null)).toBe('Ocurrió un error inesperado.')
  })
})
