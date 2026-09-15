import { formatearDni } from '@/lib/dni'
import { calcularEdad, formatearMayuscula } from '@/lib/pacientes'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'
import { TIPOS_EXAMEN } from '@/lib/laboratorio'
import {
  documentoBase,
  generarPdf,
  tituloSeccion,
  subtituloSeccion,
  tablaClaveValor,
  lineaSeparadora,
  valorOTexto,
  formatFechaAR,
  formatFechaHoraAR,
  slugArchivo,
} from '@/lib/pdf'

// Duplica CAMPOS_CONSULTA/signosVitales de HistoriaClinica.jsx (y de UltimasConsultas.jsx,
// que ya hace lo mismo) a propósito: es un módulo de src/lib, no debería depender de una
// página — mismo criterio que ya está documentado en CLAUDE.md para por qué
// UltimasConsultas.jsx no comparte esas dos listas con HistoriaClinica.jsx.
const CAMPOS_CONSULTA = [
  ['motivo', 'Motivo'],
  ['examen_fisico', 'Examen físico'],
  ['diagnostico', 'Diagnóstico'],
  ['tratamiento', 'Tratamiento'],
  ['medicacion', 'Medicación'],
  ['evolucion', 'Conclusión'],
  ['pronostico', 'Pronóstico'],
  ['observaciones', 'Observaciones'],
]

const CAMPOS_PACIENTE = [
  ['nombre', 'Nombre'],
  ['apellido', 'Apellido'],
  ['dni', 'DNI'],
  ['fecha_nacimiento', 'Fecha de nacimiento'],
  ['sexo', 'Sexo'],
  ['telefono', 'Teléfono'],
  ['direccion', 'Dirección'],
  ['contacto_familiar', 'Contacto de familiar/referencia'],
  ['obra_social', 'Obra social / n° de afiliado'],
  ['grupo_sanguineo', 'Grupo sanguíneo'],
  ['ocupacion', 'Ocupación'],
  ['estado_civil', 'Estado civil'],
]

// Mismo cálculo que signosVitales() en HistoriaClinica.jsx/UltimasConsultas.jsx, salvo
// "Saturación O2" en vez de "Saturación O₂" — el subíndice Unicode (U+2082) no está
// garantizado en el subset de la fuente Roboto que trae pdfmake por defecto, y no vale la
// pena arriesgar un glifo faltante en un documento clínico por un carácter cosmético.
function signosVitales(c) {
  const items = []
  if (c.presion_sistolica && c.presion_diastolica) {
    items.push(['Presión arterial', `${c.presion_sistolica}/${c.presion_diastolica} mmHg`])
  }
  if (c.frecuencia_cardiaca) items.push(['Frec. cardíaca', `${c.frecuencia_cardiaca} lpm`])
  if (c.temperatura) items.push(['Temperatura', `${c.temperatura} °C`])
  if (c.frecuencia_respiratoria) items.push(['Frec. respiratoria', `${c.frecuencia_respiratoria} rpm`])
  if (c.saturacion_oxigeno) items.push(['Saturación O2', `${c.saturacion_oxigeno}%`])
  if (c.peso) items.push(['Peso', `${c.peso} kg`])
  if (c.talla) items.push(['Talla', `${c.talla} cm`])
  if (c.glucemia) items.push(['Glucemia', `${c.glucemia} mg/dl`])
  return items
}

function datosPaciente(paciente) {
  const valores = {
    ...paciente,
    dni: formatearDni(paciente.dni),
    fecha_nacimiento: formatFechaAR(paciente.fecha_nacimiento),
    obra_social: formatearMayuscula(paciente.obra_social),
    grupo_sanguineo: formatearMayuscula(paciente.grupo_sanguineo),
  }
  return tablaClaveValor(CAMPOS_PACIENTE.map(([campo, etiqueta]) => [etiqueta, valores[campo]]))
}

