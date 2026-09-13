# Especificación: Apartado de Análisis de Laboratorio

## Vista de historial (por paciente)

- Agrupado **por tipo de examen**, no en lista plana cronológica mezclada.
- Dentro de cada tipo, ordenar por fecha descendente (más reciente primero).
- Mostrar solo los tipos de examen que el paciente tiene efectivamente cargados — no listar
  los tipos vacíos.

Ejemplo de estructura visual:

```
Glucemia
  15/01/2026 — 98 mg/dL
  20/08/2025 — 105 mg/dL

Colesterol
  15/01/2026 — 190 mg/dL
```

## Restricción real de la base

La columna `tipo_examen` tiene un `CHECK constraint` que solo permite estos 22 valores
exactos (confirmado corriendo `pg_get_constraintdef` sobre
`resultados_laboratorio_tipo_examen_check`):

```
Hemograma, Hepatograma, Glucemia, Creatinina, Hemoglobina glicosilada, Uremia, Colesterol,
HDL, LDL, Triglicéridos, Calcemia, Ácido úrico, Vitamina D3, Orina completa, Urocultivo,
Sangre oculta, TSH, T4 libre, PSA libre, PSA total, Coagulograma, RIN
```

Esto es importante porque el formulario de carga (ver abajo) ofrece un examen — "Perfil
lipídico" — que **no es uno de estos 22 valores**. Es un atajo de carga a nivel de
formulario únicamente: internamente genera filas con los `tipo_examen` reales (Colesterol,
HDL, LDL, Triglicéridos), nunca inserta `tipo_examen = 'Perfil lipídico'`. Por eso en el
historial esos 4 resultados aparecen como 4 grupos separados (Colesterol, HDL, LDL,
Triglicéridos), no como un único grupo "Perfil lipídico" — el historial refleja los
`tipo_examen` reales de la base, el atajo de carga es solo una comodidad de pantalla.

`src/lib/laboratorio.js` separa esto en dos listas: `TIPOS_EXAMEN` (los 22 valores reales,
usados para el historial) y `GRUPOS_CARGA` (lo que aparece en el selector del formulario,
con "Perfil lipídico" en vez de los 4 sueltos).

## Formulario de carga

- **Un examen por vez**: primero se elige el tipo de examen de un selector y recién ahí
  aparecen los campos correspondientes a ese examen — no se muestra una planilla larga con
  todos los tipos juntos. Si hay más de un resultado de la misma visita, se guarda uno y se
  vuelve a abrir el formulario para el siguiente.
- Los exámenes multi-valor (Hemograma, Hepatograma, Orina completa, Urocultivo,
  Coagulograma) muestran **un input separado por cada sub-valor** (ej.
  Hepatograma: GOT, GPT, Fosfatasa alcalina, GGT, Bilirrubina total, directa e indirecta —
  cada uno su propio campo). Al guardar, esos sub-valores se combinan en un solo texto
  (`"GOT: 25 · GPT: 30 · ..."`) porque la tabla
  `resultados_laboratorio` solo tiene una columna `resultado` de tipo texto — no se migró el
  esquema para esto, la estructura vive únicamente en el formulario de carga.
- **Perfil lipídico** agrupa la carga de Colesterol, HDL, LDL y Triglicéridos en una sola
  pantalla porque clínicamente siempre se piden y se leen como conjunto — pero al guardar
  genera 4 filas independientes con sus `tipo_examen` reales (ver restricción arriba), no
  una fila combinada.
- **Orina completa** tiene su propia estructura, agrupada en dos secciones visuales dentro
  del formulario:
  - *Examen físico*: Color, Aspecto (texto libre)
  - *Examen químico*: Densidad, pH, Sedimento (texto libre); Proteínas, Glucosa y Hb con
    selector de cruces (No reactivo / + / ++ / +++ / ++++); Cuerpos cetónicos, Urobilinógeno
    y Nitritos con selector Contiene / No contiene
- Sangre oculta se carga con un selector (Positivo / Negativo) en vez de texto libre.
- El resto de los exámenes (valor único: Glucemia, TSH, etc.) muestra un solo campo de
  texto libre, con la unidad como guía visual (placeholder).
- **La unidad se guarda junto con el valor** (ej. el médico escribe "98" y el sistema guarda
  "98 mg/dL"), tanto para los exámenes de valor único como para los sub-valores que tienen
  unidad definida. RIN es la única excepción: su "(sin unidad, es un ratio)" es solo una
  aclaración visual, no se agrega al valor guardado. Todas las unidades están confirmadas
  con el bioquímico:

| Tipo de examen | Sub-valores / unidad |
|---|---|
| Hemograma | GB /mm3, GR /mm3, Hb g/dL, Hto %, Plaquetas /mm3 |
| Hepatograma | GOT UI/L, GPT UI/L, Fosfatasa alcalina UI/L, GGT UI/L, Bilirrubina total/directa/indirecta mg/dL |
| Glucemia | mg/dL |
| Creatinina | mg/dL |
| Hemoglobina glicosilada | % |
| Uremia | mg/dL |
| Perfil lipídico | Colesterol, HDL, LDL, Triglicéridos — mg/dL cada uno |
| Calcemia | mg/dL |
| Ácido úrico | mg/dL |
| Vitamina D3 | ng/mL |
| Orina completa | Ver detalle de secciones arriba (Densidad no lleva unidad) |
| Urocultivo | Gérmenes sin unidad, Recuento UFC/mL |
| Sangre oculta | Selector: Positivo / Negativo |
| TSH | µUI/mL |
| T4 libre | ng/dL |
| PSA libre | ng/mL |
| PSA total | ng/mL |
| Coagulograma | Tiempo de protrombina (TP) segundos, KPTT seg, Fibrinógeno mg/dL |
| RIN | (sin unidad, es un ratio) |

## Explícitamente fuera de alcance (por ahora)

- **No** se muestran "rangos normales" ni se marca automáticamente un resultado como
  fuera de rango. Los rangos de referencia varían por laboratorio, método, edad y sexo —
  es criterio médico, no algo para hardcodear en el software. Si en el futuro los médicos
  quieren esa función, tienen que aportar ellos los rangos a usar.
