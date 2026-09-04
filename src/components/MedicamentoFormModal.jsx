import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const initialForm = {
  nombre: '',
  presentacion: '',
  concentracion: '',
  unidad_medida: '',
  stock_minimo: '',
}

export default function MedicamentoFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      nombre: form.nombre,
      presentacion: form.presentacion || null,
      concentracion: form.concentracion || null,
      unidad_medida: form.unidad_medida || null,
      stock_minimo: form.stock_minimo === '' ? null : Number(form.stock_minimo),
    }

    const { data, error } = await supabase
      .from('medicamentos')
      .insert(payload)
      .select()
      .single()

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
            <h2 className="text-lg font-semibold text-text-primary">Nuevo medicamento</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <Field label="Nombre" required>
              <input
                required
                value={form.nombre}
                onChange={handleChange('nombre')}
                className="input"
              />
            </Field>

            <Field label="Presentación">
              <input
                value={form.presentacion}
                onChange={handleChange('presentacion')}
                placeholder="Ej: comprimidos, ampollas, jarabe"
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Concentración">
                <input
                  value={form.concentracion}
                  onChange={handleChange('concentracion')}
                  placeholder="Ej: 500 mg"
                  className="input"
                />
              </Field>

              <Field label="Unidad de medida">
                <input
                  value={form.unidad_medida}
                  onChange={handleChange('unidad_medida')}
                  placeholder="Ej: comprimido, ampolla"
                  className="input"
                />
              </Field>
            </div>

            <Field label="Stock mínimo">
              <input
                type="number"
                min="0"
                value={form.stock_minimo}
                onChange={handleChange('stock_minimo')}
                placeholder="Opcional — para alertar cuando el stock caiga por debajo"
                className="input"
              />
            </Field>
          </div>

          {error && <p className="px-4 sm:px-6 text-base text-alert -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar medicamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-text-secondary">
        {label}
        {required && <span className="text-alert"> *</span>}
      </label>
      {children}
    </div>
  )
}
