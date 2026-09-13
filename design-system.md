# Design System
## Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

---

## Principios

1. **Legibilidad por encima de tendencia.** Cada decisión de tipografía, tamaño y contraste
   prioriza que alguien no fluido con la tecnología pueda leer y tocar todo sin esfuerzo.
2. **Calma, no frialdad clínica.** Fondo neutro cálido, no el blanco-hospital que se siente
   frío ni el gris-SaaS genérico.
3. **El rojo se gana su lugar.** El color de alerta se usa exclusivamente para avisos reales
   (por ejemplo, alergias) — nunca decorativo. Así, cuando aparece, siempre significa algo.
4. **Una acción clara por pantalla.** Los botones usan verbos concretos que coinciden con lo
   que hacen ("Guardar paciente", no "Enviar" o "Confirmar").
5. **Contraste WCAG AA como piso, no como techo.** Todo texto debe cumplir 4.5:1 de contraste
   contra su fondo (3:1 para texto grande o bordes/íconos). No es negociable dado el perfil
   de usuarios de esta app — ante la duda, usar `text-primary` en vez de un color de acento
   como color de letra.

## Color

Paleta derivada del escudo oficial del Círculo (celeste y azul marino), en versión pastel
y suavizada — no una copia literal del escudo, sino una traducción de esos mismos tonos al
lenguaje de una interfaz de trabajo. El dorado y el rojo del escudo (sol, laureles, franja)
quedan fuera de la paleta de UI a propósito: son elementos heráldicos puntuales, no colores
de fondo o de botón, y forzarlos ahí rompería el criterio minimalista.

| Token | Hex | Uso |
|---|---|---|
| `background` | `#FAF6EC` | Fondo general — crema pastel |
| `surface` | `#FFFFFF` | Tarjetas, formularios, modales |
| `text-primary` | `#33363A` | Texto principal — casi negro, nunca negro puro |
| `text-secondary` | `#6B6F72` | Texto secundario, labels, ayuda |
| `primary` | `#9DC2DE` | Celeste del escudo, en pastel — botones, acentos, links |
| `primary-hover` | `#7BA8C7` | Estado hover/press del celeste |
| `accent-marino` | `#2E4C7A` | Azul marino del escudo — títulos grandes, énfasis puntual |
| `alert` | `#D98673` | Coral suave — exclusivo para alertas reales (ej. alergias) |
| `success` | `#9BC2A6` | Verde salvia pastel — confirmaciones |
| `border` | `#E8E1D3` | Bordes y divisores — en vez de sombras pesadas |

Nada de gradientes ni sombras difusas tipo tarjeta-SaaS — la separación entre elementos se
resuelve con bordes finos de 1px, más honesto y más liviano visualmente.

## Tipografía

**Atkinson Hyperlegible** para todo (títulos, texto, formularios) — no es una elección
estética al azar: es una tipografía diseñada específicamente por el Braille Institute para
maximizar la legibilidad en personas con baja visión o dificultad de lectura. Dado que una
buena parte de los usuarios de este sistema son personas grandes, es la elección que mejor
responde al problema real, no la que "se ve linda".

Un solo tipo de letra, variando el peso para jerarquía — dos familias tipográficas solo
suman complejidad visual sin necesidad en una herramienta de trabajo, no un sitio editorial.

| Uso | Tamaño | Peso |
|---|---|---|
| Título de pantalla | 24px | 700 |
| Subtítulo / sección | 18px | 600 |
| Texto de botones | 16px | 600 |
| Texto de formulario / tabla | 16px | 400 (nunca menos de 16px — evitar el 14px "de sistema") |
| Texto secundario / ayuda | 14px | 400 |

## Layout y componentes

- Contenido **alineado a la izquierda**, nunca centrado tipo landing — esto es una
  herramienta de trabajo, se lee y se escanea, no se "presenta".
- Formularios en una sola columna cuando sea posible; de a dos columnas máximo, nunca más
  densos que eso.
- Objetivo táctil mínimo de **44px de alto** en botones y campos — pensado para gente que no
  maneja el mouse con precisión quirúrgica.
- Radio de borde moderado (8px), consistente en toda la app — ni cero (frío) ni exagerado
  (infantil).
- El color `alert` (rojo) solo aparece en: el cartel de alergias, mensajes de error reales, y
  el botón de eliminar. En ningún otro lugar.

## Ejemplos de aplicación concreta

- **Cartel de alergia** (RF-17): fondo `alert` muy suave (10% opacidad) con borde en `alert`
  sólido e ícono en `alert`. El **texto** del mensaje va en `text-primary` (oscuro), nunca en
  color `alert` — el color de alerta en texto directo sobre fondo claro no cumple el
  contraste mínimo de accesibilidad (WCAG AA, 4.5:1). El color comunica la alerta a través
  del borde/ícono/fondo, no del texto.
- **Botón primario** ("Guardar paciente", "Ingresar"): fondo `primary`, texto oscuro fijo
  (token técnico `on-primary` en `src/index.css`) — NO blanco. El celeste pastel es
  demasiado claro para sostener texto blanco con contraste suficiente (da ~1.9:1; con
  texto oscuro sube a ~6.5:1). Hover `primary-hover`. Nunca más de un botón primario
  visible a la vez en una misma pantalla.
  **Importante en modo oscuro**: `primary` sigue siendo un celeste *claro* en la paleta
  oscura (no se oscurece como `background`/`surface`), así que el texto de este botón no
  puede usar el token `text-primary` normal — ese se invierte por tema para contrastar
  contra el fondo de página, y en modo oscuro se vuelve casi blanco (se probó: ~1.3:1
  contra este botón, prácticamente invisible). Necesita un color de texto que se quede
  oscuro en los dos temas.
- **Estado vacío** ("Todavía no hay pacientes cargados"): texto `text-secondary`, sin ilustración
  ni ícono decorativo — directo y funcional.

---
*Este documento define los tokens de diseño de la app. La implementación técnica (variables
CSS/Tailwind) vive en `src/index.css` del proyecto.*
