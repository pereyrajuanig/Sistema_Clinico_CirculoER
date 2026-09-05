import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PRESENTACIONES, mensajeErrorMedicamento } from '@/lib/medicamentos'

const initialForm = {
  nombre: '',
  presentacion: '',
  presentacion_detalle: '',
  concentracion: '',
  stock_minimo: '',
}

export default function MedicamentoFormModal({ medicamento, onClose, onSaved }) {
  const esEdicion = Boolean(medicamento)
  const [form, setForm] = useState(() =>
    esEdicion
      ? Object.fromEntries(
          Object.keys(initialForm).map((key) => [key, medicamento[key] ?? ''])
        )
      : initialForm
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const esOtra = form.presentacion === 'Otra'

    const payload = {
      nombre: form.nombre,
      presentacion: form.presentacion || null,
      presentacion_detalle: esOtra ? form.presentacion_detalle : null,
      concentracion: form.concentracion || null,
      stock_minimo: form.stock_minimo === '' ? null : Number(form.stock_minimo),
    }

    const query = esEdicion
      ? supabase.from('medicamentos').update(payload).eq('id', medicamento.id)
      : supabase.from('medicamentos').insert(payload)

    const { data, error } = await query.select().single()

    setLoading(false)

    if (error) {
      setError(mensajeErrorMedicamento(error))
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
              {esEdicion ? 'Editar medicamento' : 'Nuevo medicamento'}
            </h2>
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
              <select value={form.presentacion} onChange={handleChange('presentacion')} className="input">
                <option value="">Sin especificar</option>
                {PRESENTACIONES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            {form.presentacion === 'Otra' && (
              <Field label="Especificar presentación" required>
                <input
                  required
                  value={form.presentacion_detalle}
                  onChange={handleChange('presentacion_detalle')}
                  placeholder="Ej: Óvulos"
                  className="input"
                />
              </Field>
            )}

            <Field label="Concentración">
              <input
                value={form.concentracion}
                onChange={handleChange('concentracion')}
                placeholder="Ej: 500 mg"
                className="input"
              />
            </Field>

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

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

          <div className="px-4 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar medicamento'}
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
        {required && <span className="text-text-primary"> *</span>}
      </label>
      {children}
    </div>
  )
}
