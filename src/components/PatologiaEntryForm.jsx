import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ESTADOS_PATOLOGIA } from '@/lib/patologias'
import { registrarAuditoria } from '@/lib/auditoria'

// Mismo concepto que ConsultaEntryForm.jsx (ver CLAUDE.md — experimento de "cuaderno
// continuo" pedido por los médicos, extendido al resto de la ficha): el alta se renderiza en
// línea, sin overlay, dentro del flujo de la sección de HistoriaClinica.jsx; editar sigue
// siendo un modal, eso no cambió.
export default function PatologiaEntryForm({ pacienteId, patologia, onClose, onSaved }) {
  const esEdicion = Boolean(patologia)
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(patologia?.usuario_id || null)
  const [nombre, setNombre] = useState(patologia?.nombre || '')
  const [estado, setEstado] = useState(patologia?.estado || 'Activa')
  const [observaciones, setObservaciones] = useState(patologia?.observaciones || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // usuario_id es obligatorio en la base (a diferencia de antecedentes, que no rastrea quién
  // carga) — el selector va siempre visible, no solo en edición
  useEffect(() => {
    async function cargarProfesionales() {
      const { data, error } = await supabase
        .from('profesionales')
        .select('id, nombre, activo')
        .eq('activo', true)
        .order('nombre')

      if (error) {
        setError(error.message)
        return
      }

      // Si se edita una patología cargada por alguien ya dado de baja, lo agregamos igual
      // a la lista (marcado) — no tiene sentido que la edición borre o falsee quién la
      // cargó realmente
      const idOriginal = patologia?.usuario_id
      if (idOriginal && !data.some((p) => p.id === idOriginal)) {
        const { data: inactivo } = await supabase
          .from('profesionales')
          .select('id, nombre, activo')
          .eq('id', idOriginal)
          .maybeSingle()

        if (inactivo) {
          setProfesionales([...data, inactivo])
          return
        }
      }

      setProfesionales(data)
    }

    cargarProfesionales()
  }, [patologia?.usuario_id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién carga antes de guardar.')
      return
    }

    setLoading(true)

    if (esEdicion) {
      const { error: auditoriaError } = await registrarAuditoria({
        tabla: 'patologias',
        registroId: patologia.id,
        accion: 'editar',
        usuarioId: profesionalId,
        valoresAnteriores: patologia,
      })

      if (auditoriaError) {
        setLoading(false)
        setError(auditoriaError.message)
        return
      }
    }

    // fecha_diagnostico se sacó del formulario a pedido del cliente (ver CLAUDE.md) — la
    // columna sigue existiendo en la base sin tocar, HistoriaClinica.jsx la sigue mostrando
    // si una patología vieja ya la tenía cargada, pero no se pide más acá. Al no incluirla
    // en el payload, editar una patología vieja con el dato cargado no lo borra — Supabase
    // deja esa columna tal como estaba.
    const payload = {
      nombre,
      estado,
      observaciones: observaciones || null,
      usuario_id: profesionalId,
    }

    const query = esEdicion
      ? supabase.from('patologias').update(payload).eq('id', patologia.id)
      : supabase.from('patologias').insert({ paciente_id: pacienteId, ...payload })

    const { data, error } = await query.select().single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved(data)
  }

  const campos = (
    <>
      <div className="space-y-2">
        <label className="text-sm text-text-secondary">
          ¿Quién carga? <span className="text-text-primary">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {profesionales.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProfesionalId(p.id)}
              className={
                'rounded-lg px-4 py-2 text-base font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ' +
                (profesionalId === p.id
                  ? 'bg-accent-marino text-white border-accent-marino shadow-sm'
                  : 'bg-surface text-text-primary border-border hover:bg-background')
              }
              style={{ minHeight: '44px' }}
            >
              {p.nombre}
              {p.activo === false ? ' (dado de baja)' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-secondary">
          Nombre <span className="text-text-primary">*</span>
        </label>
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Diabetes tipo 2"
          className="input"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-secondary">
          Estado <span className="text-text-primary">*</span>
        </label>
        <select required value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
          {ESTADOS_PATOLOGIA.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-secondary">Observaciones</label>
        <textarea
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="input"
        />
      </div>
    </>
  )

  if (esEdicion) {
    return (
      <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
        <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md">
          <form onSubmit={handleSubmit}>
            <div className="px-4 sm:px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Editar patología</h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4">{campos}</div>

            {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

            <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-text-primary">Nueva patología</h3>

      {campos}

      {error && <p className="text-base text-text-primary">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar patología'}
        </button>
      </div>
    </form>
  )
}
