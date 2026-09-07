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
pragmática, no ideal: es una entidad sin presupuesto de software, y sus límites quedan
documentados como deuda técnica conocida, no ignorados — y mitigados con GitHub Actions en
vez de ignorados. El proyecto se pausa a los 7 días sin actividad en la API: un workflow
(`.github/workflows/ping-supabase.yml`) pega contra la base cada 3 días, sin tocar ninguna
tabla real ni depender de una sesión. Tampoco incluye backups automáticos: otro workflow
(`.github/workflows/backup-db.yml`) corre `pg_dump` todos los domingos y sube el resultado a
un repositorio separado dedicado a backups — separado a propósito, para no mezclar código
fuente con volcados de datos de salud reales en la misma historia de git.

**Frontend: React 19 + Vite + Tailwind v4.** Sin exceso de dependencias — esto lo usan 3
personas desde 2 computadoras fijas, no hace falta más que eso. Tailwind v4 permitió definir
un sistema de tokens de color (`src/index.css`) que se reutiliza en modo claro y oscuro sin
duplicar clases por componente.

**PWA, con un límite deliberado.** La app se puede "instalar" en las computadoras del
consultorio — ícono propio, ventana sin barra de navegador, como una aplicación de
escritorio — pero eso es lo único que hace la PWA acá. No agrega soporte offline: es una
decisión de diseño explícita, no un olvido, porque el consultorio tiene internet estable y
porque cachear una respuesta de Supabase significaría poder mostrarle a alguien datos
clínicos desactualizados sin que se note (una alergia que ya no está cargada, o una que sí
y no aparece). El service worker generado precachea únicamente los archivos estáticos del
propio build; a propósito no tiene ninguna regla de cache para el dominio de Supabase, así
que sin conexión la app abre pero no hace nada — que es el comportamiento correcto para
datos que siempre tienen que ser los reales.

**Tipografía: Atkinson Hyperlegible.** Esta es la decisión que más se nota si la buscás: no es
la fuente "linda", es la que diseñó el Braille Institute específicamente para maximizar la
legibilidad en personas con baja visión. Una parte real de los usuarios de este sistema son
personas grandes, algunas no del todo cómodas con la tecnología — priorizar legibilidad sobre
estética no fue una frase de manual, fue la respuesta a un problema concreto. En la misma
línea: texto nunca menor a 16px, objetivo táctil mínimo de 44px en botones y campos, y un
selector de modo claro/oscuro con persistencia y detección de la preferencia del sistema.

El sistema de color pasó por una auditoría real de contraste (WCAG AA, 4.5:1 para texto
normal), calculada por luminancia relativa y no a ojo — varios pasteles de la paleta fallaban
como color de texto directo: blanco sobre el celeste `primary` daba ~1.9:1, el coral de alerta
como letra ~2.7:1, el verde de confirmación ~2:1. La regla que quedó es simple: los colores de
acento son para fondo, borde o ícono, nunca para texto — el texto siempre va en un tono neutro
oscuro. Un caso encontrado en el camino fue más sutil: el botón primario usa un celeste pastel
que se mantiene *claro* en modo oscuro (no se invierte como el fondo de página), así que el
texto no podía usar el mismo token que sí se invierte por tema — hacía eso, el texto del botón
principal desaparecía al cambiar a modo oscuro (contraste ~1.3:1). La solución fue un token de
texto fijo, que no cambia con el tema, reservado para textos que van sobre un fondo de color
fijo en vez del fondo de la página.

Otra media vuelta de tuerca fue el efecto secundario de un cambio anterior: al agregarle fondo
sólido a los botones secundarios para que se leyeran como clickeables (antes eran invisibles
hasta pasarles el mouse — un problema real para usuarios grandes poco familiarizados con la
tecnología, no solo estético), el texto gris que tenían encima bajó de contraste sin que nadie
lo notara a simple vista. Se detectó igual, calculando el número en vez de asumir que "se veía
bien".

## Qué funciona hoy

**Autenticación.** Sin pantalla de registro público — en un sistema de datos de salud no
tiene sentido que cualquiera pueda crear una cuenta. El login es una única cuenta
institucional del Círculo, compartida entre los 3 profesionales (no un login por persona),
con la sesión persistente por computadora (no hace falta volver a loguearse en cada uso) y
expiración automática a los 25 minutos de inactividad. La trazabilidad de "quién hizo qué"
no depende de la sesión — cada acción atribuible a una persona (atender una consulta,
administrar un medicamento, cargar un resultado, eliminar un registro) pide explícitamente
elegir quién la hace de una lista corta, independiente del login. Esa separación es a
propósito: con una cuenta compartida, quién está logueado y quién está haciendo la acción
físicamente nunca son la misma pregunta.

**Pacientes.** Alta y edición con el modelo de datos completo, listado ordenable, y búsqueda
por nombre, apellido o DNI que funciona sea cual sea el formato con el que se escriba el
documento (con puntos, sin puntos). El DNI se normaliza a solo dígitos antes de guardarse —
una regla simple para evitar que el mismo paciente termine duplicado en el sistema por una
diferencia de formato.

