# Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

## Contexto del proyecto

Cliente privado real (no es trabajo de facultad) — primer proyecto profesional del
desarrollador. Sistema de historia clínica para uso interno de 3 profesionales
(2 médicos + 1 enfermera) que trabajan para el Círculo. Ver `ers-historia-clinica.md`
en este mismo repo para la especificación completa de requisitos.

## Stack

- React + Vite + Tailwind v4 + pnpm (NO usar npm)
- Backend: Supabase (Postgres + Auth + Storage + RLS), plan gratuito por ahora
- Router: react-router-dom
- Alias de imports: `@/` apunta a `src/`

## Decisiones clave de diseño (no las cambies sin confirmar con el usuario)

- Los 3 usuarios tienen el mismo rol/permisos — no hay diferenciación por tipo de
  profesional (RLS: cualquier autenticado tiene acceso total a las tablas)
- Sesión persistente por computadora + timeout por inactividad (25 min)
- **Login compartido, no 1 a 1 con las personas**: hay un único usuario de Supabase Auth
  (una cuenta institucional del Círculo), compartido entre los 3 — no hay pantalla pública
  de registro ni un login por profesional. `profesionales` es un catálogo independiente,
  desacoplado del login (ver sección de modelo de datos). La trazabilidad de "quién hizo
  qué" NUNCA sale de la sesión de Auth — sale siempre de un selector explícito
  ("¿Quién atiende?", "¿Quién registra...?") que hay que completar antes de guardar
  cualquier acción atribuible a una persona. Ver "Selectores explícitos de profesional"
  más abajo para el detalle de la migración y qué hay que revisar si se toca esto.
- No hay soporte offline (el cliente tiene internet estable) — **sigue así incluso
  después de agregar la PWA**: la PWA es solo para poder "instalar" la app (ícono
  propio, ventana sin barra de navegador), no para que funcione sin conexión. Ver
  sección de PWA más abajo.
- Sin integración con obra social/laboratorio (sistema cerrado)

## Modelo de datos (Supabase)

Historia clínica (`schema-historia-clinica.sql`):
- `profesionales` — catálogo independiente de personas habilitadas para atender/registrar,
  desacoplado del login desde el cambio a cuenta compartida (antes era 1 a 1 con
  `auth.users`, vía un trigger `handle_new_user` que ya **no existe**). Tiene una columna
  `activo` para dar de baja a alguien sin borrar su historial ni los registros que ya
  quedaron atribuidos a esa persona. Dar de alta o dar de baja un profesional se hace
  directo en la tabla (Supabase → Table Editor → `profesionales`) — **no** crea ni borra
  usuarios de Auth, porque ya no hay relación entre las dos cosas.
- `pacientes` — datos completos según Ley 26.529 + práctica estándar. `sexo` (`CHECK
  constraint` a `F`/`M` — así lo anotan los médicos en papel, no es "género") y
  `grupo_sanguineo` (`CHECK constraint` a A+/A-/B+/B-/AB+/AB-/O+/O-) son selectores
  fijos en `PacienteFormModal.jsx`, no texto libre — ambos opcionales. Ver
  `src/lib/pacientes.js`:
  - `SEXOS`, `GRUPOS_SANGUINEOS` — las listas fijas de arriba.
  - `capitalizarPalabras()` — normaliza al GUARDAR (no al mostrar, mismo criterio que
    `limpiarDni`) `nombre`, `apellido`, `direccion`, `contacto_familiar`, `ocupacion` y
    `estado_civil` a "Cada Palabra Con Mayúscula Inicial". **Ámbito exclusivo de
    pacientes** — no se aplica a `profesionales` ni a `medicamentos`, no reusar ahí sin
    que te lo pidan explícitamente.
  - `formatearMayuscula()` — al revés que la de arriba: formateo de VISUALIZACIÓN (se
    aplica donde se muestra el dato, no cambia lo guardado). Se usa para `obra_social`
    en todo lugar donde se lea (sigue siendo texto libre) y por las dudas también para
    `grupo_sanguineo` (ya no hace falta desde que es un selector fijo que siempre
    guarda bien escrito, pero no molesta dejarlo por si quedó algún dato viejo de
    antes del selector).
  - `calcularEdad()` — no es una columna, se calcula al vuelo desde `fecha_nacimiento`
    donde hace falta mostrarla (ficha del paciente, listado). Antes vivía duplicada
    como función local en `HistoriaClinica.jsx`; se centralizó acá cuando `Pacientes.jsx`
    también la necesitó, para no tener dos copias de la misma cuenta.
- `antecedentes` — tabla flexible (tipo + descripción): alergia, quirurgico, familiar,
  habito, vacuna. **Ya NO incluye `patologico` ni `medicacion_cronica`** — ver
  `patologias` y `medicacion` más abajo, que los reemplazaron por completo. Tiene
  `usuario_id` (FK a `profesionales`,
  **`NOT NULL`**, agregado después de la migración inicial) — quién CARGÓ el
  antecedente. Se fija una sola vez al dar de alta (`AntecedenteFormModal.jsx`, selector
  "¿Quién carga?", siempre visible) y **nunca se vuelve a tocar en ediciones
  posteriores** — el selector "¿Quién edita?" que aparece al editar alimenta
  únicamente la fila de `auditoria` de ese cambio puntual, no pisa `usuario_id`. Mismo
  criterio que `resultados_laboratorio.usuario_id` (`LaboratorioFormModal.jsx` lo fija
  al crear, `EditarResultadoLaboratorioModal.jsx` jamás lo actualiza) — **distinto** del
  de `consultas.profesional_id`, que si se reescribe en cada edición porque ahí "quién
  atendió" es dato clínico editable, no metadato de auditoría. Como `antecedentes` ya
  tenía una FK a `profesionales` por `eliminado_por`, cualquier embed
  (`.select('*, profesionales(nombre)')`) hay que desambiguarlo con
  `profesionales!usuario_id(nombre)` — mismo gotcha ya documentado más abajo para
  `consultas.eliminado_por`. `HistoriaClinica.jsx` muestra "Cargado por {nombre}" debajo
  de la descripción de cada antecedente (mismo criterio visual que "Atendió:" en
  `ConsultaCard`, adaptado al formato de lista compacta de esta sección).
- `patologias` — diagnósticos ACTIVOS del paciente (lo que tiene HOY, controlado o
  no — ej. "Diabetes tipo 2", "Hipertensión arterial"), a diferencia de
  `antecedentes` que es historia PASADA (alergias, cirugías previas, hábitos,
  vacunas). Reemplaza por completo al tipo `patologico` que existía antes en
  `antecedentes` — el único caso real que estaba cargado así se migró a esta tabla
  y `patologico` se sacó de `TIPOS_ANTECEDENTE` (`src/lib/antecedentes.js`) y del
  `CHECK constraint` de `antecedentes.tipo` en la base. De ahora en más, `patologias`
  es el único lugar donde cargar esto.

  Columnas: `paciente_id` (FK, `ON DELETE CASCADE` — distinto del resto de las
  tablas clínicas, que no tienen cascada porque un paciente nunca se borra; acá no
  cambia nada en la práctica por la misma razón, pero ojo si en algún momento
  cambia esa regla), `nombre` (texto libre — los diagnósticos son demasiado
  variados para un selector fijo), `estado` (`CHECK constraint patologias_estado_check`
  a exactamente `Activa`/`Controlada`/`Resuelta` — ver `ESTADOS_PATOLOGIA` en
  `src/lib/patologias.js`, tiene que matchear ese string carácter por carácter),
  `fecha_diagnostico` (date, opcional), `observaciones` (texto, opcional),
  `usuario_id` (FK a `profesionales`, **obligatorio** — a diferencia de
  `antecedentes`, que no rastrea quién carga un alta nueva, acá sí: es "quién
  cargó/editó por última vez", mismo patrón que `consultas.profesional_id` en
  `NuevaConsultaModal.jsx` — se pide siempre, no solo al editar, y se sobrescribe
  en cada edición con quien confirma el cambio), `eliminado_en`/`eliminado_por`
  (mismo patrón de baja lógica que `antecedentes`/`consultas`/
  `resultados_laboratorio`, con auditoría — ver "CRUD de las tablas clínicas" más
  abajo, `patologias` sigue exactamente esa misma regla).

  `src/lib/patologias.js`: `ESTADOS_PATOLOGIA` (la lista fija de arriba),
  `ordenarPatologias()` — agrupa Activa primero / Resuelta al final (prioridad
  explícita, no alfabética — aunque alfabéticamente ya darían ese orden, no hay
  que depender de esa coincidencia si se agrega un estado nuevo) y alfabético por
  `nombre` adentro de cada grupo, `claseEstadoPatologia()` — clases de Tailwind
  para la badge de estado en `HistoriaClinica.jsx`: Activa usa `primary` (no
  `alert`, reservado para el cartel de alergias, para no competir con esa señal),
  Controlada es neutra (mismo patrón que la badge de tipo de antecedente),
  Resuelta va apagada (sin fondo/borde de color, `text-text-secondary`) — así se
  distingue qué está vigente hoy sin leer cada fila.

  `PatologiaFormModal.jsx` (alta y edición, "+ Agregar patología"/"Editar" en
  `HistoriaClinica.jsx`) es estructuralmente más parecido a `NuevaConsultaModal.jsx`
  que a `AntecedenteFormModal.jsx`, justamente por el selector de profesional
  siempre visible (obligatorio por `usuario_id NOT NULL`) — incluye la misma
  lógica de agregar igual a la lista un profesional ya dado de baja si la
  patología que se edita fue cargada por esa persona (no falsear quién la cargó
  realmente).
