// Un borrador por paciente y origen del navegador. Nunca se envía a Supabase como
// consulta hasta que el profesional confirma "Guardar consulta".
export const FORM_CONSULTA_INICIAL = {
  motivo: '', tratamiento: '', evolucion: '',
  presion_sistolica: '', presion_diastolica: '', frecuencia_cardiaca: '',
  temperatura: '', frecuencia_respiratoria: '', saturacion_oxigeno: '',
  peso: '', talla: '', glucemia: '',
}

export const MEDICACION_NUEVA_INICIAL = { nombre: '', dosis: '' }

function clave(pacienteId) {
  return `hc:consulta-borrador:v1:${pacienteId}`
}

function camposDeTexto(valores, iniciales) {
  return Object.fromEntries(Object.keys(iniciales).map((campo) => [
    campo, typeof valores?.[campo] === 'string' ? valores[campo] : iniciales[campo],
  ]))
}

export function leerBorradorConsulta(pacienteId) {
  try {
    const datos = JSON.parse(localStorage.getItem(clave(pacienteId)))
    if (datos?.version !== 1 || !datos.form || typeof datos.form !== 'object') return null
    return {
      form: camposDeTexto(datos.form, FORM_CONSULTA_INICIAL),
      profesionalId: typeof datos.profesionalId === 'string' ? datos.profesionalId : null,
      mostrandoVitales: datos.mostrandoVitales === true,
      agregandoMedicacion: datos.agregandoMedicacion === true,
      medicacionNueva: camposDeTexto(datos.medicacionNueva, MEDICACION_NUEVA_INICIAL),
      // Si la medicación se insertó y la consulta falló, reanudar no debe insertarla otra vez.
      medicacionRegistrada: datos.medicacionRegistrada?.paciente_id === pacienteId &&
        typeof datos.medicacionRegistrada?.id === 'string' &&
        typeof datos.medicacionRegistrada?.nombre === 'string'
        ? datos.medicacionRegistrada : null,
    }
  } catch {
    // Un navegador sin almacenamiento disponible o un JSON dañado no rompe la ficha.
    return null
  }
}

export function tieneContenidoConsulta(borrador) {
  return Boolean(borrador.profesionalId || borrador.medicacionRegistrada ||
    Object.values(borrador.form).some((valor) => String(valor).trim() !== '') ||
    (borrador.agregandoMedicacion &&
      Object.values(borrador.medicacionNueva).some((valor) => String(valor).trim() !== '')))
}

export function guardarBorradorConsulta(pacienteId, borrador) {
  try {
    if (tieneContenidoConsulta(borrador)) {
      localStorage.setItem(clave(pacienteId), JSON.stringify({ ...borrador, version: 1 }))
    } else {
      localStorage.removeItem(clave(pacienteId))
    }
    return true
  } catch {
    return false
  }
}

export function eliminarBorradorConsulta(pacienteId) {
  try {
    localStorage.removeItem(clave(pacienteId))
    return true
  } catch {
    return false
  }
}
