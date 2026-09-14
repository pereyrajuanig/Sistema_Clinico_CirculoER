// Infraestructura compartida entre las exportaciones a PDF de la app (historia clínica del
// paciente — RF-19 — e historial de movimientos de medicamentos). Todo lo que es genuinamente
// igual entre las dos (carga de pdfmake, pie de página institucional, formato de fecha,
// estilos base) vive acá; lo que arma cada documento puntual (qué secciones, en qué orden)
// queda en su propio módulo (`pdfExport.js`, `pdfExportMedicamentos.js`) — no vale la pena
// compartir esa parte, diverge demasiado entre los dos casos de uso.

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Formato argentino DD/MM/AAAA, siempre — a propósito NO se usa toLocaleDateString/Intl con
// `dateStyle` (devuelve fechas en prosa, "13 sept 2026", y el formato numérico exacto puede
// variar según el entorno) — calcularlo a mano es la única forma de garantizar el mismo
// formato siempre. `valor + 'T00:00:00'` fuerza a interpretar una columna `date` (sin hora,
// como `fecha_nacimiento` o `fecha_vencimiento`) en horario local en vez de UTC — evita que
// se corra un día por el desfase de huso horario (Argentina UTC-3).
export function formatFechaAR(valor) {
  if (!valor) return null
  const iso = valor.length === 10 ? `${valor}T00:00:00` : valor
  const d = new Date(iso)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatFechaHoraAR(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return `${formatFechaAR(valor)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function valorOTexto(valor, fallback = '—') {
  return valor === null || valor === undefined || valor === '' ? fallback : String(valor)
}

// Saca acentos/ñ y cualquier carácter que no sea alfanumérico — para nombres de archivo de
// descarga, nunca para texto que se muestra dentro del PDF
export function slugArchivo(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const ESTILOS_PDF = {
  titulo: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
  subtitulo: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 14] },
  seccion: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
  subseccion: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
  etiqueta: { fontSize: 9, bold: true, color: '#444444' },
  tablaHeader: { fontSize: 9, bold: true, fillColor: '#f0f0f0' },
  normal: { fontSize: 9.5 },
  chico: { fontSize: 8.5, color: '#666666' },
  headerPagina: { fontSize: 8.5, color: '#666666' },
  footer: { fontSize: 8, color: '#666666', alignment: 'center' },
}

// Ancho de página, sin márgenes — A4 retrato con márgenes de 40pt da ~515pt; A4 apaisado
// (para las tablas anchas de movimientos de stock) da ~760pt
const ANCHO_RETRATO = 515
const ANCHO_APAISADO = 760

export function anchoContenido(pageOrientation) {
  return pageOrientation === 'landscape' ? ANCHO_APAISADO : ANCHO_RETRATO
}

export function lineaSeparadora(ancho = ANCHO_RETRATO) {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: ancho, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
    margin: [0, 8, 0, 8],
  }
}

export function tituloSeccion(texto) {
  return { text: texto, style: 'seccion' }
}

export function subtituloSeccion(texto) {
  return { text: texto, style: 'subseccion' }
}

// Tabla de dos columnas etiqueta/valor, sin bordes — para bloques de "Datos de..."/"Resumen"
export function tablaClaveValor(filas) {
  return {
    table: {
      widths: ['35%', '65%'],
      body: filas.map(([etiqueta, valor]) => [
        { text: etiqueta, style: 'etiqueta' },
        { text: valorOTexto(valor), style: 'normal' },
      ]),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 8],
  }
}

function encabezadoPaginaTexto(textoIzquierda, ancho) {
  return (currentPage, pageCount) => ({
    margin: [40, 20, 40, 0],
    stack: [
      {
        columns: [
          { text: textoIzquierda, style: 'headerPagina' },
          { text: `Página ${currentPage} de ${pageCount}`, style: 'headerPagina', alignment: 'right' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: ancho, y2: 4, lineWidth: 0.5, lineColor: '#cccccc' }] },
    ],
  })
}

// Mismo pie de página en TODAS las exportaciones de la app — texto institucional fijo, con
// la fecha de generación calculada una sola vez antes de armar el documento (no en cada
// llamada de `footer`, para que diga lo mismo en todas las páginas)
function piePaginaInstitucional(fechaGeneracionTexto) {
  return () => ({
    margin: [40, 10, 40, 20],
    text: `Generado el ${fechaGeneracionTexto} — Sistema de Historia Clínica, Círculo de Retirados y Pensionados de la Policía de Entre Ríos`,
    style: 'footer',
  })
}

// Esqueleto común de cualquier documento exportado por la app: tamaño de página, header/pie
// repetidos, estilos base. Cada módulo de exportación arma su propio `content` después.
export function documentoBase({ headerTexto, fechaGeneracionTexto, pageOrientation = 'portrait' }) {
  return {
    pageSize: 'A4',
    pageOrientation,
    pageMargins: [40, 55, 40, 55],
    header: encabezadoPaginaTexto(headerTexto, anchoContenido(pageOrientation)),
    footer: piePaginaInstitucional(fechaGeneracionTexto),
    defaultStyle: { fontSize: 9.5 },
    styles: ESTILOS_PDF,
    content: [],
  }
}

// Único punto que toca pdfmake de verdad — import dinámico a propósito: pdfmake + sus
// fuentes pesan ~1.8MB entre los dos archivos (build/pdfmake.js + build/vfs_fonts.js), no
// tiene sentido sumarlo al bundle principal de la app para una acción que se usa
// ocasionalmente. Se resuelve recién la primera vez que se exporta algo — memoizado
// (`pdfMakePromise`) para que una segunda exportación en la misma sesión no vuelva a pagar
// el costo del import dinámico. Registra las fuentes a mano
// (`pdfMake.addVirtualFileSystem(vfs)`) en vez de depender del side-effect global que trae
// `vfs_fonts.js` por su cuenta (funciona, pero depende del orden de imports de forma
// implícita — esto es explícito).
let pdfMakePromise = null

async function cargarPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import('pdfmake/build/pdfmake.js'),
      import('pdfmake/build/vfs_fonts.js'),
    ]).then(([{ default: pdfMake }, { default: vfs }]) => {
      pdfMake.addVirtualFileSystem(vfs)
      return pdfMake
    })
  }
  return pdfMakePromise
}

// `download()` es async (arma el blob completo antes de disparar la descarga) — hay que
// esperarlo, si no quien llama a esta función seguiría de largo (cerraría un modal, por
// ejemplo) antes de que termine de generarse, y un error asincrónico ahí no se llegaría a
// mostrar
export async function generarPdf(docDefinition, nombreArchivo) {
  const pdfMake = await cargarPdfMake()
  return pdfMake.createPdf(docDefinition).download(nombreArchivo)
}
