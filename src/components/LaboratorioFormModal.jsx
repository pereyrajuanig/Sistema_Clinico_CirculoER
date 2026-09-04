import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { GRUPOS_CARGA, OPCIONES_CRUCES, OPCIONES_CONTIENE } from '@/lib/laboratorio'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

// Combina los valores de los campos cargados en un solo texto para guardar en `resultado`,
// agregando la unidad de cada campo que la tenga definida
function combinarCampos(campos, valores) {
  return campos
    .map((c) => {
      const valor = valores[c.nombre]
      if (!valor || !valor.trim()) return null
      const unidad = c.unidad ? ` ${c.unidad}` : ''
      return `${c.nombre}: ${valor.trim()}${unidad}`
    })
    .filter(Boolean)
    .join(' · ')
}

// Igual que arriba, pero para exámenes de un solo valor (sin sub-campos)
function combinarSimple(examen, valor) {
  const texto = (valor || '').trim()
  if (!texto) return ''
  return examen.unidad ? `${texto} ${examen.unidad}` : texto
}

export default function LaboratorioFormModal({ pacienteId, onClose, onCreated }) {
  const { session } = useAuth()
  const [fecha, setFecha] = useState(hoyISO())
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [valores, setValores] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const examen = GRUPOS_CARGA.find((t) => t.nombre === tipoSeleccionado)
  const valor = valores[tipoSeleccionado]

  function handleSimpleChange(e) {
    setValores((prev) => ({ ...prev, [tipoSeleccionado]: e.target.value }))
  }

  function handleCampoChange(campo) {
    return (e) =>
      setValores((prev) => ({
        ...prev,
        [tipoSeleccionado]: { ...prev[tipoSeleccionado], [campo]: e.target.value },
      }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!examen) {
      setError('Elegí un examen antes de guardar.')
      return
    }

    // "Perfil lipídico" (y cualquier otro atajo similar) no es un tipo_examen real en la
    // base — se guarda como una fila independiente por cada campo, con su propio nombre real
    if (examen.separarEnFilas) {
      const filas = examen.campos
        .map((c) => {
          const resultado = combinarSimple(c, valor?.[c.nombre])
          if (!resultado) return null
          return {
            paciente_id: pacienteId,
            usuario_id: session.user.id,
            tipo_examen: c.nombre,
            resultado,
            fecha,
          }
        })
        .filter(Boolean)

      if (filas.length === 0) {
        setError('Cargá al menos un valor.')
        return
      }

      setLoading(true)
      const { data, error } = await supabase.from('resultados_laboratorio').insert(filas).select()
      setLoading(false)

      if (error) {
        setError(error.message)
        return
      }

      onCreated(data)
      return
    }

    const resultado = examen.campos
      ? combinarCampos(examen.campos, valor || {})
      : combinarSimple(examen, valor)

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
                  {GRUPOS_CARGA.map((t) => (
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
                onCampoChange={handleCampoChange}
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

function ExamenCampo({ examen, valor, onSimpleChange, onCampoChange }) {
  if (examen.campos) {
    const grupos = [...new Set(examen.campos.map((c) => c.grupo || null))]

    return (
      <div className="space-y-4">
        {grupos.map((grupo) => (
          <div key={grupo || '_sin_grupo'} className="space-y-2">
            {grupo && <p className="text-sm font-semibold text-text-primary">{grupo}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {examen.campos
                .filter((c) => (c.grupo || null) === grupo)
                .map((campo) => (
                  <CampoInput
                    key={campo.nombre}
                    campo={campo}
                    value={valor?.[campo.nombre] || ''}
                    onChange={onCampoChange(campo.nombre)}
                  />
                ))}
            </div>
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
        placeholder={examen.unidad || examen.placeholder}
        className="input"
      />
    </div>
  )
}

function CampoInput({ campo, value, onChange }) {
  const opciones = campo.tipo === 'cruces' ? OPCIONES_CRUCES : campo.tipo === 'binario' ? OPCIONES_CONTIENE : null

  return (
    <div className="space-y-1">
      <label className="text-sm text-text-secondary">{campo.nombre}</label>
      {opciones ? (
        <select value={value} onChange={onChange} className="input">
          <option value="">Sin cargar</option>
          {opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={onChange} placeholder={campo.unidad} className="input" />
      )}
    </div>
  )
}
