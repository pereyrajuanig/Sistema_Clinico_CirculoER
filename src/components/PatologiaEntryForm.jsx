import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { ESTADOS_PATOLOGIA } from '@/lib/patologias'
import { registrarAuditoria } from '@/lib/auditoria'
import SelectorColorResaltado from '@/components/SelectorColorResaltado'

// Mismo concepto que ConsultaEntryForm.jsx (ver CLAUDE.md — experimento de "cuaderno
// continuo" pedido por los médicos, extendido al resto de la ficha): el alta se renderiza en
// línea, sin overlay, dentro del flujo de la sección de HistoriaClinica.jsx; editar sigue
// siendo un modal, eso no cambió.
//
// `submitEsPrimario` (default true, sin cambios en el resto de los usos): en `false` cuando
// este alta se abrió desde el acceso rápido dentro de "+ Nueva consulta" — ver el mismo
// comentario en AntecedenteEntryForm.jsx. Solo afecta al submit de ALTA, no al de "Editar".
export default function PatologiaEntryForm({
  pacienteId,
  patologia,
  onClose,
  onSaved,
  submitEsPrimario = true,
}) {
  const esEdicion = Boolean(patologia)
  const { profesional } = useAuth()
  const profesionalId = profesional?.id
  const [nombre, setNombre] = useState(patologia?.nombre || '')
  const [estado, setEstado] = useState(patologia?.estado || 'Activa')
  const [observaciones, setObservaciones] = useState(patologia?.observaciones || '')
  const [color, setColor] = useState(patologia?.color || null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('No hay un profesional activo en la sesión. Volvé a ingresar.')
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
      color,
    }

    const query = esEdicion
      ? supabase.from('patologias').update(payload).eq('id', patologia.id)
      : supabase.from('patologias').insert({ paciente_id: pacienteId, usuario_id: profesionalId, ...payload })

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

      <SelectorColorResaltado value={color} onChange={setColor} />
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
        <button
          type="submit"
          disabled={loading}
          className={submitEsPrimario ? 'btn-primary' : 'btn-secondary'}
        >
          {loading ? 'Guardando...' : 'Guardar patología'}
        </button>
      </div>
    </form>
  )
}