**Historia clínica.** Cada paciente tiene su ficha completa: datos personales, antecedentes
(alergias, patológicos, quirúrgicos, hábitos, vacunas, medicación crónica), y el historial de
consultas, todos editables y con borrado — un borrado **lógico**, no físico: "eliminar" un
antecedente o una consulta lo oculta de la ficha, pero el registro sigue existiendo en la
base con quién y cuándo lo borró. No es una decisión de diseño arbitraria: la normativa que
sigue el proyecto exige conservar la historia clínica 10 años, y un `DELETE` real la
destruiría antes de tiempo. Los documentos adjuntos de una consulta borrada tampoco se tocan
por la misma razón — un estudio escaneado es historia clínica igual que el texto. Si hay una
alergia cargada, aparece un cartel visible
apenas se abre la ficha — no hace falta revisar todo el historial para enterarse. Cada consulta
arranca eligiendo quién la atiende de una lista corta — sin pedir usuario y contraseña de
nuevo. Esa decisión dejó de ser solo comodidad cuando el login pasó a ser una cuenta
compartida entre las 3 personas: la sesión ya no dice nada sobre quién está atendiendo
físicamente, así que ese dato tiene que salir siempre de una elección explícita, nunca
inferirse. Mismo criterio se aplica a cualquier otra acción atribuible a alguien en el
sistema (administrar un medicamento, cargar un resultado, eliminar un registro) — todas
piden explícitamente quién la hace antes de guardar. Los signos vitales viven
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
confirmadas con un bioquímico, y el historial los agrupa por tipo y fecha. Este atajo del
perfil lipídico es, justamente, el primer lugar donde metí tests automatizados (`pnpm
test`, con Vitest): si el día de mañana se renombra un campo de la lista de exámenes sin
actualizar el atajo, un test lo detecta ahí — antes solo se hubiera visto como un
`CHECK constraint` rechazando la fila en producción.

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

El nombre de un medicamento solo no alcanza para identificarlo sin ambigüedad — puede haber
"Paracetamol 500mg" y "Paracetamol 1g" en el mismo catálogo — así que en cualquier lugar que
lo muestre (listado, selectores de entrada/salida, historial, alertas) se arma el identificador
combinando nombre y concentración, nunca el nombre a secas. La presentación (comprimidos,
jarabe, ampolla...) pasó de texto libre a un selector con opciones fijas para evitar variantes
de tipeo del mismo valor ("comprimido" vs. "Comprimidos"), con una opción "Otra" que exige
completar el detalle real — reforzado por una restricción en la base, igual que el resto de
las reglas que importan.

El CRUD de este módulo no es parejo entre tablas, a propósito: cada una tiene un nivel de
mutabilidad distinto según lo que representa. Un **medicamento** se puede editar libremente,
y "eliminar" es en realidad una baja lógica (deja de ofrecerse para nuevas entradas de stock,
pero sigue visible en el listado y en el historial — nada de datos huérfanos). Un **lote**
solo se puede editar o borrar mientras no se le haya sacado stock todavía (no alcanza con
"sin movimientos": crearlo ya genera su propio movimiento de entrada, así que la condición
real es "sin salidas") — en el momento en que se usó una sola vez, queda congelado. Un
**movimiento de stock** no se edita ni
se borra nunca, bajo ningún caso: es un libro contable, y un error se corrige con un
movimiento nuevo que compensa al anterior, no reescribiendo la historia. El historial
completo, de todos los medicamentos juntos, vive en su propia pantalla, con saldo acumulado
calculado por separado para cada medicamento (mezclar el de dos medicamentos distintos no
tendría sentido), tipo de movimiento diferenciado con un badge de borde y fondo suave (verde
para entrada, coral para salida, texto siempre en un tono neutro por la misma regla de
contraste), y filtros por medicamento, tipo, rango de fechas y texto libre por DNI del
paciente o nombre de quien registró. Cada fila tiene un botón "Corregir este movimiento" que
pre-completa la compensación (mismo lote, cantidad y tipo invertido) en vez de armarla a
mano — nunca toca la fila original, coherente con esa misma regla de inmutabilidad.

Este botón sacó a la luz una tensión real del modelo: toda salida exige un paciente asociado
(por trazabilidad médico-legal), así que corregir una *entrada* cargada de más — que necesita
una salida compensatoria — obliga a elegir un paciente aunque la corrección no sea una
administración real a nadie. No lo terminé "resolviendo" ocultándolo: el caso que sí queda
prolijo, sin este problema, es el que da como ejemplo la normativa interna (compensar una
*salida* de más con una entrada simple), y quedó documentado como una limitación conocida del
esquema en vez de una funcionalidad rota.

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

- [ ] Tests de componentes (`@testing-library/react` + mocks de `supabase-js`) para los dos
      flujos que se usan todos los días: alta de paciente y nueva consulta. Hoy los tests
      automatizados cubren solo lógica pura (`src/lib`), el resto se sigue probando a mano
- [ ] Subir el margen de `accent-marino` como texto sobre `primary` (botón "Editar" y accesos
      de header como "Medicamentos"/"Historial de movimientos"): da ~4.6:1, pasa el piso de
      WCAG AA pero con poco margen — no es urgente, pero conviene revisarlo si esa paleta
      cambia

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
| `pnpm test` | Tests automatizados (Vitest) |

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

### Login y alta de profesionales

No hay registro público, y no es un login por persona: las 3 personas usan la misma cuenta
institucional del Círculo (un único usuario de Supabase Auth). Dar de alta o dar de baja a
un profesional no crea ni borra nada en Auth — es una fila directo en la tabla
`profesionales` (Supabase → Table Editor), con una columna `activo` para dar de baja a
alguien sin perder el historial de lo que ya quedó atribuido a esa persona.
