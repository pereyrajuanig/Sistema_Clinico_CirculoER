export const ESTADOS_PATOLOGIA = ['Activa', 'Controlada', 'Resuelta']

const ORDEN_ESTADO = { Activa: 0, Controlada: 1, Resuelta: 2 }

// Agrupa por estado (Activa primero, Resuelta al final) y alfabético adentro de cada
// grupo — así lo activo hoy queda arriba sin tener que leer toda la lista
export function ordenarPatologias(patologias) {
  return [...patologias].sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre)
  )
}

// Activa usa `primary` (no `alert`, reservado para el cartel de alergias) para llamar la
// atención sin competir con esa señal. Controlada es neutra, mismo patrón que la badge de
// tipo de antecedente. Resuelta va apagada (sin fondo/borde de color, texto secundario) para
// que se lea de un vistazo como "esto ya no es relevante hoy".
export function claseEstadoPatologia(estado) {
  if (estado === 'Activa') {
    return 'bg-primary/10 border-primary text-text-primary font-semibold'
  }
  if (estado === 'Controlada') {
    return 'bg-border/50 border-border text-text-primary font-medium'
  }
  return 'bg-background border-border text-text-secondary font-normal'
}
