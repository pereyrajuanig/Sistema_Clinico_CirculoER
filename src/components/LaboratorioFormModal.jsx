import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { TIPOS_EXAMEN } from '@/lib/laboratorio'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

// Combina los sub-valores cargados en un solo texto para guardar en la columna `resultado`
function combinarSubcampos(valores) {
  return Object.entries(valores)
    .filter(([, valor]) => valor.trim() !== '')
    .map(([campo, valor]) => `${campo}: ${valor.trim()}`)
    .join(' · ')
}

export default function LaboratorioFormModal({ pacienteId, onClose, onCreated }) {
  const { session } = useAuth()
  const [fecha, setFecha] = useState(hoyISO())
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [valores, setValores] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const examen = TIPOS_EXAMEN.find((t) => t.nombre === tipoSeleccionado)
  const valor = valores[tipoSeleccionado]

  function handleSimpleChange(e) {
    setValores((prev) => ({ ...prev, [tipoSeleccionado]: e.target.value }))
  }

  function handleSubcampoChange(subcampo) {
    return (e) =>
      setValores((prev) => ({
        ...prev,
        [tipoSeleccionado]: { ...prev[tipoSeleccionado], [subcampo]: e.target.value },
      }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!examen) {
      setError('Elegí un examen antes de guardar.')
      return
    }

    const resultado = examen.subcampos ? combinarSubcampos(valor || {}) : (valor || '').trim()

    if (!resultado) {
      setError('Cargá al menos un valor.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('resultados_laboratorio')
      .insert({
        paciente_id: pacienteId,
        usuario_id: session.user.id,
        tipo_examen: examen.nombre,
        resultado,
        fecha,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onCreated([data])
  }

  return (
    <div className="fixed inset-0 bg-text-primary/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Cargar resultado de laboratorio</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Examen <span className="text-alert">*</span>
                </label>
                <select
                  required
                  value={tipoSeleccionado}
                  onChange={(e) => setTipoSeleccionado(e.target.value)}
                  className="input"
                >
                  <option value="" disabled>
                    Elegir examen...
                  </option>
                  {TIPOS_EXAMEN.map((t) => (
                    <option key={t.nombre} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary">
                  Fecha <span className="text-alert">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {examen && (
              <ExamenCampo
                examen={examen}
                valor={valor}
                onSimpleChange={handleSimpleChange}
                onSubcampoChange={handleSubcampoChange}
              />
            )}
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-alert -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar resultado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ExamenCampo({ examen, valor, onSimpleChange, onSubcampoChange }) {
  if (examen.subcampos) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {examen.subcampos.map((subcampo) => (
          <div key={subcampo} className="space-y-1">
            <label className="text-sm text-text-secondary">{subcampo}</label>
            <input
              value={valor?.[subcampo] || ''}
              onChange={onSubcampoChange(subcampo)}
              className="input"
            />
          </div>
        ))}
      </div>
    )
  }

  if (examen.opciones) {
    return (
      <div className="space-y-1 max-w-xs">
        <label className="text-sm text-text-secondary">Resultado</label>
        <select value={valor || ''} onChange={onSimpleChange} className="input">
          <option value="">Sin cargar</option>
          {examen.opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-1 max-w-xs">
      <label className="text-sm text-text-secondary">Resultado</label>
      <input
        value={valor || ''}
        onChange={onSimpleChange}
        placeholder={examen.unidad}
        className="input"
      />
    </div>
  )
}
