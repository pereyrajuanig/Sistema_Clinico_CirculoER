import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ESTADOS_MEDICACION } from '@/lib/medicacion'
import { registrarAuditoria } from '@/lib/auditoria'

// valoresIniciales: precarga opcional desde el atajo "+ Agregar a medicación habitual" de
// una consulta ({ nombre, fechaInicio, profesionalId }) — solo se usa al dar de alta, nunca
// si medicacion (edición) está presente. Es puramente una precarga de campos del
// formulario: no crea ninguna relación en la base con la consulta de origen.
export default function MedicacionFormModal({ pacienteId, medicacion, valoresIniciales, onClose, onSaved }) {
  const esEdicion = Boolean(medicacion)
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(
    medicacion?.usuario_id || valoresIniciales?.profesionalId || null
  )
  const [nombre, setNombre] = useState(medicacion?.nombre || valoresIniciales?.nombre || '')
  const [dosis, setDosis] = useState(medicacion?.dosis || '')
  const [estado, setEstado] = useState(medicacion?.estado || 'Activa')
  const [fechaInicio, setFechaInicio] = useState(
    medicacion?.fecha_inicio || valoresIniciales?.fechaInicio || ''
  )
  const [fechaFin, setFechaFin] = useState(medicacion?.fecha_fin || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // El selector va siempre, pero cumple dos roles distintos según el modo: al dar de ALTA
  // fija `usuario_id` (quién cargó, NOT NULL en la base, se guarda una sola vez y no se
  // vuelve a pedir ni modificar en ediciones posteriores); al EDITAR solo alimenta la
  // auditoría de ese cambio puntual — mismo patrón que AntecedenteFormModal.jsx
  useEffect(() => {
    supabase
      .from('profesionales')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfesionales(data)
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError(esEdicion ? 'Elegí quién edita antes de guardar.' : 'Elegí quién carga antes de guardar.')
      return
    }

    setLoading(true)

    if (esEdicion) {
      const { error: auditoriaError } = await registrarAuditoria({
        tabla: 'medicacion',
        registroId: medicacion.id,
        accion: 'editar',
        usuarioId: profesionalId,
        valoresAnteriores: medicacion,
      })

      if (auditoriaError) {
        setLoading(false)
        setError(auditoriaError.message)
        return
      }
    }

    const payload = {
      nombre,
      dosis: dosis || null,
      estado,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
    }

    const query = esEdicion
      ? supabase.from('medicacion').update(payload).eq('id', medicacion.id)
      : supabase
          .from('medicacion')
          .insert({ paciente_id: pacienteId, ...payload, usuario_id: profesionalId })

    const { data, error } = await query.select().single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved(data)
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              {esEdicion ? 'Editar medicación' : 'Nueva medicación'}
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">
                {esEdicion ? '¿Quién edita?' : '¿Quién carga?'}{' '}
                <span className="text-text-primary">*</span>
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
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Nombre del medicamento <span className="text-text-primary">*</span>
              </label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Losartán"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">Dosis</label>
              <input
                value={dosis}
                onChange={(e) => setDosis(e.target.value)}
                placeholder="Ej: 50mg cada 12hs"
                className="input"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-text-secondary">
                Estado <span className="text-text-primary">*</span>
              </label>
              <select required value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
                {ESTADOS_MEDICACION.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">Fecha de inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="input"
                />
              </div>

              {estado === 'Suspendida' && (
                <div className="space-y-1">
                  <label className="text-sm text-text-secondary">Fecha de fin</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="input"
                  />
                </div>
              )}
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar medicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
