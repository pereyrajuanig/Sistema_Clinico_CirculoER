// Un borrador por paciente, profesional y origen del navegador. Nunca se envía como
// consulta hasta que el profesional confirma "Guardar consulta".
export const FORM_CONSULTA_INICIAL = {
  motivo: '', tratamiento: '', evolucion: '',
  presion_sistolica: '', presion_diastolica: '', frecuencia_cardiaca: '',
  temperatura: '', frecuencia_respiratoria: '', saturacion_oxigeno: '',
  peso: '', talla: '', glucemia: '',
}

export const MEDICACION_NUEVA_INICIAL = { nombre: '', dosis: '' }

function clave(pacienteId, profesionalId) {
  return profesionalId ? `hc:consulta-borrador:v2:${profesionalId}:${pacienteId}`
    : `hc:consulta-borrador:v1:${pacienteId}`
}

function camposDeTexto(valores, iniciales) {
  return Object.fromEntries(Object.keys(iniciales).map((campo) => [
    campo, typeof valores?.[campo] === 'string' ? valores[campo] : iniciales[campo],
  ]))
}

export function leerBorradorConsulta(pacienteId, profesionalId) {
  try {
    let datos = JSON.parse(localStorage.getItem(clave(pacienteId, profesionalId)))
    if (!datos && profesionalId) {
      const anterior = leerBorradorConsulta(pacienteId)
      // No recuperar automáticamente texto perteneciente a otra persona o sin autor.
      if (anterior?.profesionalId === profesionalId) datos = { ...anterior, version: 1 }
    }
    if (![1, 2].includes(datos?.version) || !datos.form || typeof datos.form !== 'object') return null
    if (profesionalId && datos.profesionalId !== profesionalId) return null
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
  return Boolean(borrador.medicacionRegistrada ||
    Object.values(borrador.form).some((valor) => String(valor).trim() !== '') ||
    (borrador.agregandoMedicacion &&
      Object.values(borrador.medicacionNueva).some((valor) => String(valor).trim() !== '')))
}

export function guardarBorradorConsulta(pacienteId, borrador) {
  try {
    if (tieneContenidoConsulta(borrador)) {
      localStorage.setItem(clave(pacienteId, borrador.profesionalId), JSON.stringify({ ...borrador, version: borrador.profesionalId ? 2 : 1 }))
    } else {
      localStorage.removeItem(clave(pacienteId, borrador.profesionalId))
    }
    return true
  } catch {
    return false
  }
}

export function eliminarBorradorConsulta(pacienteId, profesionalId) {
  try {
    localStorage.removeItem(clave(pacienteId, profesionalId))
    if (profesionalId && leerBorradorConsulta(pacienteId)?.profesionalId === profesionalId) {
      localStorage.removeItem(clave(pacienteId))
    }
    return true
  } catch {
    return false
  }
}

// Los borradores antiguos sin autor solo se trasladan si el usuario lo confirma.
export function recuperarBorradorAnterior(pacienteId, profesionalId) {
  const anterior = leerBorradorConsulta(pacienteId)
  if (!profesionalId || !anterior || anterior.profesionalId || leerBorradorConsulta(pacienteId, profesionalId)) return false
  if (!guardarBorradorConsulta(pacienteId, { ...anterior, profesionalId })) return false
  return eliminarBorradorConsulta(pacienteId)
}
