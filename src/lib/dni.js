// Deja solo dígitos — así se guarda siempre igual en la base sin importar cómo se tipeó
export function limpiarDni(valor) {
  return (valor || '').replace(/\D/g, '')
}

// Agrega puntos de miles para mostrar en pantalla (12345678 -> 12.345.678)
export function formatearDni(valor) {
  const limpio = limpiarDni(valor)
  if (!limpio) return ''
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