function seccionAntecedentes(antecedentes) {
  const contenido = [tituloSeccion('Antecedentes')]

  const grupos = Object.entries(TIPOS_ANTECEDENTE)
    .map(([tipo, etiqueta]) => [etiqueta, antecedentes.filter((a) => a.tipo === tipo)])
    .filter(([, lista]) => lista.length > 0)

  if (grupos.length === 0) {
    contenido.push({ text: 'No hay antecedentes registrados.', style: 'normal' })
    return contenido
  }

  grupos.forEach(([etiqueta, lista]) => {
    contenido.push(subtituloSeccion(etiqueta))
    contenido.push({
      ul: lista.map((a) => ({ text: a.descripcion, style: 'normal' })),
      margin: [0, 0, 0, 6],
    })
  })

  return contenido
}

function seccionPatologias(patologias) {
  if (patologias.length === 0) {
    return [tituloSeccion('Patologías'), { text: 'No hay patologías registradas.', style: 'normal' }]
  }

  return [
    tituloSeccion('Patologías'),
    {
      table: {
        widths: ['30%', '15%', '20%', '35%'],
        headerRows: 1,
        body: [
          [
            { text: 'Nombre', style: 'tablaHeader' },
            { text: 'Estado', style: 'tablaHeader' },
            { text: 'Fecha diagnóstico', style: 'tablaHeader' },
            { text: 'Observaciones', style: 'tablaHeader' },
          ],
          ...patologias.map((p) => [
            { text: p.nombre, style: 'normal' },
            { text: p.estado, style: 'normal' },
            { text: valorOTexto(formatFechaAR(p.fecha_diagnostico)), style: 'normal' },
            { text: valorOTexto(p.observaciones), style: 'normal' },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 8],
    },
  ]
}

function seccionMedicacion(medicacion) {
  if (medicacion.length === 0) {
    return [tituloSeccion('Medicación habitual'), { text: 'No hay medicación habitual registrada.', style: 'normal' }]
  }

  return [
    tituloSeccion('Medicación habitual'),
    {
      table: {
        widths: ['25%', '20%', '15%', '20%', '20%'],
        headerRows: 1,
        body: [
          [
            { text: 'Nombre', style: 'tablaHeader' },
            { text: 'Dosis', style: 'tablaHeader' },
            { text: 'Estado', style: 'tablaHeader' },
            { text: 'Desde', style: 'tablaHeader' },
            { text: 'Hasta', style: 'tablaHeader' },
          ],
          ...medicacion.map((m) => [
            { text: m.nombre, style: 'normal' },
            { text: valorOTexto(m.dosis), style: 'normal' },
            { text: m.estado, style: 'normal' },
            { text: valorOTexto(formatFechaAR(m.fecha_inicio)), style: 'normal' },
            { text: valorOTexto(formatFechaAR(m.fecha_fin)), style: 'normal' },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 8],
    },
  ]
}

function bloqueConsulta(c) {
  const filasCampos = CAMPOS_CONSULTA.filter(([campo]) => c[campo]).map(([campo, etiqueta]) => [
    etiqueta,
    c[campo],
  ])
  if (c.proximo_control) filasCampos.push(['Próximo control', formatFechaAR(c.proximo_control)])

  const vitales = signosVitales(c)

  const bloque = [
    {
      columns: [
        { text: formatFechaHoraAR(c.fecha), style: 'subseccion' },
        {
          text: `Atendió: ${c.profesionales?.nombre || 'sin asignar'}`,
          style: 'chico',
          alignment: 'right',
        },
      ],
    },
  ]

  if (filasCampos.length > 0) {
    bloque.push(tablaClaveValor(filasCampos))
  }

  if (vitales.length > 0) {
    bloque.push({
      text: `Signos vitales: ${vitales.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`).join(' · ')}`,
      style: 'chico',
      margin: [0, 0, 0, 4],
    })
  }

  return bloque
}

function seccionConsultas(consultas) {
  if (consultas.length === 0) {
    return [tituloSeccion('Historial de consultas'), { text: 'No hay consultas registradas.', style: 'normal' }]
  }

  // `consultas` ya llega en orden cronológico ascendente desde HistoriaClinica.jsx (el
  // mismo criterio que pide RF-19 para leer la evolución del paciente de punta a punta) —
  // antes hacía falta invertir acá porque la pantalla mostraba lo más reciente primero;
  // desde el rediseño de "línea de tiempo" (ver CLAUDE.md) la pantalla también es
  // ascendente, así que ya no hace falta ningún reverse()
  const ordenAscendente = consultas

  const contenido = [tituloSeccion('Historial de consultas')]

  ordenAscendente.forEach((c, i) => {
    contenido.push(...bloqueConsulta(c))
    if (i < ordenAscendente.length - 1) contenido.push(lineaSeparadora())
  })

  return contenido
}

function seccionLaboratorio(resultados) {
  const contenido = [tituloSeccion('Resultados de laboratorio')]

  const grupos = TIPOS_EXAMEN.map(({ nombre }) => [
    nombre,
    resultados.filter((r) => r.tipo_examen === nombre),
  ]).filter(([, lista]) => lista.length > 0)

  if (grupos.length === 0) {
    contenido.push({ text: 'No hay resultados de laboratorio cargados.', style: 'normal' })
    return contenido
  }

  grupos.forEach(([nombre, lista]) => {
    contenido.push(subtituloSeccion(nombre))
    contenido.push({
      ul: lista.map((r) => ({ text: `${formatFechaAR(r.fecha)} — ${r.resultado}`, style: 'normal' })),
      margin: [0, 0, 0, 6],
    })
  })

  return contenido
}

function seccionDocumentos(documentos) {
  const contenido = [tituloSeccion('Documentos adjuntos')]

  if (documentos.length === 0) {
    contenido.push({ text: 'No hay documentos adjuntos.', style: 'normal' })
    return contenido
  }

  contenido.push({
    text: 'Se listan por nombre y fecha de carga — el archivo en sí sigue disponible desde el sistema, no se adjunta acá.',
    style: 'chico',
    margin: [0, 0, 0, 4],
  })
  contenido.push({
    ul: documentos.map((d) => ({
      text: `${valorOTexto(d.nombre, 'Documento')} — ${formatFechaHoraAR(d.created_at)}`,
      style: 'normal',
    })),
  })

  return contenido
}

function baseHistoriaClinica(paciente) {
  return documentoBase({
    headerTexto: `${paciente.apellido}, ${paciente.nombre} — DNI ${formatearDni(paciente.dni)}`,
    fechaGeneracionTexto: formatFechaHoraAR(new Date().toISOString()),
  })
}

// PDF Completo (RF-19): todo el historial del paciente, en el orden pedido. `datos` ya tiene
// que venir filtrado (`eliminado_en is null`) — HistoriaClinica.jsx ya trae todo así desde el
// fetch, no se vuelve a filtrar acá.
export function construirPdfCompleto(datos) {
  const { paciente, antecedentes, patologias, medicacionHabitual, consultas, resultadosLab, documentos } = datos

  const doc = baseHistoriaClinica(paciente)

  doc.content = [
    { text: 'Historia clínica', style: 'titulo' },
    { text: `${paciente.apellido}, ${paciente.nombre} — DNI ${formatearDni(paciente.dni)}`, style: 'subtitulo' },
    tituloSeccion('Datos del paciente'),
    datosPaciente(paciente),
    ...seccionAntecedentes(antecedentes),
    ...seccionPatologias(patologias),
    ...seccionMedicacion(medicacionHabitual),
    ...seccionConsultas(consultas),
    ...seccionLaboratorio(resultadosLab),
    ...seccionDocumentos(documentos),
  ]

  return doc
}

// PDF Resumen (RF-19): pantallazo rápido del estado actual, para dar contexto sin tener que
// leer el historial completo — pensado para imprimir antes de una consulta, no para
// archivo/legal (para eso está el Completo)
export function construirPdfResumen(datos) {
  const { paciente, antecedentes, patologias, medicacionHabitual, consultas } = datos

  const doc = baseHistoriaClinica(paciente)
  const edad = calcularEdad(paciente.fecha_nacimiento)
  // `consultas` llega en orden ascendente (ver seccionConsultas más arriba) — la más
  // reciente es la ÚLTIMA del array, no la primera
  const ultimaConsulta = consultas[consultas.length - 1] || null
  const alergias = antecedentes.filter((a) => a.tipo === 'alergia')
  const patologiasActivas = patologias.filter((p) => p.estado === 'Activa')
  const medicacionActiva = medicacionHabitual.filter((m) => m.estado === 'Activa')
  const vitalesUltimaConsulta = ultimaConsulta ? signosVitales(ultimaConsulta) : []

  doc.content = [
    { text: 'Resumen de historia clínica', style: 'titulo' },
    { text: `${paciente.apellido}, ${paciente.nombre} — DNI ${formatearDni(paciente.dni)}`, style: 'subtitulo' },

    tituloSeccion('Datos básicos'),
    tablaClaveValor([
      ['Nombre completo', `${paciente.apellido}, ${paciente.nombre}`],
      ['DNI', formatearDni(paciente.dni)],
      ['Fecha de nacimiento', formatFechaAR(paciente.fecha_nacimiento)],
      ['Edad', edad != null ? `${edad} años` : null],
      ['Sexo', paciente.sexo],
      ['Teléfono', paciente.telefono],
      ['Grupo sanguíneo', formatearMayuscula(paciente.grupo_sanguineo)],
    ]),

    tituloSeccion('Última consulta registrada'),
    {
      text: ultimaConsulta ? formatFechaHoraAR(ultimaConsulta.fecha) : 'No hay consultas registradas.',
      style: 'normal',
    },

    tituloSeccion('Patologías activas'),
    patologiasActivas.length > 0
      ? { ul: patologiasActivas.map((p) => ({ text: p.nombre, style: 'normal' })) }
      : { text: 'No tiene patologías activas registradas.', style: 'normal' },

    tituloSeccion('Medicación habitual activa'),
    medicacionActiva.length > 0
      ? {
          ul: medicacionActiva.map((m) => ({
            text: m.dosis ? `${m.nombre} — ${m.dosis}` : m.nombre,
            style: 'normal',
          })),
        }
      : { text: 'No tiene medicación habitual activa registrada.', style: 'normal' },

    tituloSeccion('Alergias'),
    alergias.length > 0
      ? { ul: alergias.map((a) => ({ text: a.descripcion, style: 'normal' })) }
      : { text: 'No tiene alergias registradas.', style: 'normal' },

    tituloSeccion('Últimos signos vitales registrados'),
    vitalesUltimaConsulta.length > 0
      ? {
          ul: vitalesUltimaConsulta.map(([etiqueta, valor]) => ({
            text: `${etiqueta}: ${valor}`,
            style: 'normal',
          })),
        }
      : { text: 'No hay signos vitales registrados en la última consulta.', style: 'normal' },
  ]

  return doc
}

function nombreArchivo(paciente, variante) {
  const fecha = new Date().toISOString().slice(0, 10)
  return `historia-clinica-${slugArchivo(paciente.apellido)}-${slugArchivo(paciente.nombre)}-${variante}-${fecha}.pdf`
}

export async function exportarHistoriaClinica(variante, datos) {
  const docDefinition =
    variante === 'resumen' ? construirPdfResumen(datos) : construirPdfCompleto(datos)

  return generarPdf(docDefinition, nombreArchivo(datos.paciente, variante))
}
