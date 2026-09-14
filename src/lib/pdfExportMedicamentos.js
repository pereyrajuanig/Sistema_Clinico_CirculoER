import { identificarMedicamento, formatearPresentacion } from '@/lib/medicamentos'
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
  anchoContenido,
} from '@/lib/pdf'

// Encabezado con nombre + concentración + presentación, pedido explícito para las dos
// variantes — reusa los helpers de identificación ya existentes en vez de rearmar el string
// a mano (mismo criterio "nunca nombre solo" documentado en CLAUDE.md para medicamentos)
function identificarConPresentacion(medicamento) {
  const presentacion = formatearPresentacion(medicamento)
  return presentacion ? `${identificarMedicamento(medicamento)} — ${presentacion}` : identificarMedicamento(medicamento)
}

function filaMovimiento(m) {
  return [
    { text: formatFechaHoraAR(m.fecha), style: 'normal' },
    { text: m.tipo === 'entrada' ? 'Entrada' : 'Salida', style: 'normal' },
    {
      text: `${valorOTexto(m.lotes?.numero_lote, 'Sin número')} — vence ${valorOTexto(formatFechaAR(m.lotes?.fecha_vencimiento))}`,
      style: 'normal',
    },
    { text: String(m.cantidad), style: 'normal' },
    { text: valorOTexto(m.profesionales?.nombre), style: 'normal' },
    { text: m.pacientes ? `${m.pacientes.apellido}, ${m.pacientes.nombre}` : '—', style: 'normal' },
    {
      text: m.consultas ? `Consulta del ${formatFechaAR(m.consultas.fecha.slice(0, 10))}` : '—',
      style: 'normal',
    },
    { text: valorOTexto(m.motivo), style: 'normal' },
    { text: String(m.saldo), style: 'normal' },
  ]
}

// Misma tabla de columnas para las dos variantes (pedido explícito) — orden de columnas
// calcado del historial en pantalla (HistorialMovimientos.jsx): fecha y hora, tipo, lote,
// cantidad, quién registró, paciente, consulta, motivo, saldo corriente. El "saldo" de cada
// fila es el saldo ACUMULADO real del medicamento (calculado sobre TODO su historial, no
// solo el rango/filtro exportado) — mismo valor que ya trae cada movimiento desde
// `conSaldoPorMedicamento()` en HistorialMovimientos.jsx, no se recalcula acá.
function tablaMovimientos(movimientos) {
  return {
    table: {
      headerRows: 1,
      widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto', '*', 'auto'],
      body: [
        [
          'Fecha y hora',
          'Tipo',
          'Lote',
          'Cant.',
          'Registró',
          'Paciente',
          'Consulta',
          'Motivo',
          'Saldo',
        ].map((texto) => ({ text: texto, style: 'tablaHeader' })),
        ...movimientos.map(filaMovimiento),
      ],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 8],
  }
}

function textoFiltrosAplicados({ tipo, desde, hasta }) {
  const partes = []
  if (tipo) partes.push(`Tipo: ${tipo === 'entrada' ? 'Entrada' : 'Salida'}`)
  if (desde) partes.push(`Desde: ${formatFechaAR(desde)}`)
  if (hasta) partes.push(`Hasta: ${formatFechaAR(hasta)}`)

  return {
    text:
      partes.length > 0
        ? `Filtros aplicados — ${partes.join(' · ')}`
        : 'Sin filtro de tipo ni de fecha — historial completo del medicamento.',
    style: 'chico',
    margin: [0, 0, 0, 8],
  }
}

// Total entradas/salidas dentro del recorte exportado, y "stock final" = el saldo
// acumulado real al momento del ÚLTIMO movimiento del recorte (no un delta que arranque de
// cero en el período — `saldo` ya es una cifra absoluta, arrancar de cero lo falsearía).
// `movimientosDesc` viene en el mismo orden que se ve en pantalla (más reciente primero),
// así que el "final" cronológico del recorte es el primer elemento del array.
function resumenMovimientos(movimientosDesc) {
  const totalEntradas = movimientosDesc
    .filter((m) => m.tipo === 'entrada')
    .reduce((acc, m) => acc + m.cantidad, 0)
  const totalSalidas = movimientosDesc
    .filter((m) => m.tipo === 'salida')
    .reduce((acc, m) => acc + m.cantidad, 0)
  const stockFinal = movimientosDesc[0]?.saldo

  return { totalEntradas, totalSalidas, stockFinal }
}

// Variante 1 (pedido explícito del cliente): historial de UN medicamento puntual, con
// exactamente el mismo filtro (tipo + rango de fechas) que estaba aplicado en pantalla al
// exportar — `movimientos` tiene que venir ya filtrado por quien llama (HistorialMovimientos.jsx
// le pasa `movimientosFiltrados` tal cual), acá no se vuelve a filtrar nada.
export function construirPdfHistorialMedicamento({ medicamento, movimientos, filtros }) {
  const encabezado = identificarConPresentacion(medicamento)
  const doc = documentoBase({
    headerTexto: encabezado,
    fechaGeneracionTexto: formatFechaHoraAR(new Date().toISOString()),
  })

  const contenido = [
    { text: 'Historial de movimientos', style: 'titulo' },
    { text: encabezado, style: 'subtitulo' },
    textoFiltrosAplicados(filtros),
  ]

  if (movimientos.length === 0) {
    contenido.push({ text: 'No hay movimientos que coincidan con el filtro aplicado.', style: 'normal' })
  } else {
    contenido.push(tablaMovimientos(movimientos))

    const { totalEntradas, totalSalidas, stockFinal } = resumenMovimientos(movimientos)
    contenido.push(tituloSeccion('Resumen'))
    contenido.push(
      tablaClaveValor([
        ['Total entradas (en el período exportado)', String(totalEntradas)],
        ['Total salidas (en el período exportado)', String(totalSalidas)],
        ['Stock al cierre del período exportado', String(stockFinal)],
      ])
    )
  }

  doc.content = contenido
  return doc
}

