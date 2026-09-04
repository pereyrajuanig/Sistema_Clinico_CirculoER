import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const initialForm = {
  nombre: '',
  apellido: '',
  dni: '',
  fecha_nacimiento: '',
  sexo: '',
  telefono: '',
  direccion: '',
  contacto_familiar: '',
  obra_social: '',
  grupo_sanguineo: '',
  ocupacion: '',
  estado_civil: '',
}

export default function PacienteFormModal({ paciente, onClose, onSaved }) {
  const esEdicion = Boolean(paciente)
  const [form, setForm] = useState(() =>
    esEdicion
      ? Object.fromEntries(Object.keys(initialForm).map((key) => [key, paciente[key] ?? '']))
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

    // Los campos opcionales vacíos se mandan como null en vez de string vacío
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value === '' ? null : value])
    )

    const query = esEdicion
      ? supabase.from('pacientes').update(payload).eq('id', paciente.id)
      : supabase.from('pacientes').insert(payload)

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
      <div className="bg-surface rounded-lg border border-border shadow-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">
              {esEdicion ? 'Editar paciente' : 'Nuevo paciente'}
            </h2>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" required>
              <input
                required
                value={form.nombre}
                onChange={handleChange('nombre')}
                className="input"
              />
            </Field>

            <Field label="Apellido" required>
              <input
                required
                value={form.apellido}
                onChange={handleChange('apellido')}
                className="input"
              />
            </Field>

            <Field label="DNI" required>
              <input
                required
                value={form.dni}
                onChange={handleChange('dni')}
                className="input"
              />
            </Field>

            <Field label="Fecha de nacimiento">
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={handleChange('fecha_nacimiento')}
                className="input"
              />
            </Field>

            <Field label="Sexo / género">
              <input value={form.sexo} onChange={handleChange('sexo')} className="input" />
            </Field>

            <Field label="Teléfono">
              <input value={form.telefono} onChange={handleChange('telefono')} className="input" />
            </Field>

            <Field label="Dirección">
              <input
                value={form.direccion}
                onChange={handleChange('direccion')}
                className="input"
              />
            </Field>

            <Field label="Contacto de familiar/referencia">
              <input
                value={form.contacto_familiar}
                onChange={handleChange('contacto_familiar')}
                className="input"
                placeholder="Nombre y teléfono"
              />
            </Field>

            <Field label="Obra social / n° de afiliado">
              <input
                value={form.obra_social}
                onChange={handleChange('obra_social')}
                className="input"
              />
            </Field>

            <Field label="Grupo sanguíneo">
              <input
                value={form.grupo_sanguineo}
                onChange={handleChange('grupo_sanguineo')}
                className="input"
              />
            </Field>

            <Field label="Ocupación">
              <input
                value={form.ocupacion}
                onChange={handleChange('ocupacion')}
                className="input"
              />
            </Field>

            <Field label="Estado civil">
              <input
                value={form.estado_civil}
                onChange={handleChange('estado_civil')}
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
              {loading ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar paciente'}
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
