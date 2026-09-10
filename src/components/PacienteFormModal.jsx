import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { limpiarDni } from '@/lib/dni'
import { SEXOS, GRUPOS_SANGUINEOS, capitalizarPalabras, limpiarTelefono } from '@/lib/pacientes'

// Campos de texto libre que se normalizan al guardar (ver capitalizarPalabras) — nombre,
// dirección, contacto de referencia, etc. Obra social queda afuera a propósito: se muestra
// en mayúscula sostenida donde se lee, pero se guarda tal cual se tipeó.
const CAMPOS_A_CAPITALIZAR = [
  'nombre',
  'apellido',
  'direccion',
  'contacto_familiar',
  'ocupacion',
  'estado_civil',
]

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

  // El DNI se filtra letra por letra a medida que se tipea (no solo al guardar) — si solo
  // se limpiara en handleSubmit, alguien podía escribir puras letras, ver el campo con
  // contenido y guardar sin darse cuenta de que se mandó un DNI vacío o truncado
  function handleChangeDni(e) {
    setForm((prev) => ({ ...prev, dni: limpiarDni(e.target.value) }))
  }

  // Mismo criterio que el DNI: filtrar mientras se tipea, no recién al guardar
  function handleChangeTelefono(e) {
    setForm((prev) => ({ ...prev, telefono: limpiarTelefono(e.target.value) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!limpiarDni(form.dni)) {
      setError('El DNI tiene que tener al menos un dígito.')
      return
    }

    setLoading(true)

    // Los campos opcionales vacíos se mandan como null en vez de string vacío
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => {
        if (value === '') return [key, null]
        if (CAMPOS_A_CAPITALIZAR.includes(key)) return [key, capitalizarPalabras(value)]
        return [key, value]
      })
    )
    payload.dni = limpiarDni(form.dni)

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
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.dni}
                onChange={handleChangeDni}
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

            <Field label="Sexo">
              <select value={form.sexo} onChange={handleChange('sexo')} className="input">
                <option value="">Sin especificar</option>
                {SEXOS.map((sexo) => (
                  <option key={sexo} value={sexo}>
                    {sexo}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Teléfono">
              <input
                inputMode="tel"
                value={form.telefono}
                onChange={handleChangeTelefono}
                className="input"
              />
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
              <select
                value={form.grupo_sanguineo}
                onChange={handleChange('grupo_sanguineo')}
                className="input"
              >
                <option value="">Sin especificar</option>
                {GRUPOS_SANGUINEOS.map((grupo) => (
                  <option key={grupo} value={grupo}>
                    {grupo}
                  </option>
                ))}
              </select>
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

          {error && <p className="px-4 sm:px-6 text-base text-text-primary -mt-2 pb-2">{error}</p>}

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
        {required && <span className="text-text-primary"> *</span>}
      </label>
      {children}
    </div>
  )
}
