import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const initialForm = {
  motivo: '',
  examen_fisico: '',
  diagnostico: '',
  tratamiento: '',
  medicacion: '',
  evolucion: '',
  pronostico: '',
  proximo_control: '',
  observaciones: '',
  presion_sistolica: '',
  presion_diastolica: '',
  frecuencia_cardiaca: '',
  temperatura: '',
  frecuencia_respiratoria: '',
  saturacion_oxigeno: '',
  peso: '',
  talla: '',
  glucemia: '',
}

const CAMPOS_NUMERICOS = new Set([
  'presion_sistolica',
  'presion_diastolica',
  'frecuencia_cardiaca',
  'temperatura',
  'frecuencia_respiratoria',
  'saturacion_oxigeno',
  'peso',
  'talla',
  'glucemia',
])

export default function NuevaConsultaModal({ pacienteId, onClose, onCreated }) {
  const [profesionales, setProfesionales] = useState([])
  const [profesionalId, setProfesionalId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('profesionales')
      .select('id, nombre')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfesionales(data)
      })
  }, [])

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!profesionalId) {
      setError('Elegí quién atiende antes de guardar.')
      return
    }

    setLoading(true)

    const payload = {
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      fecha: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          value === '' ? null : CAMPOS_NUMERICOS.has(key) ? Number(value) : value,
        ])
      ),
    }

    const { data, error } = await supabase
      .from('consultas')
      .insert(payload)
      .select('*, profesionales(nombre)')
      .single()

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onCreated(data)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Nueva consulta</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm text-slate-600">
                ¿Quién atiende? <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {profesionales.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProfesionalId(p.id)}
                    className={
                      'rounded-lg px-4 py-2 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ' +
                      (profesionalId === p.id
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50')
                    }
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Signos vitales</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="P.A. sistólica">
                  <input
                    type="number"
                    value={form.presion_sistolica}
                    onChange={handleChange('presion_sistolica')}
                    className="input"
                  />
                </Field>
                <Field label="P.A. diastólica">
                  <input
                    type="number"
                    value={form.presion_diastolica}
                    onChange={handleChange('presion_diastolica')}
                    className="input"
                  />
                </Field>
                <Field label="Frec. cardíaca">
                  <input
                    type="number"
                    value={form.frecuencia_cardiaca}
                    onChange={handleChange('frecuencia_cardiaca')}
                    className="input"
                  />
                </Field>
                <Field label="Temperatura">
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperatura}
                    onChange={handleChange('temperatura')}
                    className="input"
                  />
                </Field>
                <Field label="Frec. respiratoria">
                  <input
                    type="number"
                    value={form.frecuencia_respiratoria}
                    onChange={handleChange('frecuencia_respiratoria')}
                    className="input"
                  />
                </Field>
                <Field label="Saturación O₂">
                  <input
                    type="number"
                    value={form.saturacion_oxigeno}
                    onChange={handleChange('saturacion_oxigeno')}
                    className="input"
                  />
                </Field>
                <Field label="Peso (kg)">
                  <input
                    type="number"
                    step="0.1"
                    value={form.peso}
                    onChange={handleChange('peso')}
                    className="input"
                  />
                </Field>
                <Field label="Talla (cm)">
                  <input
                    type="number"
                    value={form.talla}
                    onChange={handleChange('talla')}
                    className="input"
                  />
                </Field>
                <Field label="Glucemia">
                  <input
                    type="number"
                    value={form.glucemia}
                    onChange={handleChange('glucemia')}
                    className="input"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Motivo">
                <textarea value={form.motivo} onChange={handleChange('motivo')} className="input" rows={2} />
              </Field>
              <Field label="Examen físico">
                <textarea
                  value={form.examen_fisico}
                  onChange={handleChange('examen_fisico')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Diagnóstico">
                <textarea
                  value={form.diagnostico}
                  onChange={handleChange('diagnostico')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Tratamiento">
                <textarea
                  value={form.tratamiento}
                  onChange={handleChange('tratamiento')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Medicación">
                <textarea
                  value={form.medicacion}
                  onChange={handleChange('medicacion')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Evolución">
                <textarea
                  value={form.evolucion}
                  onChange={handleChange('evolucion')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Pronóstico">
                <textarea
                  value={form.pronostico}
                  onChange={handleChange('pronostico')}
                  className="input"
                  rows={2}
                />
              </Field>
              <Field label="Próximo control">
                <input
                  type="date"
                  value={form.proximo_control}
                  onChange={handleChange('proximo_control')}
                  className="input"
                />
              </Field>
              <Field label="Observaciones">
                <textarea
                  value={form.observaciones}
                  onChange={handleChange('observaciones')}
                  className="input"
                  rows={2}
                />
              </Field>
            </div>
          </div>

          {error && <p className="px-4 sm:px-6 text-sm text-red-600 -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-slate-600">{label}</label>
      {children}
    </div>
  )
}
