// Resaltado de color para Antecedentes y Patologías (pedido explícito del cliente) — mismo
// concepto que un resaltador de papel: el profesional le pone un color a un antecedente o
// patología puntual para que se distinga a simple vista, sin que eso cambie su significado
// clínico (tipo, estado, etc.). Columna `color` (text, nullable) en `antecedentes` y
// `patologias` — ver CLAUDE.md para el ALTER TABLE exacto.
//
// Paleta chica y fija (no un color picker libre) — mismo criterio que el resto del sistema
// de diseño (paleta cerrada, ver design-system.md): tonos pastel nuevos, elegidos a
// propósito para no pisar los tres colores de acento ya reservados con otro significado
// (`primary` celeste, `alert` coral — exclusivo de alergias/errores/eliminar, `success`
// verde salvia) — reusar cualquiera de esos tres para "resaltado genérico" diluiría la señal
// que ya cumplen en el resto de la app. `verde`/`turquesa` comparten familia de color con
// `success`/`primary` pero son tonos bien distintos a propósito (más saturados/diferentes
// de matiz), para no confundirse con esos dos significados.
export const COLORES_RESALTADO = [
  { valor: 'amarillo', etiqueta: 'Amarillo', swatch: 'bg-highlight-amarillo' },
  { valor: 'naranja', etiqueta: 'Naranja', swatch: 'bg-highlight-naranja' },
  { valor: 'rosa', etiqueta: 'Rosa', swatch: 'bg-highlight-rosa' },
  { valor: 'purpura', etiqueta: 'Púrpura', swatch: 'bg-highlight-purpura' },
  { valor: 'turquesa', etiqueta: 'Turquesa', swatch: 'bg-highlight-turquesa' },
  { valor: 'verde', etiqueta: 'Verde', swatch: 'bg-highlight-verde' },
]

// Clases para el acento de una fila resaltada (border-l-4 + fondo tenue, mismo lenguaje
// visual que ya usa toda la ficha del paciente para border-primary/bg-surface) — a
// diferencia de esos tokens, acá el color SÍ es el dato (no un acento neutro), así que el
// tinte de fondo es un poco más marcado (15% en vez del 10% que usa "entrada en curso").
// Devuelve null si no hay color (sin color puesto), para que quien llama use su propio
// estilo por defecto en ese caso.
export function claseColorResaltado(color) {
  const clases = {
    amarillo: 'border-highlight-amarillo bg-highlight-amarillo/15',
    naranja: 'border-highlight-naranja bg-highlight-naranja/15',
    rosa: 'border-highlight-rosa bg-highlight-rosa/15',
    purpura: 'border-highlight-purpura bg-highlight-purpura/15',
    turquesa: 'border-highlight-turquesa bg-highlight-turquesa/15',
    verde: 'border-highlight-verde bg-highlight-verde/15',
  }
  return clases[color] || null
}