- `medicacion` — medicación HABITUAL/VIGENTE del paciente (ej. "Losartán 50mg cada
  12hs"), reemplaza por completo al tipo `medicacion_cronica` que existía antes en
  `antecedentes` (mismo trato que `patologico` → `patologias`). **No confundir con
  el campo de texto libre `medicacion` de `consultas`** — ese es otra cosa, no se
  toca: es lo que se indicó puntualmente en esa visita (histórico, una entrada por
  consulta), mientras que la tabla `medicacion` es la lista viva de qué toma el
  paciente hoy. Los dos pueden decir lo mismo o no — no hay ninguna sincronización
  automática entre ambos, ver el atajo de precarga más abajo.

  Columnas: `paciente_id` (FK, `ON DELETE CASCADE`, igual que `patologias`),
  `nombre` (texto libre), `dosis` (texto libre, opcional, ej. "50mg cada 12hs" —
  separado de `nombre` a propósito), `estado` (`CHECK constraint
  medicacion_estado_check` a exactamente `Activa`/`Suspendida` — ver
  `ESTADOS_MEDICACION` en `src/lib/medicacion.js`), `fecha_inicio` (date,
  opcional), `fecha_fin` (date, opcional — en el formulario solo se muestra el
  campo cuando `estado` es Suspendida, mismo criterio de disclosure progresivo que
  "Otra" en presentación de medicamentos, aunque acá no hay ningún `CHECK
  constraint` que lo exija), `usuario_id` (FK a `profesionales`, obligatorio,
  **inmutable tras la carga** — mismo patrón que `antecedentes.usuario_id`, NO el
  de `patologias`/`consultas` que se reescribe en cada edición: el selector de
  `MedicacionFormModal.jsx` dice "¿Quién carga?" al dar de alta y "¿Quién edita?"
  al editar, pero solo el primero se guarda en la columna), `observaciones` (texto,
  existe en la base pero **no se expone en el formulario** — no se pidió, no hay
  ningún lugar que la muestre ni la edite; si hace falta en el futuro, agregar el
  campo a `MedicacionFormModal.jsx` es directo), `eliminado_en`/`eliminado_por`
  (mismo patrón de baja lógica + auditoría que el resto — ver "CRUD de las tablas
  clínicas" más abajo). Como `medicacion` también tiene `eliminado_por` además de
  `usuario_id`, cualquier embed de `profesionales` necesita `!usuario_id` o
  `!eliminado_por` para desambiguar — mismo gotcha que `antecedentes`/`consultas`
  (por ahora ningún `select` de `medicacion` embebe `profesionales`, porque no se
  muestra "cargado por" en esta sección — a diferencia de Antecedentes — pero si se
  agrega, ya se sabe qué hace falta).

  `src/lib/medicacion.js`: `ESTADOS_MEDICACION`, `ordenarMedicacion()` y
  `claseEstadoMedicacion()` — mismo criterio que sus equivalentes de
  `patologias.js` (Activa con `primary`, Suspendida apagada; agrupa Activa primero).

  **Visualización, pedido explícito del cliente**: la medicación activa (junto con
  las patologías activas) aparece en un panel resumen arriba de todo en
  `HistoriaClinica.jsx`, ANTES de "Datos del paciente" — para verse de un vistazo
  sin tener que bajar a ninguna sección ni abrir ninguna consulta puntual. Es
  puramente de lectura (sin botones), la gestión real (alta/edición/baja) sigue
  viviendo en la sección "Medicación habitual" más abajo en la página, que además
  separa lo Suspendido en un `<details>` colapsado (no es lo que importa ver de
  entrada) — mismo patrón lo activo-arriba/lo-secundario-colapsado que ya se usa
  para Patologías, salvo que Patologías no tiene panel resumen propio aparte de
  su sección normal (solo aporta su lista de activas al panel compartido).

  **Dos atajos distintos entre Consultas y Medicación, no confundir uno con
  otro** — los dos son solo precarga de formulario, **ninguno crea ninguna
  relación en la base entre `consultas` y `medicacion`** (no hay columna que
  guarde "esta medicación vino de tal consulta"); confirmar el alta sigue siendo
  siempre una decisión manual, nada se agrega solo, y en los dos casos el
  `usuario_id` que se guarda es un botón más del selector, editable como
  cualquier otro, no un valor forzado:

  1. **Desde la consulta ya guardada** (`ConsultaCard`, en `HistoriaClinica.jsx`):
     si la consulta tiene algo escrito en su campo `medicacion`, aparece un link
     "+ Agregar a medicación habitual" al lado de esa etiqueta. Abre
     `MedicacionFormModal.jsx` en modo alta (un modal aparte, la página de fondo)
     con `valoresIniciales` — `nombre` con el texto completo tal cual estaba en
     `consulta.medicacion` (sin separar automáticamente nombre de dosis),
     `fecha_inicio` con la fecha de esa consulta, profesional preseleccionado el
     que atendió (`consulta.profesional_id`).
  2. **Desde el formulario de Nueva/Editar consulta** (`NuevaConsultaModal.jsx`,
     pedido explícito del cliente): un apartado colapsable "+ Agregar a
     medicación habitual" — mismo patrón visual que "+ Agregar medicamento
     nuevo" en `EntradaStockModal.jsx` (`agregandoMedicacion` en el estado,
     botón que se convierte en "‹ Cancelar medicación habitual" para volver),
     con sus propios campos (Nombre, Dosis, Estado, Fecha de inicio/fin) **en
     blanco, sin relación con el campo `medicacion` de esa misma consulta** —
     decisión explícita del cliente para no arrastrar texto que puede no ser la
     medicación habitual real (ej. algo puntual de esa visita). Reusa el mismo
     `profesionalId` ya elegido en "¿Quién atiende?" — no pide un selector
     aparte, igual criterio que `EntradaStockModal.jsx` reusando "¿quién
     registra la entrada?" para el medicamento nuevo. En el submit, el insert a
     `medicacion` va ANTES que el guardado de la consulta — como no hay FK entre
     las dos tablas no hace falta que una exista para que la otra se guarde,
     pero si el insert de medicación falla se corta ahí (no se toca la consulta
     todavía), para no dejar al usuario sin saber si algo se guardó a medias.
     A diferencia del atajo 1, este vive DENTRO del mismo modal (no abre uno
     nuevo) — abrir `MedicacionFormModal.jsx` encima de `NuevaConsultaModal.jsx`
     hubiera sido un modal sobre otro modal, sin precedente en esta app, así
     que se descartó esa opción a propósito.
- `consultas` — núcleo del sistema, incluye signos vitales como columnas directas
  (siempre van pegados a una consulta, nunca sueltos). El campo `medicacion` (texto
  libre) es lo que se indicó en esa visita puntual — ver la aclaración de arriba en
  `medicacion` (la tabla) sobre por qué son dos cosas distintas sin sincronización
  automática entre sí.
- `documentos` — adjuntos opcionales por consulta
- `resultados_laboratorio` — tipo_examen (con `CHECK constraint` a una lista fija de
  22 valores, ver `src/lib/laboratorio.js`) + resultado (texto) + fecha

Medicamentos y stock (`migracion-02-medicamentos-stock.sql`, RF-21 a RF-26):
- `medicamentos` — catálogo (nombre, `droga` opcional — texto libre, el principio
  activo/genérico, ej. "Ibuprofeno", distinto de `nombre` que es la marca comercial
  del producto —, presentación, concentración, stock_minimo opcional, `activo`
  boolean default true — baja lógica). No tiene `unidad_medida`: se sacó por
  redundante con `presentacion` (si la presentación es "comprimidos", la unidad
  para contar stock ya es obvia). `presentacion` es un selector fijo (Comprimidos,
  Cápsulas, Jarabe, Ampolla/Inyectable, Crema/Pomada, Gotas, Supositorio, Parche,
  Combinado (comprimidos + cápsulas), Otra) para evitar variantes por tipeo libre;
  si se elige "Otra", el detalle real va en `presentacion_detalle` (obligatorio en
  ese caso por el `CHECK constraint otra_requiere_detalle`). Ver
  `src/lib/medicamentos.js` (`PRESENTACIONES`, `formatearPresentacion` — resuelve
  "Otra" al detalle en cualquier lugar donde se muestre, `mensajeErrorMedicamento`
  — traduce el error crudo de la constraint a un mensaje legible).

  **"Combinado (comprimidos + cápsulas)"** (agregado a pedido del cliente): cubre
  productos que se venden en un solo envase con dos formas farmacéuticas distintas
  adentro (ej. comprimidos de un principio activo + cápsulas de otro, para tomar
  juntos como una sola dosis diaria). Sigue siendo UN SOLO medicamento — una fila
  de catálogo, un stock, sus lotes, su vencimiento — igual que cualquier otra
  presentación; no hay ninguna relación entre dos medicamentos ni lógica especial
  en ningún lado del código más allá de esta opción en el `<select>`, porque
  `presentacion` es puramente descriptivo (no hay ningún cálculo de stock que
  dependa de su valor). El `CHECK constraint` de la base que valida los valores
  permitidos de `presentacion` ya se actualizó a mano en el SQL Editor (el usuario
  lo hizo, no yo) — si se agrega otra opción fija en el futuro, hay que
  actualizarlo ahí también, además de `PRESENTACIONES`. El nombre solo no
  identifica un medicamento sin ambigüedad
  (puede haber "Paracetamol 500mg" y "Paracetamol 1g"), así que en TODO lugar que
  muestre o liste un medicamento puntual en una sola línea (selectores de
  entrada/salida, historial de movimientos, alertas de stock bajo/vencimiento,
  confirmaciones, "Lotes de...") se usa `identificarMedicamento()` de
  `src/lib/medicamentos.js` (nombre + concentración), nunca `medicamento.nombre`
  solo. Cualquier query de Supabase que traiga un medicamento embebido (ej.
  `lotes!inner(..., medicamentos(nombre))`) tiene que pedir también
  `concentracion` en el mismo `select`, si no el dato ni siquiera llega para
  poder mostrarlo.

  **Excepción a propósito, no una violación de la regla de arriba**: la tabla de
  `/medicamentos` (`Medicamentos.jsx`) muestra "Marca Comercial" y "Concentración"
  como columnas SEPARADAS (`m.nombre` y `m.concentracion` crudos, sin pasar por
  `identificarMedicamento()`) — pedido explícito para que la concentración no
  quede pegada al nombre. Sigue sin ambigüedad porque las dos columnas están en
  la misma fila, visibles juntas; la regla de "nunca nombre solo" es sobre
  referencias de una sola línea (un `<option>`, un ítem de lista, un mensaje de
  confirmación) donde no hay una segunda columna al lado que aporte el dato. El
  resto de usos de `identificarMedicamento()` en `Medicamentos.jsx` (los dos
  carteles de alerta, el `confirm()` de dar de baja, el título de "Ver lotes de
  ...") siguen combinados, porque esos sí son de una sola línea. Mismo criterio
  en la tabla de `HistorialMovimientos.jsx` ("Marca Comercial" +
  "Concentración" separadas ahí también) — el filtro de medicamento de esa misma
  pantalla (el `<select>` de arriba de la tabla) sigue usando
  `identificarMedicamento()` combinado, porque un `<option>` es justo el caso de
  "una sola línea" que la excepción no cubre.

  **Ojo con el campo `nombre` en la UI**: la columna sigue llamándose `nombre` en
  la base (no se migró, para no tocar todas las queries/identificarMedicamento que
  ya dependen de ese nombre de columna), pero en TODOS los formularios se muestra
  con la etiqueta "Marca Comercial" (`MedicamentoFormModal.jsx` y el bloque de
  alta inline de `EntradaStockModal.jsx`) — si se agrega un formulario nuevo que
  toque este campo, usar esa misma etiqueta, no "Nombre" a secas.
  `droga text` se agregó suelto (`alter table medicamentos add column droga text;`,
  corrido a mano en el SQL Editor, no versionado — igual que el resto de las
  migraciones de este proyecto).
- `lotes` — un lote por ingreso, con su propia fecha_vencimiento
- `movimientos_stock` — única fuente de verdad del stock (tipo entrada/salida,
  cantidad, usuario_id, paciente_id obligatorio en salidas por constraint de base,
  consulta_id opcional). El stock nunca se edita directo, solo se calcula.
- Vistas `stock_por_lote` y `stock_por_medicamento` — stock actual calculado a
  partir de los movimientos, usadas para leer (nunca para escribir)

### Reglas de CRUD de Medicamentos y stock (no son parejas entre tablas)

- **`medicamentos`**: alta y edición normales. "Eliminar" en la UI **nunca hace
  `DELETE`** — hace `update activo = false` (dar de baja). Un medicamento inactivo:
  no aparece en el selector de `EntradaStockModal` (no se le repone stock) ni en el
  listado principal de `/medicamentos` (`handleDarDeBaja` en `Medicamentos.jsx`,
  filtra por `medicamentosActivos`), pero sí sigue apareciendo en `SalidaStockModal`
  (por si queda stock remanente para administrar) y no se excluye del historial.
  **Vive en una pantalla aparte**: `/medicamentos/inactivos`
  (`MedicamentosInactivos.jsx`, link "Medicamentos dados de baja" en las acciones
  del header de `/medicamentos`) — antes se mostraba mezclado en la tabla principal
  con una etiqueta "(dado de baja)", pero eso ensuciaba el listado del día a día
  (pedido explícito del cliente). Esa pantalla trae su propio fetch filtrando
  `eq('activo', false)`, y tiene las mismas acciones "Editar"/"Ver lotes" que la
  tabla principal (un medicamento inactivo no pierde acceso a su historial) más
  "Reactivar" (`handleReactivar`, `update activo = true`, saca la fila de la lista
  al instante). `MedicamentoFormModal` no tiene ningún campo para tocar `activo`
  directamente — activar/desactivar es siempre por estos botones dedicados, nunca
  desde el formulario de edición.
- **`lotes`**: editar o eliminar un lote **solo está permitido si no tiene ninguna
  `salida` en `movimientos_stock`** — OJO, no "ningún movimiento": `EntradaStockModal`
  siempre crea el lote junto con su movimiento tipo 'entrada' en el mismo paso, así
  que todo lote tiene como mínimo ese movimiento inicial. Ese movimiento de entrada
  no cuenta como "uso" — lo que bloquea editar/borrar es que ya se le haya sacado
  algo (una salida). Ver `LotesMedicamentoModal.jsx` (accesible con "Ver lotes"
  desde el listado de medicamentos), que consulta `movimientos_stock` filtrando
  `tipo = 'salida'`. El borrado ahí es físico (`DELETE`) y por el `ON DELETE CASCADE`
  de la base se lleva puesto también el movimiento de entrada — correcto, porque
  borrar un lote sin salidas es deshacer una carga entera por error, no editar un
  registro contable real.
- **`movimientos_stock`**: **nunca se edita ni se borra desde la UI, bajo ningún
  caso** — es un libro contable, no un dato editable. `HistorialMovimientos.jsx`
  (`/medicamentos/historial`, botón "Historial de movimientos" en el header de
  `/medicamentos`, al lado del título, con el mismo estilo que el botón
  "Medicamentos" del header de Pacientes; es una vista **global** de todos los
  medicamentos, no una pantalla colgada de cada uno) es de solo lectura en el
  sentido de que nunca se edita/borra una fila existente, pero cada fila tiene un
  link "Corregir este movimiento" que abre `CorregirMovimientoModal.jsx` y
  registra el movimiento nuevo compensatorio — nunca toca el original.

  **Cómo decide qué pedir la corrección**: si el movimiento original es
  `entrada`, la compensación es una `salida` (y viceversa), siempre sobre el
  MISMO `lote_id` — no tiene sentido "corregir" creando un lote nuevo, así que
  este modal inserta directo en `movimientos_stock` en vez de reusar
  `EntradaStockModal`/`SalidaStockModal` (que siempre crean un lote nuevo o
  sugieren por FEFO entre todos los lotes, ninguna de las dos cosas sirve acá). Cantidad
  y motivo salen pre-completados (motivo con fecha y tipo del movimiento
  original), editables por si la corrección es parcial.

  **Limitación real de la base, no un bug**: como toda `salida` exige
  `paciente_id` (constraint `salida_requiere_paciente`, RF-24), corregir una
  `entrada` con exceso de carga (que necesita una `salida` compensatoria) exige
  elegir profesional y paciente igual que una salida real — aunque la
  corrección no sea una administración real a ese paciente. No hay forma de
  registrar una salida "sin paciente" con el esquema actual. El caso que sí
  queda limpio (sin este problema) es el que da el ejemplo de la normativa:
  corregir una salida con exceso, compensando con una entrada simple (sin
  paciente).

### Affordance de botones (RNF-01)

Ningún botón puede quedar sin fondo sólido ni borde — para usuarios grandes poco
familiarizados con la tecnología, un elemento sin color no se lee como "clickeable".
Reglas fijadas en `design-system.md` y aplicadas en `src/index.css`:
- `.btn-primary` — fondo `primary` (celeste pastel), texto **`text-on-primary`**
  (oscuro, **no blanco**: el celeste es demasiado claro para sostener blanco con
  contraste suficiente, da ~1.9:1 — con texto oscuro sube a ~6.5:1). Como mucho
  uno visible por pantalla. En Historia Clínica, "Editar", "+ Agregar antecedente"
  y "+ Cargar resultados" bajaron a `.btn-secondary` (antes usaban `bg-primary
  text-accent-marino`, el mismo fondo que pasó a tener el botón primario real —
  compartir fondo diluía cuál era LA acción principal de la pantalla). El único
  primario de esa pantalla es "+ Nueva consulta".
  **Ojo con `text-on-primary` vs `text-primary`/`text-text-primary`**: son cosas
  distintas. `text-on-primary` es un token nuevo en `src/index.css`
  (`--color-on-primary: #33363a`) que **no se redefine en modo oscuro a
  propósito** — queda fijo. Se necesitó porque `primary` (el fondo del botón) es
  un celeste pastel *claro en ambos temas* (`#9DC2DE` claro / `#A8D4EF` oscuro),
  pero `text-primary`/`text-text-primary` sí se invierte por tema (para
  contrastar contra el FONDO DE PÁGINA, que sí cambia de claro a oscuro) — en modo
  oscuro pasa a ser casi blanco (`#ECEDEE`), y blanco casi-blanco sobre celeste
  pastel da ~1.34:1, prácticamente invisible. Si `.btn-primary` hubiera seguido
  usando `text-text-primary` en vez de crear `text-on-primary`, el texto del
  botón principal desaparecía en modo oscuro (bug real, reportado y corregido).
  Regla general: cualquier texto que vaya **encima de un fondo de color fijo**
  (no del fondo de página) necesita un token de texto que tampoco cambie con el
  tema — no asumir que `text-text-primary`/`text-text-secondary` sirven ahí solo
  porque sirven sobre `background`/`surface`.
- `.btn-secondary` — incluye `border border-border` y fondo sólido `bg-border/70`
  en la clase base (antes no tenía ni borde ni fondo por defecto, así que varios
  "Cancelar"/"Volver" quedaban invisibles). Texto siempre `text-text-primary`
  (no `text-text-secondary`: sobre el fondo `bg-border/70` da ~4.23:1, por debajo
  del mínimo AA). Hover pasa a `bg-border` sin opacidad. No agregar `border`/`bg-`/
  color de texto de nuevo en el className de cada botón, ya está en la clase base.
- Botón de alerta/eliminar — `alert` reservado a borde/ícono/fondo suave (10%
  opacidad), nunca sólido con texto blanco encima (ver regla de contraste abajo).
  "Cerrar sesión" (excepción histórica documentada, pedido explícito del cliente
  para que se distinga del resto) pasó de fondo `alert` sólido + texto blanco
  (~2.76:1, no cumplía) a `bg-alert/10 border border-alert text-text-primary` —
  mismo patrón que el cartel de alergias.
- Los links de acción dentro de filas de tabla ("Editar", "Ver lotes", "+ Adjuntar")
  quedan **fuera** de la regla de fondo a propósito: usan texto subrayado
  (`underline`), no fondo — es el patrón de "link inline" ya establecido, distinto
  de un botón de toolbar, y ponerles fondo sólido a todos saturaría visualmente una
  tabla con varias acciones por fila. Los de "Eliminar"/"Dar de baja" pasaron de
  `text-alert` (no cumplía contraste) a `text-text-primary underline` (subrayado
  siempre visible, no solo en hover, para no perder del todo la señal de que es
  una acción distinta a "Editar").

### Contraste de color de texto (WCAG AA)

Regla no negociable, ver principio 5 de `design-system.md`: **los colores de
acento (`primary`, `alert`, `success`) se usan para fondo/borde/ícono, nunca como
color de texto sobre fondos claros — usar siempre `text-primary` para el texto**.
Los tres son pastel/medio-claros y como texto directo no llegan a 4.5:1 (`primary`
como texto blanco de fondo ~1.9:1, `alert` como texto ~2.6-2.8:1, `success` como
texto ~1.8-2.0:1 — se midió por luminancia relativa real, no a ojo). Esto ya causó
una regresión real: al agregarle fondo sólido a `.btn-secondary` en una iteración
anterior, el texto `text-text-secondary` que tenía encima bajó de ~5.1:1 a ~4.23:1
sin que nadie lo notara — corregido usando siempre `text-text-primary` ahí. Mismo
criterio para "Entrada" en el historial de movimientos (antes `text-success`, tira
a ~1.97:1) y para la badge de tipo de antecedente (`text-text-secondary` sobre
`bg-border/50` daba ~4.46:1, por debajo del piso por un margen mínimo) — ambos
casos con caso límite calculado, no asumido. `accent-marino` (navy oscuro) queda
afuera de esta regla: como texto sobre `primary` da ~4.6:1, cumple, y se sigue
usando en los botones de navegación del header ("Medicamentos" en Pacientes,
"Historial de movimientos" en Medicamentos) que no compiten con ningún botón
primario de la pantalla.

### Selectores explícitos de profesional (login compartido)

Se migró de "1 login por profesional" a un único usuario de Supabase Auth compartido entre
los 3 (una cuenta institucional del Círculo). Antes, `profesionales.id` == el `id` del
usuario de Auth logueado, así que varios lugares usaban `session.user.id` (de
`useAuth()`) directo como si fuera el `profesional_id`/`usuario_id` de la acción. Con la
cuenta compartida eso ya no vale nada — `session.user.id` es siempre el mismo, sin importar
quién de los 3 esté físicamente al lado de la pantalla. Se auditó todo el código buscando
esa asunción vieja y se corrigió:

- **`EntradaStockModal.jsx`** no tenía selector de profesional (el RF original decía que no
  hacía falta trazabilidad explícita ahí) — usaba `session.user.id` para `usuario_id`. Se
  le agregó el mismo selector "¿Quién...?" que ya tenían las salidas y las consultas.
- **`LaboratorioFormModal.jsx`** tampoco tenía selector — usaba `session.user.id` para
  `usuario_id` en las dos rutas de inserción (fila única y "separarEnFilas" del atajo de
  perfil lipídico). Mismo agregado.
- **`CorregirMovimientoModal.jsx`** solo pedía profesional cuando la compensación era una
  `salida` (porque ahí la base lo exige por `paciente_id` obligatorio); cuando compensaba
  con una `entrada` usaba `session.user.id` directo. Ahora pide el profesional siempre,
  para las dos direcciones.
- **`HistoriaClinica.jsx`**: `eliminado_por` (borrado lógico de consultas/antecedentes)
  usaba `session.user.id`. Como borrar no tiene ningún selector de profesional visible en
  pantalla al momento de la acción, se reemplazó el `window.confirm()` nativo por
  `ConfirmarConProfesionalModal.jsx` — un modal chico y reutilizable que pide elegir quién
  hace la acción antes de confirmar. Mismo componente sirve para cualquier acción futura
  que necesite "confirmar + atribuir a alguien" sin ser un formulario completo.
- **`NuevaConsultaModal.jsx`** y **`SalidaStockModal.jsx`** ya tenían selector explícito
  (nunca dependieron de la sesión) — no tenían el bug, pero tampoco filtraban por `activo`.

De paso, como `profesionales` ahora tiene la columna `activo`, **todos** los selectores de
"¿Quién...?" filtran `eq('activo', true)` — si no, dar de baja a alguien no tendría ningún
efecto visible. Excepción cuidada: `NuevaConsultaModal.jsx` en modo edición, si la consulta
que se edita fue atendida por alguien ya dado de baja, ese profesional se agrega igual a la
lista (con la etiqueta "(dado de baja)") — si no, editar una consulta vieja podría terminar
reasignándole la atención a otra persona sin querer, falseando quién atendió realmente.

No hay ninguna dependencia del trigger `handle_new_user` en el frontend — no existe pantalla
de registro ni lógica que espere que aparezca un profesional nuevo después de un login, así
que no había nada que corregir ahí (se confirmó revisando, no se asumió).

## Estado actual del desarrollo

**Historia clínica — hecho:**
- Login con Supabase Auth, sesión persistente, timeout por inactividad (25 min)
- Pacientes: listado con búsqueda/orden, alta y edición, DNI normalizado (solo dígitos)
  para evitar duplicados. **Bug real corregido**: el campo de DNI en
  `PacienteFormModal.jsx` no filtraba nada al tipear — `limpiarDni()` (saca todo lo
  que no sea dígito) recién corría en `handleSubmit`, sobre el payload, así que se
  podía escribir cualquier string y el campo se veía "con contenido" hasta el
  momento de guardar. Si alguien tipeaba puras letras, el DNI se guardaba como
  string vacío sin ningún aviso — y dos pacientes así podían chocar entre sí (no
  hay forma de distinguir "vacío" de "vacío"). Ahora el input llama a
  `limpiarDni()` en cada tecla (`handleChangeDni`, no el `handleChange` genérico
  del resto del formulario) — las letras ni siquiera llegan a aparecer en el
  campo — más una validación explícita en `handleSubmit` que corta si después de
  limpiar no queda ningún dígito.
- Historia clínica: datos del paciente, antecedentes (alta/edición/borrado lógico),
  **patologías** (alta/edición/borrado lógico, `/lib/patologias.js`, sección aparte de
  Antecedentes — diagnósticos ACTIVOS del paciente hoy, no historia pasada, ver detalle
  en el modelo de datos más arriba), **medicación habitual** (alta/edición/borrado
  lógico, `/lib/medicacion.js`, sección aparte — la medicación vigente del paciente,
  no confundir con el campo `medicacion` de cada consulta puntual; activa+patologías
  activas aparecen juntas en un panel resumen arriba de todo en la ficha, ver detalle
  en el modelo de datos más arriba), consultas (alta/edición/borrado lógico, selector
  de "quién atiende", signos vitales, documentos adjuntos en bucket privado con URL
  firmada, atajo "+ Agregar a medicación habitual" cuando el campo `medicacion` tiene
  contenido), resultados de laboratorio (por tipo de examen, con unidades, y ahora
  también edición/borrado lógico). Las cinco (consultas, antecedentes, patologías,
  medicación, resultados) auditan cada edición y baja en la tabla `auditoria` con el
  estado anterior completo — ver "CRUD de las tablas clínicas" más abajo. `pacientes`
  queda afuera de este patrón a propósito.
- Cartel de alergias visible al abrir la ficha del paciente (RF-17)
- Sistema de diseño con modo claro/oscuro (`design-system.md`)
- **"Últimas consultas" (`/consultas/recientes`, `UltimasConsultas.jsx`)**: feed
  global de las consultas más recientes de TODOS los pacientes juntas (no una por
  paciente), para poder ver de un vistazo lo que se va cargando sin entrar ficha
  por ficha — pedido explícito del cliente. Botón "Últimas consultas" en las
  acciones del header de `Pacientes.jsx`. Trae hasta `LIMITE = 50` filas
  (`supabase.from('consultas').select('*, pacientes(id, nombre, apellido, dni),
  profesionales!profesional_id(nombre)').is('eliminado_en', null).order('fecha',
  { ascending: false }).limit(LIMITE)`) — sin paginación ni filtros, no se pidió;
  si en algún momento hace falta ver más de las últimas 50 o buscar por
  paciente/fecha, ahí se agrega (mismo patrón de filtros que
  `HistorialMovimientos.jsx` si hace falta reusar algo).

  **Por qué ordena por `fecha` y no por `created_at`** (`consultas` tiene las dos
  columnas): en esta tabla son equivalentes en la práctica — `fecha` se fija una
  única vez al crear la consulta (`fecha: new Date().toISOString()` en
  `NuevaConsultaModal.jsx`) y la edición nunca la toca, así que ya representa el
  momento real de carga, no una fecha clínica editable/backdateable. Se usa
  `fecha` en vez de `created_at` por consistencia con el resto de la app (ficha
  del paciente, `ConsultaCard`), no porque haya una diferencia real entre las dos acá.

  **Es de solo lectura a propósito**: no tiene "Editar"/"Eliminar" — esas acciones
  siguen viviendo únicamente en `HistoriaClinica.jsx`, donde ya está resuelto el
  selector de "¿quién edita?" y la auditoría (ver "CRUD de las tablas clínicas"
  más abajo); duplicar esa lógica acá solo para una vista de repaso no aportaba
  nada. Cada tarjeta linkea a la ficha completa del paciente
  (`/pacientes/:id`) para editar o ver el resto de la historia clínica.
  `ConsultaFeedCard` es una copia adaptada de `ConsultaCard`
  (`HistoriaClinica.jsx`) — mismos campos (`CAMPOS_CONSULTA`, signos vitales),
  pero con el nombre del paciente como encabezado (en vez de la fecha sola) y sin
  documentos adjuntos ni botones de acción. Se duplicó en vez de extraer un
  componente compartido porque las dos versiones divergen en varios puntos a la
  vez (props, si tiene o no acciones, si muestra el paciente) — no valía la pena
  la abstracción para dos usos.

- **RF-19 implementado — Exportar historia clínica a PDF** (`src/lib/pdfExport.js`,
  `ExportarPdfModal.jsx`, botón "Exportar PDF" en las acciones del header de
  `HistoriaClinica.jsx`): generado 100% en el navegador con **pdfmake** (elegido
  sobre una captura de pantalla — se rompe con documentos de varias páginas — o
  jsPDF puro — mucho más manual para tablas/paginación). Al hacer clic se abre
  `ExportarPdfModal.jsx`, un selector simple con dos variantes: **Completo** o
  **Resumen**.

  **`pdfmake` 0.3.11 — cómo se importa, no es el patrón clásico de tutoriales
  viejos de la librería**: el build para navegador vive en
  `pdfmake/build/pdfmake.js` (el `main` del paquete, `js/index.js`, es para Node
  con `pdfkit` — no sirve acá) + las fuentes en `pdfmake/build/vfs_fonts.js`. Se
  importan los dos con `import()` dinámico DENTRO de `exportarHistoriaClinica()`
  (nunca en el top-level del módulo) porque entre los dos pesan ~1.8MB — code
  splitting real: Vite los separa en sus propios chunks
  (`pdfmake-*.js`/`vfs_fonts-*.js`) que solo se piden la primera vez que alguien
  exporta un PDF, no en la carga inicial de la app. Registro de fuentes
  explícito, sin depender del side-effect global que trae `vfs_fonts.js`:
  `pdfMake.addVirtualFileSystem(vfs)` a mano, en vez de dejar que
  `vfs_fonts.js` se autoregistre pisando `window.pdfMake` (funciona, pero
  depende del orden de imports de forma implícita). Fuente por defecto: Roboto
  (la que trae pdfmake), cubre español sin problema — el único ajuste hecho a
  propósito fue escribir "Saturación O2" en vez de "Saturación O₂" en los
  signos vitales del PDF (el subíndice Unicode ₂, U+2082, no está garantizado en
  el subset de la fuente). Verificado con un smoke test real fuera de Vite
  (`node` + `require('pdfmake/build/pdfmake.js')`) que confirmó un PDF válido
  (`%PDF-1.3`) de varias páginas con header/footer/tablas/listas/paginación
  antes de dar el feature por terminado — no alcanzaba con que `pnpm build`
  compilara sin errores, dado que la interacción entre el bundle UMD de pdfmake
  y el import dinámico de Vite era nueva en este proyecto.

  **De dónde sale el contenido**: `datos` es literalmente el mismo estado que ya
  tiene cargado `HistoriaClinica.jsx` (`paciente`, `antecedentes`, `patologias`,
  `medicacionHabitual`, `consultas`, `resultadosLab`, `documentos`) — no hay un
  fetch propio del modal de exportación. Como esos fetches YA filtran
  `is('eliminado_en', null)` (ver "CRUD de las tablas clínicas" más abajo), el
  PDF nunca puede incluir un registro dado de baja lógicamente sin ningún
  código extra en `pdfExport.js` — la exclusión sale gratis de reusar el estado
  de la página, no es una regla que haya que mantener aparte.

  **Diferencia de contenido entre las dos variantes** (para no confundir cuál
  pedir):
  - **Completo** (`construirPdfCompleto`): pensado como registro/archivo — TODO
    el historial. Datos de identificación completos (los 12 campos de
    `pacientes`, sin `id`), antecedentes agrupados por tipo (mismo orden que
    `TIPOS_ANTECEDENTE`), patologías (todas, con estado), medicación habitual
    (toda, activa y suspendida, con fechas), historial de consultas en **orden
    cronológico ascendente** (al revés que en pantalla, que muestra la más
    reciente primero — acá se invierte con `[...consultas].reverse()` porque
    para leer una evolución de punta a punta importa el orden real en que
    pasó), resultados de laboratorio agrupados por tipo de examen (mismo orden
    que `TIPOS_EXAMEN`), y una lista de documentos adjuntos por nombre + fecha
    de carga (`documentos.created_at`) **sin embeber los archivos** — son solo
    una referencia, el archivo real sigue accesible desde el sistema (bucket
    privado con URL firmada, como siempre).
  - **Resumen** (`construirPdfResumen`): pensado como pantallazo rápido antes de
    una consulta, no como archivo — datos básicos (nombre, DNI, fecha de
    nacimiento/edad, sexo, teléfono, grupo sanguíneo — **no** el resto de los
    campos de `pacientes`, esos quedan para el Completo), fecha de la última
    consulta registrada (`consultas[0]`, ya viene ordenado por fecha
    descendente), patologías ACTIVAS únicamente, medicación habitual ACTIVA
    únicamente, alergias, y los signos vitales de la consulta más reciente
    (`consultas[0]`) — si no hay consultas cargadas, cada sección lo dice
    explícitamente en vez de quedar en blanco.

  **Reglas comunes a las dos variantes**: encabezado repetido en cada página
  (nombre completo + DNI + número de página, vía la función `header` de
  pdfmake — se recalcula sola en cada página, no hay que paginar contenido a
  mano) y pie de página fijo ("Generado el [fecha y hora] — Sistema de
  Historia Clínica, Círculo de Retirados y Pensionados de la Policía de Entre
  Ríos", con la fecha calculada UNA sola vez al armar el documento, no en cada
  llamada a la función `footer`, para que diga lo mismo en todas las páginas).
  **Ninguna de las dos incluye nada de `auditoria` ni de quién cargó/editó cada
  registro** — ni siquiera "Cargado por" (que si se muestra en pantalla para
  Antecedentes) — el PDF es el estado clínico actual, no el registro interno
  de cambios.

  `src/lib/pdfExport.js` duplica `CAMPOS_CONSULTA` y `signosVitales()` en vez de
  importarlos de `HistoriaClinica.jsx` — mismo criterio ya documentado arriba
  para por qué `UltimasConsultas.jsx` tampoco los comparte: un módulo de
  `src/lib` no debería depender de una página, y ya hay precedente de que estas
  dos pequeñas listas no valen la abstracción compartida entre sus usos
  actuales. Si aparece un cuarto lugar que las necesite, ahí sí conviene
  extraerlas a `src/lib/consultas.js`.

  **Nota de tamaño del build**: el PWA precachea todos los archivos estáticos
  del build (ver sección de PWA más abajo) — al agregar `pdfmake`, el precache
  total subió de ~565KB a ~2.3MB (aunque siguen siendo dos chunks aparte que
  solo se DESCARGAN bajo demanda la primera vez que se exporta un PDF, el
  service worker los cachea de entrada en el install). Coherente con la
  política ya existente de "precachear todo lo estático del build" — no se
  cambió esa config para esto, sería una decisión aparte si en algún momento
  el tamaño total del precache se vuelve un problema real.

**Sacado por pedido del cliente**: RF-20 ("Próximos controles", `/proximos-controles`,
`ProximosControles.jsx`) — no lo necesitan. Se sacó la ruta, el link del header de
Pacientes y la página entera. El campo `proximo_control` en `consultas` ya no se pide en
`NuevaConsultaModal.jsx` desde un cambio anterior (junto con `pronostico`, sacado a la vez
que "Evolución" pasó a llamarse "Conclusión") — quedó la columna en la base sin uso, y el
bloque que la muestra en `ConsultaCard` (`HistoriaClinica.jsx`) sigue ahí por si alguna
consulta vieja todavía tiene el dato cargado, pero no se le agregó nada nuevo.

**Medicamentos y stock — hecho:**
- `/medicamentos`: listado con stock total por medicamento (vista `stock_por_medicamento`),
  **solo medicamentos activos** — alerta visual (`alert`) cuando el stock está bajo el
  mínimo. Buscador por marca comercial (`nombre`) o `droga`
  (`medicamentosFiltrados`, client-side sobre lo ya cargado — mismo patrón que el
  buscador de `Pacientes.jsx`) — solo filtra la tabla, las alertas de stock
  bajo/vencimiento de arriba siguen mirando todos los medicamentos activos sin importar
  la búsqueda.
- `/medicamentos/inactivos` (`MedicamentosInactivos.jsx`, link "Medicamentos dados de
  baja" en las acciones del header de `/medicamentos`): pantalla aparte con **solo**
  los medicamentos dados de baja (`eq('activo', false)` en su propio fetch, no
  reusa el estado de `Medicamentos.jsx`) — antes vivían mezclados en la tabla
  principal con una etiqueta "(dado de baja)", pero eso ensuciaba el listado del
  día a día (pedido explícito del cliente). Mismas columnas y acciones
  "Editar"/"Ver lotes" que la tabla principal, más "Reactivar"
  (`handleReactivar`, `update activo = true`) en vez de "Dar de baja" — reactivar
  saca la fila de la lista al instante (deja de cumplir el filtro).
- Edición de medicamento (`MedicamentoFormModal.jsx`, vía "Editar" en cada fila de
  cualquiera de las dos tablas): solo campos de catálogo (Marca Comercial, Droga,
  Presentación, Concentración, Stock mínimo), sin nada de stock/lote y sin ningún
  campo para `activo` — "Dar de baja"/"Reactivar" son botones dedicados en cada
  tabla (`handleDarDeBaja` en `Medicamentos.jsx`, `handleReactivar` en
  `MedicamentosInactivos.jsx`), hacen baja lógica (`activo`), nunca `DELETE` — ver
  reglas de CRUD arriba.
- "Ver lotes" por medicamento (`LotesMedicamentoModal.jsx`): edición/borrado de un lote
  solo si no tiene movimientos asociados (`LoteFormModal.jsx` para editar)

  **"+ Nuevo medicamento" (el único botón del toolbar para cargar algo, ver
  historia abajo) abre `EntradaStockModal.jsx`, no `MedicamentoFormModal.jsx`**:
  debajo del `<select>` de medicamento hay un botón propio "+ Agregar medicamento
  nuevo" (`agregandoNuevo` en el estado — **no** una opción más adentro del
  `<select>`, esa primera versión quedaba poco visible/fácil de pasar de largo) que
  esconde el select y despliega ADENTRO del mismo modal los mismos campos que la
  edición de catálogo (Marca Comercial, Droga, Presentación con "Otra"/detalle,
  Concentración, Stock mínimo), con un botón para volver ("‹ Elegir un medicamento
  existente") que restaura el select. Si se elige un medicamento existente en
  cambio, salta directo a lote/cantidad. En los dos casos el submit es uno solo:
  crea (o no) el medicamento, después el lote, después el movimiento de entrada — nunca
  hace falta abrir un segundo modal. Selector de "¿Quién registra la entrada?" (se
  agregó cuando se auditaron los usos de `session.user.id` tras pasar a login
  compartido — ver "Selectores explícitos de profesional" más abajo). El selector
  de medicamento existente excluye los inactivos.

  **Por qué era dos botones y dejó de serlo**: originalmente "+ Nuevo medicamento"
  (crear en el catálogo) y "+ Registrar entrada" (cargar stock de algo ya
  existente) eran dos botones y dos modales separados, con un popup de puente
  ("Medicamento cargado — Volver / Registrar entrada") para pasar de uno al otro.
  En la práctica generaba fricción real — el personal no siempre sabe de memoria
  si un medicamento ya está en el catálogo, y esa indecisión hacía que no
  completaran la segunda mitad de la carga. Se probó primero una versión
  intermedia (mantener los dos botones, pero agregarle a "Registrar entrada" la
  opción de crear el medicamento inline) y **igual generaba fricción tener dos
  botones** — se terminó sacando el botón de alta-de-catálogo-sola del toolbar
  directamente. `MedicamentoFormModal.jsx` sigue existiendo como componente, pero
  ya solo se abre en modo edición (vía "Editar" en la tabla) — no como alta desde
  cero. El popup de puente ("Medicamento cargado...") y el estado que lo sostenía
  (`medicamentoCreado`, `medicamentoIdParaEntrada` en `Medicamentos.jsx`) se
  borraron, no quedaron ahí sin usar.
- Registrar salida/administración (`SalidaStockModal.jsx`): selector de "quién
  administra" (mismo patrón que consultas), sugerencia automática de lote por FEFO
  (el que vence antes, entre los que tienen stock) con aviso si ese lote está por vencer
  o si no hay stock, paciente identificado por búsqueda de DNI (no un `<select>` con
  todos los pacientes — no escala), consulta opcional.

  **Paciente no registrado (pedido explícito del cliente)**: como toda salida exige
  `paciente_id` por el constraint `salida_requiere_paciente` de la base (ver reglas
  de CRUD de `movimientos_stock` más abajo), y hay gente que va únicamente a
  retirar medicación sin hacerse nunca una consulta (nunca pasó por el alta de
  `Pacientes.jsx`), la búsqueda por DNI que no encuentra a nadie
  (`pacienteNoEncontrado`) despliega dos campos, Nombre y Apellido. Al guardar, si
  se usó ese camino, primero se hace un `insert` en `pacientes` con los 3 campos
  mínimos obligatorios del alta normal (Nombre, Apellido, DNI — mismos campos que
  `PacienteFormModal.jsx`, pasados por `capitalizarPalabras()` igual que ahí) y
  recién con el `id` que devuelve ese insert se arma el `movimiento_stock` — nunca
  se guarda un nombre suelto sin paciente real detrás. Se decidió así (y no
  agregando columnas de texto libre + relajar el constraint) para no abrir un
  segundo esquema de "paciente" en paralelo: a partir de esa salida, esa persona
  queda como cualquier otro paciente en `Pacientes.jsx` (se le puede completar el
  resto de la ficha después si vuelve). Si cambia el DNI tipeado después de haber
  cargado nombre/apellido, los dos campos se limpian solos (mismo `useEffect` que
  dispara la búsqueda) — evita el riesgo de registrar a alguien con el DNI de otra
  persona por quedar nombre/apellido viejos en pantalla.
- Alertas de stock bajo mínimo (RF-25) y lotes a 30 días o menos de vencer (RF-26)
- Historial de movimientos **global**, todos los medicamentos juntos
  (`HistorialMovimientos.jsx`, `/medicamentos/historial`, botón al lado del
  título en el header de `/medicamentos`, mismo estilo que "Medicamentos" en el
  header de Pacientes — no colgado de cada medicamento): fecha y hora,
  medicamento, tipo — badge con borde + fondo suave (10% opacidad) en `success`
  para entrada y en `alert` para salida, texto siempre `text-text-primary` en
  negrita (nunca el color de acento como color de letra, mismo criterio que el
  resto de la app: ver "Contraste de color de texto" más abajo) —, lote, cantidad,
  saldo acumulado
  **por medicamento** (se calcula agrupando los movimientos por medicamento_id
  y recorriendo cada grupo en orden cronológico — mezclar el saldo de
  medicamentos distintos no tendría sentido — sobre todos los movimientos, no
  solo los que pasan el filtro activo), quién lo registró, paciente (con link a
  su ficha, solo en salidas) y consulta asociada (con link, solo si tiene
  `consulta_id`). Filtros por medicamento, tipo y rango de fechas. Cada fila
  tiene un "Corregir este movimiento" que pre-completa el movimiento
  compensatorio (`CorregirMovimientoModal.jsx`) — ver detalle en la regla de
  CRUD de `movimientos_stock` más arriba.

### Tests automatizados (Vitest)

`pnpm test` (o `pnpm test:watch`). Alcance **deliberadamente acotado**, no confundir con
"la app está testeada": solo cubre lógica pura de `src/lib/*.js` (sin DOM, sin mocks de
Supabase) — `dni.test.js`, `medicamentos.test.js`, `laboratorio.test.js`. No hay tests de
componentes ni end-to-end; los flujos completos (llenar un formulario, guardar contra
Supabase, ver el resultado en pantalla) se siguen probando a mano, como siempre.

La razón de por qué se empezó por acá: es donde vive la lógica con más historial real de
bugs sutiles — en particular, el atajo de "Perfil lipídico" (`GRUPOS_CARGA` en
`laboratorio.js`) que separa una carga en 4 filas con tipos reales de la base. Se
extrajeron `combinarCampos`/`combinarSimple` de `LaboratorioFormModal.jsx` a
`laboratorio.js` como funciones puras exportadas específicamente para poder testearlas — si
alguna vez se renombra un campo de `TIPOS_EXAMEN` sin actualizar el atajo, un test lo nota
acá en vez de fallar como un `CHECK constraint` en producción.

`vite.config.js` tiene un bloque `test` compartido con la config de Vite (mismo alias `@`).
`.github/workflows/ci.yml` corre `lint` + `test` + `build` en cada push/PR — es la única
automatización de este repo con `on: push` en vez de `schedule` (a diferencia del ping y el
backup, que corren solos por tiempo).

**Si se agrega más cobertura más adelante**: lo siguiente en la lista de prioridad no es
"más de lo mismo" en `src/lib`, sino un test de humo (`@testing-library/react` + mocks de
`supabase-js`) para el flujo de alta de paciente y el de nueva consulta — son los dos
flujos que se usan todos los días.

### Backup automático de la base (GitHub Actions)

`.github/workflows/backup-db.yml` — corre todos los domingos (`workflow_dispatch` también
disponible para probarlo a mano), hace `pg_dump` contra la base vía `SUPABASE_DB_URL`
(connection string del **Session pooler** — el modo transaction pooler no soporta bien
`pg_dump`) y sube el resultado (`backup-YYYY-MM-DD.sql`) a un repositorio **separado**,
`pereyrajuanig/hc-circulo-backups`, dentro de una carpeta `backups/` — a propósito NO a
este repo, para no mezclar código fuente con volcados de datos de salud reales en la misma
historia de git.

Necesita dos secrets en este repo (mismo lugar que los del ping: Settings → Secrets and
variables → Actions → "New repository secret", **el usuario los configura a mano**):
- `SUPABASE_DB_URL` — connection string de Postgres (Project Settings → Database →
  Connection string → Session pooler en el dashboard de Supabase). Es más sensible que la
  anon key: da acceso directo a la base, no pasa por RLS.
- `BACKUP_REPO_TOKEN` — un token (fine-grained personal access token) con permiso de
  escritura sobre `pereyrajuanig/hc-circulo-backups` únicamente, no sobre este repo.

Ninguno de los dos secrets queda expuesto en los logs ni en el archivo de backup: se pasan
por variable de entorno (`env:`) en vez de interpolarse directo en el comando, así que ni
siquiera aparecen en el texto del step tal como lo muestra el log de Actions (a diferencia
del ping, que interpola `secrets.SUPABASE_ANON_KEY` directo en el `curl` y depende del
enmascarado automático de GitHub). `pg_dump` tampoco imprime la connection string en su
salida — ni en el `.sql` generado ni en sus mensajes de error.

**Nota para el futuro**: el dump es de la base completa (todos los schemas, no solo
`public`), así que también incluye tablas internas de Supabase como `auth.users` (con
hashes de contraseña). Si en algún momento el repo de backups pasa a tener colaboradores
que no deberían ver eso, conviene pasar a `pg_dump --schema=public` para limitar el volcado
a los datos de la app.

**Gotchas reales que ya pasaron al armar este workflow, en orden**:
1. Secret vacío (`SUPABASE_DB_URL` o `BACKUP_REPO_TOKEN` mal cargado/con typo en el
   nombre) hace que `pg_dump ""` intente conectarse por socket Unix local en vez de tirar
   un error de credenciales — síntoma engañoso: "connection to server on socket ... failed",
   nada que ver con el secret a simple vista. Por eso el paso "Verificar que los secrets no
   lleguen vacíos" corre antes de intentar el dump.
2. `pg_dump: aborting because of server version mismatch` — el `postgresql-client` que
   trae Ubuntu por default va atrás del Postgres que corre Supabase (Ubuntu 16.x vs.
   Supabase 17.x), y `pg_dump` se niega a volcar un servidor más nuevo que él mismo. Se
   instala `postgresql-client-17` desde el repo oficial de PGDG.
3. Instalar la 17 con apt **no alcanza**: el runner ya trae una 16.x de fábrica, y ese
   symlink de `pg_dump` en el PATH le gana al de la 17 recién instalada (no queda claro
   por qué el `update-alternatives` de `postgresql-common` no lo pisa — probablemente la
   16 de la imagen no está registrada en ese sistema de alternatives). La solución
   definitiva es llamar al binario por ruta absoluta,
   `/usr/lib/postgresql/17/bin/pg_dump`, nunca `pg_dump` a secas. Si en el futuro Supabase
   pasa a Postgres 18, hay que subir el "17" en dos lugares: el nombre del paquete apt y
   esta ruta.

### PWA (vite-plugin-pwa)

Configurado en `vite.config.js`. El único objetivo es poder "instalar" la app en las
computadoras del consultorio (ícono propio, abre en su propia ventana sin barra de
direcciones del navegador) — **no agrega soporte offline**, sigue siendo una decisión de
diseño explícita que la app no funciona sin internet (ver "Decisiones clave de diseño" al
principio de este archivo).

- `registerType: 'autoUpdate'` — se actualiza sola en segundo plano, sin preguntarle nada
  al usuario (coherente con "priorizar simplicidad" para usuarios poco técnicos).
- El service worker que genera (`generateSW`, default del plugin) **solo precachea los
  archivos estáticos del propio build** (JS/CSS/HTML/íconos). A propósito no tiene
  `runtimeCaching` para el dominio de Supabase — cualquier llamada a la base o a Auth sigue
  yendo siempre a la red, nunca a una copia cacheada. Verificado corriendo `pnpm build` y
  greppeando `dist/sw.js` por "supabase": no aparece. Si en algún momento se agrega
  `runtimeCaching`, hay que mantener esa regla — cachear una respuesta de Supabase
  significaría poder mostrar datos clínicos desactualizados (ej. una alergia que ya no
  está, o una que se cargó y no aparece) sin que se note que es una copia vieja.
- Íconos en `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`,
  `apple-touch-icon.png`, `favicon-96x96.png`), generados desde
  `src/assets/Logo-Circulo_FondoTransparente.png` con `scripts/generar-iconos-pwa.cjs`
  (script de uso único, no corre en el build — necesita `sharp` como dependencia temporal:
  `pnpm add -D sharp`, correr el script, `pnpm remove sharp`). El ícono maskable tiene más
  margen que los demás porque el SO lo recorta a círculo/rounded-square.
- Se aprovechó para reemplazar el favicon genérico de la plantilla de Vite
  (`favicon.svg`/`icons.svg`, ya borrados) por el logo real, y corregir `lang="en"` →
  `lang="es-AR"` en `index.html` (quedaba del template, la app entera está en español).

### Ping anti-pausa de Supabase (GitHub Actions)

`.github/workflows/ping-supabase.yml` — corre cada 3 días (`workflow_dispatch` también
disponible para probarlo a mano) y hace un `GET` a `/rest/v1/pacientes?select=id&limit=1`.
Como pega sin sesión (solo con la anon key) y RLS exige autenticación, siempre devuelve
`200` con una lista vacía — no expone ningún dato real, pero para Supabase cuenta igual
como actividad, que es lo único que importa para no pausar el proyecto del plan gratuito
a los 7 días sin llamadas a la API. 3 días deja margen de sobra sin depender de que el cron
corra exactamente a tiempo.

**Dos gotchas reales que ya pasaron, por si se vuelve a tocar este archivo**:
1. Mandar solo el header `apikey` da `401` — el gateway de Supabase exige `apikey` Y
   `Authorization: Bearer <la misma anon key>` juntos, no alcanza con uno solo. El cliente
   `supabase-js` manda los dos automáticamente por eso nunca se nota en la app; en un `curl`
   a mano hay que agregarlo explícitamente.
2. Pegarle a la RAÍZ `/rest/v1/` (sin tabla) también da `401` con la anon key, aunque los
   headers estén bien — esa ruta expone el esquema completo (OpenAPI) y Supabase la bloquea
   para anon, exige `service_role`. Por eso el ping apunta a una tabla real
   (`pacientes?select=id&limit=1`) en vez de a la raíz — NUNCA cambiar esto por la
   `service_role key` para "simplificar", la anon key alcanza y es la que corresponde acá.

Necesita dos secrets en GitHub (Settings → Secrets and variables → Actions →
"New repository secret", **el usuario los configura a mano, yo no tengo forma de leer el
`.env` ni de setear secrets del repo**):
- `SUPABASE_URL` — mismo valor que `VITE_SUPABASE_URL` en `.env`
- `SUPABASE_ANON_KEY` — mismo valor que `VITE_SUPABASE_ANON_KEY` en `.env`

### CRUD de las tablas clínicas: editar + baja lógica + auditoría (RNF-09/RNF-10)

**Aplica a `consultas`, `antecedentes`, `resultados_laboratorio`, `patologias` y
`medicacion`. `pacientes` queda explícitamente AFUERA de todo este patrón** — no tiene
`eliminado_en`/`eliminado_por`, no tiene fila en `auditoria`, y no hay ni va a haber un
botón de eliminar en el listado de pacientes. Un paciente nunca se borra, bajo ningún
mecanismo, lógico o físico — es una decisión de diseño explícita, no un olvido, no
confundir con las otras cinco tablas.

**El estándar de baja lógica en tablas clínicas es `eliminado_en` (timestamptz, NULL =
activo) + `eliminado_por` (uuid → `profesionales.id`)** — no una columna `activo`. Esto
tuvo una vuelta atrás real: en una iteración se agregó por error una columna `activo` a
las tres tablas que existían en ese momento (confundiéndola con el patrón de
`medicamentos.activo`, que es un mecanismo distinto — ver más abajo), sin saber que
`consultas`/`antecedentes` ya tenían `eliminado_en`/`eliminado_por` de una migración
anterior. Se revirtió: `activo` se eliminó de las tres, y `resultados_laboratorio` sumó
`eliminado_en`/`eliminado_por` para igualar el patrón de las otras dos. `patologias` y
`medicacion` nacieron después ya siguiendo esta convención desde el principio. **Si se
agrega una tabla clínica nueva en el futuro que necesite baja lógica, usar
`eliminado_en`/`eliminado_por` — no `activo` —, para ser consistente con esta convención
ya establecida.**

**Auditoría (tabla genérica `auditoria`)**: antes de cada UPDATE de edición y antes de
cada baja lógica en estas cinco tablas, se inserta una fila en `auditoria` con el estado
COMPLETO del registro tal como estaba antes del cambio — `eliminado_en`/`eliminado_por`
dicen cuándo y quién borró, pero no qué decía el registro antes. Columnas reales de
`auditoria` (confirmadas por `information_schema.columns`, no asumidas): `id` (uuid, PK),
`tabla` (text), `registro_id` (uuid), `accion` (text: `'editar'` o `'eliminar'`),
`usuario_id` (uuid → `profesionales.id`), `valores_anteriores` (jsonb — el registro entero
tal como venía, incluyendo columnas embebidas del select si las tenía), `fecha`
(timestamptz, default `now()`). RLS solo permite insert/select, nunca update/delete —
mismo criterio que `movimientos_stock`: un libro contable, no un dato editable. Helper
compartido: `registrarAuditoria()` en `src/lib/auditoria.js`.

**Orden de operaciones, a propósito — auditoría primero, cambio real después**: si el
insert en `auditoria` falla, se corta ahí (se muestra el error y no se hace el UPDATE) en
vez de dejar pasar un cambio sin auditar. Ver el patrón repetido en
`NuevaConsultaModal.jsx`, `AntecedenteFormModal.jsx`, `PatologiaFormModal.jsx`,
`MedicacionFormModal.jsx`, `EditarResultadoLaboratorioModal.jsx` y los cinco
`confirmarEliminar*` de `HistoriaClinica.jsx`.

**`usuario_id` de la auditoría es siempre el profesional elegido en el selector de la
pantalla ("¿quién atiende?"/"¿quién edita?"/"¿quién carga?"), nunca la sesión de Auth** —
mismo criterio que el resto de la app desde que el login pasó a ser una cuenta compartida
(ver "Selectores explícitos de profesional" más arriba). `NuevaConsultaModal.jsx` y las
bajas de las cinco tablas ya tenían un selector de profesional por otras razones
(trazabilidad médico-legal de "quién atendió", o el modal compartido
`ConfirmarConProfesionalModal.jsx`) y ese mismo valor se reutiliza como `usuario_id` de la
auditoría.

**Dos variantes distintas de "¿quién carga/edita?", no confundir una con otra**:
- **Inmutable tras la carga** (`antecedentes.usuario_id`, `medicacion.usuario_id`,
  `resultados_laboratorio.usuario_id`): el selector aparece siempre (alta y edición), pero
  solo el de ALTA se guarda en la columna del registro — el de edición alimenta
  ÚNICAMENTE la fila de `auditoria` de ese cambio puntual, la columna original nunca se
  reescribe. `AntecedenteFormModal.jsx`/`MedicacionFormModal.jsx` muestran el mismo
  selector con label dinámico ("¿Quién carga?" al dar de alta, "¿Quién edita?" al editar)
  para dejar claro el rol distinto; `LaboratorioFormModal.jsx` (alta) y
  `EditarResultadoLaboratorioModal.jsx` (edición) son directamente dos componentes
  separados que logran lo mismo.
- **Se reescribe en cada edición** (`consultas.profesional_id`, `patologias.usuario_id`):
  ahí "quién atendió/cargó" es en sí mismo dato clínico editable (corregir quién atendió
  realmente), no solo metadato de auditoría — el mismo valor sirve para las dos cosas: se
  guarda como columna del registro (pisando el anterior) Y se reutiliza como `usuario_id`
  de la fila de auditoría cuando la operación es una edición. `NuevaConsultaModal.jsx` y
  `PatologiaFormModal.jsx` siguen este patrón.

  Cuál usar para una tabla nueva: si la columna representa **contenido clínico** que
  puede necesitar corrección (como "quién atendió"), reescribir. Si es **metadato de
  quién cargó el dato originalmente** (más parecido a una firma de alta), inmutable.

**Edición de `resultados_laboratorio`, una simplificación deliberada**: a diferencia de
`LaboratorioFormModal.jsx` (que arma el resultado combinando varios campos — ver
`combinarCampos`/`combinarSimple` en `src/lib/laboratorio.js` — según el tipo de examen),
`EditarResultadoLaboratorioModal.jsx` edita directo el texto YA combinado que quedó
guardado (`tipo_examen` de solo lectura, `fecha` y `resultado` editables). No reconstruye
el formulario multi-campo original a partir del texto guardado — eso requeriría un
parser inverso de `combinarCampos` (separar por " · ", volver a partir cada
"Campo: valor unidad"), fràgil y con más superficie de bugs que el valor que aporta. Una
vez guardada, una fila es `(tipo_examen, resultado, fecha)` sin importar si salió de un
campo simple, de un examen con varios campos, o de una fila del atajo "Perfil lipídico" —
las tres se editan igual, con este mismo modal.

**Todo lugar que consulte `consultas`, `antecedentes`, `resultados_laboratorio`,
`patologias` o `medicacion` para listar/mostrar tiene que filtrar
`is('eliminado_en', null)`** — no alcanza con arreglarlo solo en `HistoriaClinica.jsx`.
Lugar que ya lo filtra, además de ahí: el selector de "consulta relacionada" en
`SalidaStockModal.jsx` (consultas). Si se agrega un nuevo lugar que lea estas tablas, hay
que acordarse de este filtro.

**Gotcha real que ya pasó**: agregar `eliminado_por uuid references profesionales(id)` a
`consultas` le dio a esa tabla una SEGUNDA foreign key hacia `profesionales` (la primera es
`profesional_id`, "quién atendió"). PostgREST no puede adivinar sola cuál usar para un
embed simple como `.select('*, profesionales(nombre)')` y tira "Could not embed because
more than one relationship was found" — hay que desambiguar con
`profesionales!profesional_id(nombre)` (nombre de la columna FK en `consultas`, no el de
la tabla). Se corrigió en `HistoriaClinica.jsx` y `NuevaConsultaModal.jsx`. Si se agrega un
`eliminado_por`/otra FK a `profesionales` en alguna otra tabla que ya embebe
`profesionales` en algún select, va a hacer falta el mismo `!nombre_columna`.

`documentos` de una consulta borrada **no se tocan** — ni se borran de Storage ni de la
tabla. Antes (con `DELETE` físico) sí se borraban los archivos al eliminar la consulta;
eso violaba la misma regla de retención para los documentos adjuntos (un estudio escaneado
también es parte de la historia clínica). Ahora, al ocultarse la consulta padre, sus
documentos simplemente dejan de ser alcanzables desde la UI (no se listan, porque
`consultaIds` sale de las consultas ya filtradas) pero siguen existiendo intactos en la
base y en el bucket — igual criterio que "ocultar, no destruir".

No hay UI de "papelera"/recuperar un registro borrado, ni una pantalla para visualizar
`auditoria` todavía — no se pidió, y no es necesario para cumplir la normativa (que exige
conservar el dato, no necesariamente poder restaurarlo o consultarlo desde la
aplicación). Si hace falta recuperar algo o revisar el historial de cambios de un
registro puntual, por ahora es una consulta manual en Supabase. Si en algún momento hace
falta una pantalla para esto, `auditoria` ya tiene todo lo necesario (`tabla` +
`registro_id` da el filtro, `valores_anteriores` da el diff contra el estado actual).

**`medicamentos.activo` es un mecanismo distinto, no tocar por analogía con lo de
arriba**: es de catálogo (dar de baja un medicamento para que no se pueda elegir en
nuevas entradas), no de retención legal de datos clínicos — no lleva auditoría, no usa
`eliminado_en`/`eliminado_por`, y está bien que sea así. La confusión entre estos dos
patrones fue justamente el error que generó la vuelta atrás documentada arriba.

### Responsive (celular/tablet)

La app es responsive de punta a punta — probado, no solo asumido (ver "Cómo se probó"
más abajo). El uso principal sigue siendo las 2 computadoras de escritorio del
consultorio; el celular/tablet importa por dos razones que NO son el consultorio: se
puede llegar a consultar la ficha de un paciente fuera de ahí, y es parte del portfolio
del desarrollador (no puede verse rota en una demo).

**Bug real que motivó esta auditoría**: el header de cada pantalla (logo + título +
link destacado + `ThemeToggle` + 1-2 botones más) usaba `flex justify-between
items-center` sin `flex-wrap` — a los anchos de celular (~375-390px) el contenido no
entraba y los botones quedaban superpuestos entre sí, ilegible. No era un caso límite:
pasaba en TODAS las pantallas con más de un botón en el header, siempre.

**Dónde se traza la línea entre "colapsado" y "en una fila" — `lg` (1024px), no `sm`
ni `md`**: se armó `src/components/Header.jsx`, un componente único que usan las 6
pantallas (antes cada una tenía su propio `<header>` duplicado). Por debajo de `lg`
(o sea, en CUALQUIER celular y CUALQUIER tablet, tanto vertical como horizontal) el
link destacado + `ThemeToggle` + los botones de la derecha se colapsan en un menú
hamburguesa; a partir de `lg` se muestran todos en una fila, como antes. La razón de
elegir `lg` y no `sm`/`md`: el header más cargado (Pacientes: link "Medicamentos" +
toggle + "Próximos controles" + "Cerrar sesión") mide bastante más de 768px de ancho
sumando todo — colapsarlo recién en `md` hubiera dejado tablets en portrait con el
mismo bug que motivó esto. Se verificó con capturas reales (Playwright, instalado
temporalmente solo para esto y desinstalado después) que a 1024px ese header, el más
cargado de los cinco, entra completo en una fila con margen de sobra. `lg` es
conservador a propósito: prioriza "nunca más superposición" por sobre "mostrar la fila
completa lo antes posible".

Los botones del menú desplegable son full-width y mantienen el mínimo táctil de 44px
(`min-h-11` en los que no usan ya `.btn-primary`/`.btn-secondary`, que lo traen incluido)
— no se redujo el tamaño de nada para "hacer entrar" más contenido en mobile.

**Tablas**: no todas usan el mismo patrón, a propósito, según el caso:
- Pacientes (`Pacientes.jsx`) — lista de tarjetas por debajo de `sm`, tabla completa
  ordenable desde `sm` (patrón que ya existía, sin cambios).
- Medicamentos y el historial de movimientos de stock — tabla real con
  `overflow-x-auto` alrededor: el scroll horizontal queda contenido adentro de esa
  tabla, nunca se lleva puesta la página entera. El historial tiene 11 columnas —
  convertirlo en tarjetas apiladas sería una tarjeta gigante por movimiento, peor que
  scrollear la tabla.
- Historial de laboratorio (dentro de la ficha del paciente) no es una tabla, es una
  lista — ya envuelve texto largo de forma natural, no necesitó cambios.

**Formularios y modales**: ya usaban en su mayoría `grid-cols-1 sm:grid-cols-2` (o
similar) y filas de botones con `flex-wrap` — la mayoría no tenía el bug. Se
encontraron y corrigieron dos casos puntuales sin ese fallback:
`EntradaStockModal.jsx` (la fila "Fecha de vencimiento"/"Cantidad" era `grid-cols-2`
fijo, sin bajar a una columna en mobile) y `LotesMedicamentoModal.jsx` (la fila de
cada lote no tenía `flex-wrap`, así que "Ya tiene salidas registradas" — el texto más
largo posible ahí — podía forzar overflow en vez de bajar de línea).

**Cómo se probó** (no alcanza con "debería andar" después del bug real de arriba): se
armó una ruta temporal (`/_debug`, en `App.jsx`) que renderizaba los 5 headers reales
sin necesitar login, se instaló Playwright de forma temporal (`pnpm add -D playwright`
+ `pnpm dlx playwright install chromium`) y se sacaron capturas reales a 375/390/768/
1024/1280px, incluyendo el menú desplegable abierto. Confirmado visualmente que no hay
superposición en ningún ancho y que el corte a `lg` es seguro. Todo lo temporal (ruta,
página de debug, scripts de captura, la dependencia de Playwright) se sacó después de
verificar — no queda nada de esto en el repo.

## Comandos habituales

- `pnpm install` — instalar dependencias (NUNCA usar npm en este proyecto)
- `pnpm dev` — levantar el servidor de desarrollo
- `pnpm build` — build de producción, usar para verificar que compila antes de dar
  algo por terminado

## Entorno y detalles a tener en cuenta

- El usuario está en Windows y formateó su PC hace poco — no asumir herramientas
  preinstaladas (Node, Git, pnpm, etc.), confirmar antes de dar por hecho
- Si PowerShell bloquea la ejecución de scripts npm/pnpm, la solución es
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, o usar
  Git Bash como alternativa
- Vite solo lee `.env` al arrancar — si se edita `.env`, hay que reiniciar
  `pnpm dev` (recargar la página sola no alcanza)
- `.env` está en `.gitignore` — nunca commitear credenciales

## Preferencias de trabajo

- Cuando el usuario dice "add md", sumar lo nuevo al documento ERS (`ers-historia-clinica.md`)
- Cuando el usuario pide un "commit", dar el mensaje de commit resumiendo lo hecho
- Priorizar simplicidad: el usuario formateó su PC recientemente y está reinstalando
  herramientas de desarrollo de a poco, no asumir nada preinstalado
