# Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

Este es el sistema de historia clínica que usan a diario 3 profesionales de salud (2 médicos
y una enfermera) de una entidad real que atiende a personal policial retirado y pensionado.
Antes de esto, las fichas de los pacientes vivían en papel — muchas, y con letra difícil de
leer. No es un ejercicio de facultad: hay datos de salud reales de personas reales detrás de
cada pantalla, y eso condicionó bastantes decisiones de este repo, desde el modelo de datos
hasta la tipografía.

## Stack, y por qué

**Backend: Supabase (Postgres + Auth + Storage), con RLS habilitado en todas las tablas.**
Con datos de salud de por medio, no quería que el control de acceso dependiera únicamente de
que el frontend se porte bien — Row Level Security lo resuelve a nivel de base de datos, así
que aunque una consulta se arme mal en el cliente, Postgres igual va a exigir una sesión
autenticada antes de devolver una fila. El plan gratuito de Supabase fue una decisión
pragmática, no ideal: es una entidad sin presupuesto de software, y el trade-off (el proyecto
se pausa por inactividad, no hay backups automáticos) está documentado como deuda técnica
conocida, no ignorado.

**Frontend: React 19 + Vite + Tailwind v4.** Sin exceso de dependencias — esto lo usan 3
personas desde 2 computadoras fijas, no hace falta más que eso. Tailwind v4 permitió definir
un sistema de tokens de color (`src/index.css`) que se reutiliza en modo claro y oscuro sin
duplicar clases por componente.

**Tipografía: Atkinson Hyperlegible.** Esta es la decisión que más se nota si la buscás: no es
la fuente "linda", es la que diseñó el Braille Institute específicamente para maximizar la
legibilidad en personas con baja visión. Una parte real de los usuarios de este sistema son
personas grandes, algunas no del todo cómodas con la tecnología — priorizar legibilidad sobre
estética no fue una frase de manual, fue la respuesta a un problema concreto. En la misma
línea: texto nunca menor a 16px, objetivo táctil mínimo de 44px en botones y campos, y un
selector de modo claro/oscuro con persistencia y detección de la preferencia del sistema. El
sistema de color pasó por una revisión real de contraste — la primera versión de los botones
primarios daba ~1.9:1 (texto blanco sobre celeste pastel), muy por debajo del mínimo de
accesibilidad, y se corrigió antes de darla por buena.

## Qué funciona hoy

**Autenticación.** Sin pantalla de registro público — en un sistema de datos de salud no
tiene sentido que cualquiera pueda crear una cuenta. Los 3 profesionales se dan de alta
manualmente desde el dashboard de Supabase, un trigger en la base los conecta con su fila en
`profesionales`, y la sesión queda persistente por computadora (no hace falta volver a
loguearse en cada uso) con expiración automática a los 45 minutos de inactividad.

**Pacientes.** Alta y edición con el modelo de datos completo, listado ordenable, y búsqueda
por nombre, apellido o DNI que funciona sea cual sea el formato con el que se escriba el
documento (con puntos, sin puntos). El DNI se normaliza a solo dígitos antes de guardarse —
una regla simple para evitar que el mismo paciente termine duplicado en el sistema por una
diferencia de formato.

**Historia clínica.** Cada paciente tiene su ficha completa: datos personales, antecedentes
(alergias, patológicos, quirúrgicos, hábitos, vacunas, medicación crónica), y el historial de
consultas, todos editables y con borrado. Si hay una alergia cargada, aparece un cartel visible
apenas se abre la ficha — no hace falta revisar todo el historial para enterarse. Cada consulta
arranca eligiendo quién la atiende de una lista corta — sin pedir usuario y contraseña de
nuevo. Esa decisión no es solo comodidad: la sesión del navegador queda abierta por horas en
una computadora compartida entre 3 personas, así que quién está logueado y quién está
atendiendo físicamente no son necesariamente la misma persona. Separar esas dos cosas
explícitamente es lo que hace que el registro de "quién atendió" sea confiable para
trazabilidad médico-legal, en vez de asumirlo de la sesión activa. Los signos vitales viven
como columnas directas de la consulta (no en una tabla aparte) porque en la práctica nunca
existen sueltos — siempre están atados a una consulta puntual, y modelarlos así evita un join
innecesario para el caso de uso que realmente importa: leer la ficha de un paciente. Un
listado aparte cruza todas las historias clínicas y muestra los próximos controles
pendientes, tomando el de la consulta más reciente de cada paciente (no cualquier consulta
vieja que ya haya sido superada por una visita posterior).

**Documentos adjuntos.** Estudios, análisis o fichas escaneadas se suben a un bucket privado
de Supabase Storage y se acceden con URLs firmadas de vencimiento corto — nunca queda un
archivo médico expuesto en una URL pública indefinida.

