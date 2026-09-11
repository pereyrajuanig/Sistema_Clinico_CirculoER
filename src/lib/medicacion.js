export const ESTADOS_MEDICACION = ['Activa', 'Suspendida']

const ORDEN_ESTADO = { Activa: 0, Suspendida: 1 }

// Agrupa Activa primero y alfabético adentro de cada grupo — mismo criterio que
// ordenarPatologias() en src/lib/patologias.js
export function ordenarMedicacion(medicacion) {
  return [...medicacion].sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre)
  )
}

// Mismo criterio visual que claseEstadoPatologia() — Activa usa `primary` (no `alert`,
// reservado al cartel de alergias), Suspendida va apagada (sin fondo/borde de color)
export function claseEstadoMedicacion(estado) {
  if (estado === 'Activa') {
    return 'bg-primary/10 border-primary text-text-primary font-semibold'
  }
  return 'bg-background border-border text-text-secondary font-normal'
}
