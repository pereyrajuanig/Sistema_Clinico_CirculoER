// Cada tipo de examen define UNA de estas tres formas de carga:
// - subcampos: varios valores relacionados (se combinan en un solo texto al guardar)
// - opciones: selección de una lista fija
// - unidad: un solo valor numérico/texto libre, con la unidad como guía
export const TIPOS_EXAMEN = [
  { nombre: 'Hemograma', subcampos: ['GB', 'GR', 'Hb', 'Hto', 'Plaquetas'] },
  { nombre: 'Hepatograma', subcampos: ['GOT', 'GPT', 'FAL', 'Bilirrubina'] },
  { nombre: 'Glucemia', unidad: 'mg/dL' },
  { nombre: 'Creatinina', unidad: 'mg/dL' },
  { nombre: 'Hemoglobina glicosilada', unidad: '%' },
  { nombre: 'Uremia', unidad: 'mg/dL' },
  { nombre: 'Colesterol', unidad: 'mg/dL' },
  { nombre: 'HDL', unidad: 'mg/dL' },
  { nombre: 'LDL', unidad: 'mg/dL' },
  { nombre: 'Triglicéridos', unidad: 'mg/dL' },
  { nombre: 'Calcemia', unidad: 'mg/dL' },
  { nombre: 'Ácido úrico', unidad: 'mg/dL' },
  { nombre: 'Vitamina D3', unidad: 'ng/mL' },
  { nombre: 'Orina completa', subcampos: ['Color', 'Densidad', 'Observaciones'] },
  { nombre: 'Urocultivo', subcampos: ['Gérmenes', 'Recuento (UFC/mL)'] },
  { nombre: 'Sangre oculta', opciones: ['Positivo', 'Negativo'] },
  { nombre: 'TSH', unidad: 'µUI/mL' },
  { nombre: 'T4 libre', unidad: 'ng/dL' },
  { nombre: 'PSA libre', unidad: 'ng/mL' },
  { nombre: 'PSA total', unidad: 'ng/mL' },
  { nombre: 'Coagulograma', subcampos: ['TP', 'KPTT', 'RIN'] },
  { nombre: 'RIN', unidad: '(sin unidad, es un ratio)' },
]
