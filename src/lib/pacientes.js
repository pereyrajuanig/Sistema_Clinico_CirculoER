export const SEXOS = ['F', 'M']

export const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// Nombre, apellido, dirección y el resto de los campos de texto libre de pacientes se
// normalizan al guardar (Cada Palabra Con Mayúscula Inicial, resto en minúscula) — mismo
// criterio que limpiarDni: normalizar en el momento de guardar, no depender de que cada
// profesional lo tipee siempre igual.
export function capitalizarPalabras(valor) {
  if (!valor) return valor

  return valor
    .split(' ')
    .map((palabra) =>
      palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : palabra
    )
    .join(' ')
}

// Obra social y grupo sanguíneo se muestran siempre en MAYÚSCULA SOSTENIDA sin importar
// cómo se haya guardado — a diferencia de capitalizarPalabras, esto es un formateo de
// visualización (se aplica donde se muestra el dato), no toca lo que quedó guardado.
export function formatearMayuscula(valor) {
  return valor ? valor.toUpperCase() : valor
}

// Años cumplidos a la fecha de hoy — no es un campo de la base, se calcula donde hace falta
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null

  const nacimiento = new Date(fechaNacimiento + 'T00:00:00')
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()

  const noCumplioAun =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
  if (noCumplioAun) edad--

  return edad
}