// Variante 2 (pedido explícito del cliente): reporte general, no ligado a ningún
// medicamento puntual — agrupa por medicamento TODOS los movimientos del rango de fechas
// pedido, sin excluir medicamentos dados de baja (`medicamentos.activo = false`): a
// diferencia del PDF de historia clínica del paciente (que excluye baja lógica porque ahí
// representa correcciones de errores), acá un medicamento discontinuado tiene un historial
// de movimientos real y válido que sigue siendo parte del reporte si cae en el rango
// consultado. `movimientos` tiene que venir YA filtrado por fecha (desde/hasta) por quien
// llama — este módulo no conoce el rango, solo arma el documento con lo que le llega.
export function construirPdfReporteGeneral({ movimientos, desde, hasta }) {
  const headerTexto = `Reporte general de movimientos — ${formatFechaAR(desde)} a ${formatFechaAR(hasta)}`
  const doc = documentoBase({
    headerTexto,
    fechaGeneracionTexto: formatFechaHoraAR(new Date().toISOString()),
    pageOrientation: 'landscape',
  })
  const ancho = anchoContenido('landscape')

  const grupos = new Map()
  movimientos.forEach((m) => {
    const id = m.lotes?.medicamento_id
    if (!grupos.has(id)) grupos.set(id, { medicamento: m.lotes?.medicamentos, movimientos: [] })
    grupos.get(id).movimientos.push(m)
  })

  const contenido = [
    { text: 'Reporte general de movimientos', style: 'titulo' },
    { text: `Período: ${formatFechaAR(desde)} a ${formatFechaAR(hasta)}`, style: 'subtitulo' },
  ]

  // Orden alfabético por identificación del medicamento — predecible, no depende del orden
  // en que aparecieron los movimientos
  const gruposOrdenados = [...grupos.values()].sort((a, b) =>
    identificarMedicamento(a.medicamento).localeCompare(identificarMedicamento(b.medicamento))
  )

  if (gruposOrdenados.length === 0) {
    contenido.push({ text: 'No hubo movimientos en el período seleccionado.', style: 'normal' })
  } else {
    gruposOrdenados.forEach((grupo, i) => {
      contenido.push(subtituloSeccion(identificarConPresentacion(grupo.medicamento)))
      // Mismo orden que en pantalla: más reciente primero
      contenido.push(tablaMovimientos([...grupo.movimientos].reverse()))
      if (i < gruposOrdenados.length - 1) contenido.push(lineaSeparadora(ancho))
    })
  }

  const rankingSalidas = gruposOrdenados
    .map((grupo) => ({
      nombre: identificarConPresentacion(grupo.medicamento),
      totalSalidas: grupo.movimientos
        .filter((m) => m.tipo === 'salida')
        .reduce((acc, m) => acc + m.cantidad, 0),
    }))
    .filter((g) => g.totalSalidas > 0)
    .sort((a, b) => b.totalSalidas - a.totalSalidas)

  contenido.push(tituloSeccion('Resumen general'))
  contenido.push({
    text: `Total de movimientos en el período: ${movimientos.length}`,
    style: 'normal',
    margin: [0, 0, 0, 6],
  })

  if (rankingSalidas.length > 0) {
    contenido.push(subtituloSeccion('Ranking de medicamentos por consumo (salidas)'))
    contenido.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto'],
        body: [
          [
            { text: '#', style: 'tablaHeader' },
            { text: 'Medicamento', style: 'tablaHeader' },
            { text: 'Total salidas', style: 'tablaHeader' },
          ],
          ...rankingSalidas.map((r, i) => [
            { text: String(i + 1), style: 'normal' },
            { text: r.nombre, style: 'normal' },
            { text: String(r.totalSalidas), style: 'normal' },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
    })
  } else {
    contenido.push({ text: 'No hubo salidas en el período.', style: 'normal' })
  }

  doc.content = contenido
  return doc
}

export function nombreArchivoHistorialMedicamento(medicamento) {
  const fecha = new Date().toISOString().slice(0, 10)
  return `historial-${slugArchivo(identificarMedicamento(medicamento))}-${fecha}.pdf`
}

export function nombreArchivoReporteGeneral(desde, hasta) {
  return `reporte-movimientos-${desde}-a-${hasta}.pdf`
}

export async function exportarHistorialMedicamento({ medicamento, movimientos, filtros }) {
  const doc = construirPdfHistorialMedicamento({ medicamento, movimientos, filtros })
  return generarPdf(doc, nombreArchivoHistorialMedicamento(medicamento))
}

export async function exportarReporteGeneral({ movimientos, desde, hasta }) {
  const doc = construirPdfReporteGeneral({ movimientos, desde, hasta })
  return generarPdf(doc, nombreArchivoReporteGeneral(desde, hasta))
}
