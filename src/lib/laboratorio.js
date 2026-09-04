// TIPOS_EXAMEN: fuente de verdad de los valores reales de `tipo_examen` en la base (coincide
// con el CHECK constraint de la tabla `resultados_laboratorio`). Se usa para agrupar el
// historial. Cada tipo define UNA de estas formas de carga:
// - campos: varios valores relacionados (se combinan en un solo texto al guardar).
//   Cada campo es { nombre, tipo?, grupo?, unidad? }:
//     - tipo 'cruces'  -> selector No reactivo / + / ++ / +++ / ++++
//     - tipo 'binario' -> selector No contiene / Contiene
//     - sin tipo       -> texto libre
//     - grupo agrupa varios campos bajo un subtítulo en el formulario (opcional)
//     - unidad se agrega al valor al guardar (ej. "190 mg/dL"), solo si el campo es de texto libre
// - opciones: selección de una lista fija
// - unidad: un solo valor de texto libre, se agrega al guardar (ej. "98 mg/dL")
// - placeholder: solo guía visual en el campo, NO se agrega al valor guardado (para casos
//   como RIN, que no tiene una unidad real)
const CRUCES = ['No reactivo', '+', '++', '+++', '++++']
const CONTIENE = ['No contiene', 'Contiene']

export const TIPOS_EXAMEN = [
  {
    nombre: 'Hemograma',
    campos: [
      { nombre: 'GB', unidad: '/mm3' },
      { nombre: 'GR', unidad: '/mm3' },
      { nombre: 'Hb', unidad: 'g/dL' },
      { nombre: 'Hto', unidad: '%' },
      { nombre: 'Plaquetas', unidad: '/mm3' },
    ],
  },
  {
    nombre: 'Hepatograma',
    campos: [
      { nombre: 'GOT', unidad: 'UI/L' },
      { nombre: 'GPT', unidad: 'UI/L' },
      { nombre: 'Fosfatasa alcalina', unidad: 'UI/L' },
      { nombre: 'GGT', unidad: 'UI/L' },
      { nombre: 'Bilirrubina total', unidad: 'mg/dL' },
      { nombre: 'Bilirrubina directa', unidad: 'mg/dL' },
      { nombre: 'Bilirrubina indirecta', unidad: 'mg/dL' },
    ],
  },
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
  {
    nombre: 'Orina completa',
    campos: [
      { nombre: 'Color', grupo: 'Examen físico' },
      { nombre: 'Aspecto', grupo: 'Examen físico' },
      { nombre: 'Densidad', grupo: 'Examen químico' },
      { nombre: 'pH', grupo: 'Examen químico' },
      { nombre: 'Proteínas', tipo: 'cruces', grupo: 'Examen químico' },
      { nombre: 'Glucosa', tipo: 'cruces', grupo: 'Examen químico' },
      { nombre: 'Hb', tipo: 'cruces', grupo: 'Examen químico' },
      { nombre: 'Cuerpos cetónicos', tipo: 'binario', grupo: 'Examen químico' },
      { nombre: 'Urobilinógeno', tipo: 'binario', grupo: 'Examen químico' },
      { nombre: 'Nitritos', tipo: 'binario', grupo: 'Examen químico' },
      { nombre: 'Sedimento', grupo: 'Examen químico' },
    ],
  },
  {
    nombre: 'Urocultivo',
    campos: [{ nombre: 'Gérmenes' }, { nombre: 'Recuento', unidad: 'UFC/mL' }],
  },
  { nombre: 'Sangre oculta', opciones: ['Positivo', 'Negativo'] },
  { nombre: 'TSH', unidad: 'µUI/mL' },
  { nombre: 'T4 libre', unidad: 'ng/dL' },
  { nombre: 'PSA libre', unidad: 'ng/mL' },
  { nombre: 'PSA total', unidad: 'ng/mL' },
  {
    nombre: 'Coagulograma',
    campos: [
      { nombre: 'Tiempo de protrombina (TP)', unidad: 'segundos' },
      { nombre: 'KPTT', unidad: 'seg' },
      { nombre: 'Fibrinógeno', unidad: 'mg/dL' },
    ],
  },
  { nombre: 'RIN', placeholder: '(sin unidad, es un ratio)' },
]

function porNombre(nombre) {
  return TIPOS_EXAMEN.find((t) => t.nombre === nombre)
}

// "Perfil lipídico" no es un tipo_examen real en la base (el CHECK constraint solo permite
// los 22 nombres originales) — es un atajo de carga que agrupa 4 tipos reales en una sola
// pantalla y, al guardar, genera 4 filas separadas (Colesterol, HDL, LDL, Triglicéridos).
const PERFIL_LIPIDICO = {
  nombre: 'Perfil lipídico',
  separarEnFilas: true,
  campos: ['Colesterol', 'HDL', 'LDL', 'Triglicéridos'].map((nombre) => ({
    nombre,
    unidad: porNombre(nombre).unidad,
  })),
}

// GRUPOS_CARGA: opciones del selector del formulario de carga. Reemplaza los 4 tipos sueltos
// de valor único (Colesterol, HDL, LDL, Triglicéridos) por el atajo "Perfil lipídico".
export const GRUPOS_CARGA = [
  porNombre('Hemograma'),
  porNombre('Hepatograma'),
  porNombre('Glucemia'),
  porNombre('Creatinina'),
  porNombre('Hemoglobina glicosilada'),
  porNombre('Uremia'),
  PERFIL_LIPIDICO,
  porNombre('Calcemia'),
  porNombre('Ácido úrico'),
  porNombre('Vitamina D3'),
  porNombre('Orina completa'),
  porNombre('Urocultivo'),
  porNombre('Sangre oculta'),
  porNombre('TSH'),
  porNombre('T4 libre'),
  porNombre('PSA libre'),
  porNombre('PSA total'),
  porNombre('Coagulograma'),
  porNombre('RIN'),
]

export const OPCIONES_CRUCES = CRUCES
export const OPCIONES_CONTIENE = CONTIENE
