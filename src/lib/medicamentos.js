export const PRESENTACIONES = [
  'Comprimidos',
  'Cápsulas',
  'Jarabe',
  'Ampolla/Inyectable',
  'Crema/Pomada',
  'Gotas',
  'Supositorio',
  'Parche',
  'Combinado (comprimidos + cápsulas)',
  'Otra',
]

// Identificador visible de un medicamento: nombre solo no alcanza para distinguir entre
// presentaciones/dosis distintas del mismo principio activo (ej. "Paracetamol 500mg" vs
// "Paracetamol 1g") — usar esto en vez de medicamento.nombre en cualquier listado, selector,
// alerta o título que identifique un medicamento puntual
export function identificarMedicamento(medicamento) {
  if (!medicamento) return ''
  return [medicamento.nombre, medicamento.concentracion].filter(Boolean).join(' ')
}

// Cuando la presentación es "Otra", el valor real a mostrar vive en presentacion_detalle
export function formatearPresentacion(medicamento) {
  if (!medicamento?.presentacion) return ''
  if (medicamento.presentacion === 'Otra') return medicamento.presentacion_detalle || 'Otra'
  return medicamento.presentacion
}

export function mensajeErrorMedicamento(error) {
  if (error?.message?.includes('otra_requiere_detalle')) {
    return 'Tenés que especificar la presentación.'
  }
  return error?.message || 'Ocurrió un error inesperado.'
}
