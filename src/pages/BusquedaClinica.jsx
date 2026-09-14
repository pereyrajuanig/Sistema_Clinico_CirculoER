import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { formatearDni } from '@/lib/dni'
import Header from '@/components/Header'

const MIN_CARACTERES = 2

// Configuración por modo — MEDICACION y PATOLOGIAS no comparten forma (una tiene
// dosis/fecha_inicio, la otra fecha_diagnostico, y sus estados vigentes no son los
// mismos), así que cada modo pide explícitamente solo las columnas que existen en su
// tabla — pedir `dosis` en patologias (o `fecha_diagnostico` en medicacion) tira error.
const CONFIG_MODO = {
  medicacion: {
    tabla: 'medicacion',
    etiqueta: 'Medicación',
    campos: 'id, nombre, dosis, estado, fecha_inicio, pacientes(id, nombre, apellido, dni)',
    estadosVigentes: ['Activa'],
    estadosTodos: ['Activa', 'Suspendida'],
    etiquetaCheckbox: 'Incluir suspendidas',
    placeholder: 'Ej: Losartán',
  },
  patologias: {
    tabla: 'patologias',
    etiqueta: 'Patologías',
    campos: 'id, nombre, estado, pacientes(id, nombre, apellido, dni)',
    estadosVigentes: ['Activa', 'Controlada'],
    estadosTodos: ['Activa', 'Controlada', 'Resuelta'],
    etiquetaCheckbox: 'Incluir resueltas',
    placeholder: 'Ej: Diabetes',
  },
}

// Mes/año nomás (no día) — alcanza para "hace cuánto toma esto" en una línea de
// resultado compacta, y evita el mismo desfase de huso horario que el resto de la app
// resuelve forzando horario local en columnas `date` sin hora
function formatMesAnio(valor) {
  if (!valor) return ''
  const d = new Date(`${valor}T00:00:00`)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function detalleResultado(modo, r) {
  if (modo === 'medicacion') {
    const dosis = r.dosis ? ` ${r.dosis}` : ''
    const desde = r.fecha_inicio ? ` desde ${formatMesAnio(r.fecha_inicio)}` : ''
    return `${r.nombre}${dosis} — ${r.estado}${desde}`
  }
  return `${r.nombre} — ${r.estado}`
}

// Buscador cruzado: "¿qué pacientes toman tal medicamento/tienen tal patología?" — caso
// real ante un recall o un cambio de stock. Busca sobre MEDICACION/PATOLOGIAS (tablas
// estructuradas), no sobre el campo de texto libre `consultas.medicacion` — a propósito,
// ese es otro dato (lo indicado en una visita puntual, no la lista viva de qué toma el
// paciente hoy, ver detalle en el modelo de datos de CLAUDE.md).
export default function BusquedaClinica() {
  const [modo, setModo] = useState('medicacion')
  const [busqueda, setBusqueda] = useState('')
  const [incluirNoVigentes, setIncluirNoVigentes] = useState(false)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')

  const config = CONFIG_MODO[modo]

  useEffect(() => {
    const query = busqueda.trim()
    setError('')

    if (query.length < MIN_CARACTERES) {
      setResultados([])
      setBuscando(false)
      return
    }

    setBuscando(true)

    const timeoutId = setTimeout(() => {
      const cfg = CONFIG_MODO[modo]
      const estados = incluirNoVigentes ? cfg.estadosTodos : cfg.estadosVigentes

      supabase
        .from(cfg.tabla)
        .select(cfg.campos)
        .ilike('nombre', `%${query}%`)
        .is('eliminado_en', null)
        .in('estado', estados)
        .then(({ data, error }) => {
          setBuscando(false)

          if (error) {
            setError(error.message)
            return
          }

          setResultados(
            [...data].sort(
              (a, b) =>
                a.pacientes.apellido.localeCompare(b.pacientes.apellido) ||
                a.pacientes.nombre.localeCompare(b.pacientes.nombre)
            )
          )
        })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [modo, busqueda, incluirNoVigentes])

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Buscar por medicación o patología"
        actions={[{ label: '← Volver a pacientes', to: '/', variant: 'secondary' }]}
      />

      <main className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
        <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Buscar en</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CONFIG_MODO).map(([clave, cfg]) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setModo(clave)}
                  className={
                    'rounded-lg px-4 py-2 text-base font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ' +
                    (modo === clave
                      ? 'bg-accent-marino text-white border-accent-marino shadow-sm'
                      : 'bg-surface text-text-primary border-border hover:bg-background')
                  }
                  style={{ minHeight: '44px' }}
                >
                  {cfg.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-secondary">Nombre</label>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={config.placeholder}
              className="input"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={incluirNoVigentes}
              onChange={(e) => setIncluirNoVigentes(e.target.checked)}
            />
            {config.etiquetaCheckbox}
          </label>
        </div>

        {error && <p className="text-base text-text-primary">{error}</p>}

        {buscando && <p className="text-base text-text-secondary">Buscando...</p>}

        {!buscando && !error && busqueda.trim().length < MIN_CARACTERES && (
          <p className="text-base text-text-secondary">
            Escribí al menos {MIN_CARACTERES} caracteres para buscar.
          </p>
        )}

        {!buscando && !error && busqueda.trim().length >= MIN_CARACTERES && resultados.length === 0 && (
          <p className="text-base text-text-secondary">No se encontraron coincidencias.</p>
        )}

        {resultados.length > 0 && (
          <ul className="bg-surface border border-border rounded-lg overflow-hidden divide-y divide-border">
            {resultados.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/pacientes/${r.pacientes.id}`}
                  className="block px-4 py-3 hover:bg-background"
                >
                  <p className="text-base text-text-primary">
                    {r.pacientes.apellido}, {r.pacientes.nombre}
                    <span className="text-text-secondary"> — DNI {formatearDni(r.pacientes.dni)}</span>
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">{detalleResultado(modo, r)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
