import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { TIPOS_ANTECEDENTE } from '@/lib/antecedentes'
import { registrarAuditoria } from '@/lib/auditoria'
import SelectorColorResaltado from '@/components/SelectorColorResaltado'

// Mismo concepto que ConsultaEntryForm.jsx (ver CLAUDE.md — experimento de "cuaderno
// continuo" pedido por los médicos, extendido al resto de la ficha): el alta se renderiza en
// línea, sin overlay, dentro del flujo de la sección de HistoriaClinica.jsx; editar sigue
// siendo un modal, eso no cambió.
//
// `submitEsPrimario` (default true, sin cambios en el resto de los usos): en `false` cuando
// este alta se abrió desde el acceso rápido dentro de "+ Nueva consulta" — ahí ya hay otro
// botón primario en pantalla ("Guardar consulta"), y RNF-01 exige que no haya dos al mismo
// tiempo. Solo afecta al submit de ALTA — el de "Editar" (modal) sigue siendo siempre
// primario, esa combinación no la habilita ningún acceso rápido.
export default function AntecedenteEntryForm({
  pacienteId,
  antecedente,
  onClose,
  onSaved,
  submitEsPrimario = true,
}) {
  const esEdicion = Boolean(antecedente)
  const [tipo, setTipo] = useState(antecedente?.tipo || '')
  const [descripcion, setDescripcion] = useState(antecedente?.descripcion || '')
  const [color, setColor] = useState(antecedente?.color || null)
  const { profesional } = useAuth()
  const profesionalId = profesional?.id
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // El alta conserva al autor de la sesión; las ediciones solo atribuyen su auditoría.

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
        tabla: 'antecedentes',
        registroId: antecedente.id,
        accion: 'editar',
        usuarioId: profesionalId,
        valoresAnteriores: antecedente,
      })

      if (auditoriaError) {
        setLoading(false)
        setError(auditoriaError.message)
        return
      }
    }

    const query = esEdicion
      ? supabase.from('antecedentes').update({ tipo, descripcion, color }).eq('id', antecedente.id)
      : supabase
          .from('antecedentes')
          .insert({ paciente_id: pacienteId, tipo, descripcion, color, usuario_id: profesionalId })

    const { data, error } = await query.select('*, profesionales!usuario_id(nombre)').single()

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
          Tipo <span className="text-text-primary">*</span>
        </label>
        <select required value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
          <option value="" disabled>
            Elegir tipo...
          </option>
          {Object.entries(TIPOS_ANTECEDENTE).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-secondary">
          Descripción <span className="text-text-primary">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
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
              <h2 className="text-lg font-semibold text-text-primary">Editar antecedente</h2>
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
      <h3 className="text-lg font-semibold text-text-primary">Nuevo antecedente</h3>

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
          {loading ? 'Guardando...' : 'Guardar antecedente'}
        </button>
      </div>
    </form>
  )
}