**Resultados de laboratorio.** Esta parte tuvo una vuelta de rosca interesante. La tabla de
resultados tiene una restricción (`CHECK constraint`) que limita `tipo_examen` a una lista
cerrada de 22 valores exactos — la descubrí corriendo `pg_get_constraintdef` sobre la base
en vez de asumir el esquema. El pedido real era poder cargar un "perfil lipídico" (colesterol,
HDL, LDL, triglicéridos) como una sola pantalla, porque así se piden y se leen en la práctica.
En vez de migrar el esquema para eso, el formulario agrupa la carga visualmente pero al
guardar genera las 4 filas con sus tipos reales — el atajo vive en el frontend
(`src/lib/laboratorio.js`), no en la base. Cada examen multi-valor (hemograma, hepatograma,
orina completa, urocultivo, coagulograma) tiene sus propios campos con las unidades correctas
confirmadas con un bioquímico, y el historial los agrupa por tipo y fecha.

**Medicamentos y stock.** El stock no es un número que se edita — es siempre el resultado de
sumar y restar movimientos (entradas por reposición, salidas por administración a un
paciente), calculado por dos vistas de la base. Ningún formulario tiene un campo de "stock
actual": si algo saliera mal, el número siempre se puede reconstruir desde el historial de
movimientos, que es justamente lo que se necesita para poder auditar qué pasó con un
medicamento. Al registrar una salida, el sistema sugiere automáticamente de qué lote
descontar aplicando FEFO (el que vence primero entre los que tienen stock) en vez de dejarlo
a criterio de quien carga los datos, busca al paciente por DNI en vez de un desplegable con
todos los pacientes (no escala), y exige un paciente asociado — reforzado también por una
restricción en la base, no solo en el formulario. Dos alertas corren en paralelo: stock por
debajo del mínimo definido para un medicamento, y lotes a 30 días o menos de vencer aunque el
medicamento todavía tenga stock en otro lote.

El CRUD de este módulo no es parejo entre tablas, a propósito: cada una tiene un nivel de
mutabilidad distinto según lo que representa. Un **medicamento** se puede editar libremente,
y "eliminar" es en realidad una baja lógica (deja de ofrecerse para nuevas entradas de stock,
pero sigue visible en el listado y en el historial — nada de datos huérfanos). Un **lote**
solo se puede editar o borrar mientras no se le haya sacado stock todavía (no alcanza con
"sin movimientos": crearlo ya genera su propio movimiento de entrada, así que la condición
real es "sin salidas") — en el momento en que se usó una sola vez, queda congelado. Un
**movimiento de stock** no se edita ni
se borra nunca, bajo ningún caso: es un libro contable, y un error se corrige con un
movimiento nuevo que compensa al anterior, no reescribiendo la historia.

## Modelo de datos y cumplimiento normativo

El modelo de paciente incluye el contacto de un familiar o referencia — no es un campo de
relleno, lo exige la Ley 26.529 (derechos del paciente, historia clínica y consentimiento
informado) en Argentina. Los permisos de la base son deliberadamente planos: los 3
profesionales tienen exactamente el mismo rol y acceso completo a todas las historias
clínicas, porque así es la organización real (cualquiera puede atender a cualquier paciente,
sin jerarquía entre ellos) — RLS diferenciado por rol hubiera sido complejidad sin un
problema real detrás. Las fichas en papel existentes no se migraron estructuralmente: cuando
un paciente con ficha vieja vuelve, se escanea y se adjunta como documento a su historia
digital, en vez de invertir tiempo en digitalizar retroactivamente letra manuscrita difícil
de leer.

## Qué sigue

- [ ] Corregir el borrado de consultas y antecedentes: hoy es físico (`DELETE`), y la
      normativa que sigue el proyecto exige retención de 10 años y borrado lógico, no físico
- [ ] Historial/listado de movimientos de stock por medicamento (hoy se ve el resultado, no
      el detalle de entradas/salidas) — paso previo para poder agregar un botón de "corregir
      este movimiento" que pre-complete el movimiento compensatorio
- [ ] PWA, para poder "instalar" la app en las computadoras del consultorio
- [ ] Automatizar el ping periódico que evite la pausa por inactividad del plan gratuito
- [ ] Backup automático de la base (el plan gratuito no lo incluye)
- [ ] Tests automatizados de los flujos críticos — hoy todo se prueba a mano

## Instalación

Requiere [pnpm](https://pnpm.io/) (no usar npm en este proyecto):

```bash
npm install -g pnpm   # si todavía no lo tenés
pnpm install
cp .env.example .env  # completar con tu URL y anon key de Supabase (Project Settings → API)
pnpm dev
```

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm preview` | Previsualizar el build |
| `pnpm lint` | Linter (oxlint) |

Variables de entorno (`.env`, ver `.env.example`):

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon) del proyecto |

Vite solo lee `.env` al arrancar el servidor — si lo editás, hay que reiniciar `pnpm dev`.

### Estructura

```
src/
├── assets/        # Logo institucional
├── components/    # Modales, formularios y controles reutilizables
├── lib/           # Contextos (auth, tema) y utilidades (dni, laboratorio, antecedentes)
├── pages/         # Login, Pacientes, Historia Clínica, Próximos controles, Medicamentos
├── App.jsx        # Rutas
└── index.css      # Tokens de diseño y clases de componentes compartidas
```

Alias de import: `@/` apunta a `src/`.

### Alta de usuarios

No hay registro público. Se crean desde el dashboard de Supabase: Authentication → Users →
Add user. Un trigger crea automáticamente la fila en `profesionales`, tomando el email como
nombre por defecto — hay que entrar a esa tabla y completar el nombre real de cada
profesional a mano.
