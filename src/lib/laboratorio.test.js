import { describe, it, expect } from 'vitest'
import { TIPOS_EXAMEN, GRUPOS_CARGA, combinarCampos, combinarSimple } from './laboratorio'

describe('combinarCampos', () => {
  const campos = [
    { nombre: 'GB', unidad: '/mm3' },
    { nombre: 'Hb', unidad: 'g/dL' },
    { nombre: 'Hto', unidad: '%' },
  ]

  it('combina varios campos con su unidad, separados por " · "', () => {
    const resultado = combinarCampos(campos, { GB: '7500', Hb: '14.2' })
    expect(resultado).toBe('GB: 7500 /mm3 · Hb: 14.2 g/dL')
  })

  it('descarta campos vacíos o con solo espacios — no hace falta cargar todo', () => {
    const resultado = combinarCampos(campos, { GB: '7500', Hb: '', Hto: '   ' })
    expect(resultado).toBe('GB: 7500 /mm3')
  })

  it('devuelve string vacío si no se cargó ningún campo', () => {
    expect(combinarCampos(campos, {})).toBe('')
  })

  it('recorta espacios del valor cargado', () => {
    const resultado = combinarCampos([{ nombre: 'GB', unidad: '/mm3' }], { GB: '  7500  ' })
    expect(resultado).toBe('GB: 7500 /mm3')
  })

  it('no agrega unidad si el campo no tiene una definida', () => {
    const resultado = combinarCampos([{ nombre: 'Color', grupo: 'Examen físico' }], {
      Color: 'Amarillo',
    })
    expect(resultado).toBe('Color: Amarillo')
  })
})

describe('combinarSimple', () => {
  it('agrega la unidad del examen al valor', () => {
    expect(combinarSimple({ unidad: 'mg/dL' }, '95')).toBe('95 mg/dL')
  })

  it('recorta espacios', () => {
    expect(combinarSimple({ unidad: 'mg/dL' }, '  95  ')).toBe('95 mg/dL')
  })

  it('no agrega nada si el examen no tiene unidad (ej. RIN)', () => {
    expect(combinarSimple({}, '1.2')).toBe('1.2')
  })

  it('devuelve string vacío si no se cargó ningún valor', () => {
    expect(combinarSimple({ unidad: 'mg/dL' }, '')).toBe('')
    expect(combinarSimple({ unidad: 'mg/dL' }, '   ')).toBe('')
    expect(combinarSimple({ unidad: 'mg/dL' }, null)).toBe('')
  })
})

describe('atajo "Perfil lipídico" (GRUPOS_CARGA)', () => {
  // Perfil lipídico no es un tipo_examen real en la base (el CHECK constraint solo permite
  // los 22 nombres originales) — al guardar se separa en 4 filas con nombres reales. Si
  // algún día se renombra un campo de TIPOS_EXAMEN sin actualizar este atajo, las filas
  // generadas tendrían un tipo_examen que la base rechaza. Este test existe para que ese
  // desfasaje se note acá, no en producción contra un CHECK constraint real.
  const perfilLipidico = GRUPOS_CARGA.find((g) => g.nombre === 'Perfil lipídico')

  it('existe, y está marcado para separarse en filas al guardar', () => {
    expect(perfilLipidico).toBeDefined()
    expect(perfilLipidico.separarEnFilas).toBe(true)
  })

  it('tiene exactamente los 4 componentes esperados', () => {
    const nombres = perfilLipidico.campos.map((c) => c.nombre)
    expect(nombres).toEqual(['Colesterol', 'HDL', 'LDL', 'Triglicéridos'])
  })

  it('cada campo del atajo usa la misma unidad que su tipo_examen real', () => {
    for (const campo of perfilLipidico.campos) {
      const real = TIPOS_EXAMEN.find((t) => t.nombre === campo.nombre)
      expect(real, `"${campo.nombre}" ya no existe en TIPOS_EXAMEN`).toBeDefined()
      expect(campo.unidad).toBe(real.unidad)
    }
  })

  it('los 4 componentes ya no aparecen sueltos en el selector (los reemplaza el atajo)', () => {
    const nombresGrupos = GRUPOS_CARGA.map((g) => g.nombre)
    expect(nombresGrupos).not.toContain('Colesterol')
    expect(nombresGrupos).not.toContain('HDL')
    expect(nombresGrupos).not.toContain('LDL')
    expect(nombresGrupos).not.toContain('Triglicéridos')
  })
})
