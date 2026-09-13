# Documento de Requerimientos
## Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

---

## 1. Alcance del sistema

El sistema tiene como objetivo digitalizar la gestión de historias clínicas de los pacientes
atendidos por los profesionales del Círculo, permitiendo el registro, consulta y actualización
de información clínica de forma centralizada, segura y accesible desde las computadoras del
consultorio.

## 2. Actores del sistema

| Actor | Descripción |
|---|---|
| Profesional | Médico o enfermero/a del Círculo. Rol único — todos los profesionales tienen los mismos permisos dentro del sistema. |

## 3. Requerimientos Funcionales

### Autenticación y sesión

| ID | Requerimiento |
|---|---|
| RF-01 | El sistema debe permitir a un profesional autenticarse mediante email y contraseña. |
| RF-02 | El sistema debe mantener la sesión iniciada en la computadora hasta que expire por inactividad o el profesional la cierre manualmente. |
| RF-03 | El sistema debe permitir cerrar sesión manualmente. |
| RF-04 | El sistema debe permitir identificar qué profesional atiende antes de registrar una consulta. |
| RF-05 | El sistema no debe ofrecer una pantalla pública de registro de usuarios; el alta de profesionales es administrativa. |

### Gestión de pacientes

| ID | Requerimiento |
|---|---|
| RF-06 | El sistema debe permitir registrar un nuevo paciente con sus datos personales (nombre, apellido, DNI, fecha de nacimiento, sexo, teléfono, dirección, contacto de un familiar, obra social, grupo sanguíneo, ocupación, estado civil). |
| RF-07 | El sistema debe impedir el registro de dos pacientes con el mismo DNI. |
| RF-08 | El sistema debe permitir buscar pacientes por nombre, apellido o DNI. |
| RF-09 | El sistema debe permitir visualizar el listado completo de pacientes registrados. |

### Historia clínica

| ID | Requerimiento |
|---|---|
| RF-10 | El sistema debe permitir visualizar el historial completo de consultas de un paciente. |
| RF-11 | El sistema debe permitir registrar antecedentes del paciente, clasificados por tipo (alergia, patológico, quirúrgico, familiar/hereditario, hábito, vacuna, medicación crónica). |
| RF-12 | El sistema debe permitir registrar una nueva consulta médica, incluyendo motivo, examen físico, diagnóstico, tratamiento, medicación, evolución, pronóstico, próximo control y observaciones. |
| RF-13 | El sistema debe permitir registrar los signos vitales del paciente dentro de cada consulta (presión arterial, frecuencia cardíaca, temperatura, frecuencia respiratoria, saturación de oxígeno, peso, talla, glucemia). |
| RF-14 | El sistema debe registrar automáticamente qué profesional realizó cada consulta, para trazabilidad médico-legal. |
| RF-15 | El sistema debe permitir adjuntar documentos (estudios, análisis, fichas escaneadas) a una consulta. |
| RF-16 | El sistema debe permitir registrar resultados de análisis de laboratorio por paciente, seleccionando el tipo de examen de una plantilla predefinida y cargando únicamente el resultado. |

### Alertas y visualización

| ID | Requerimiento |
|---|---|
| RF-17 | El sistema debe mostrar una alerta visible al abrir la ficha de un paciente si tiene alergias registradas. |
| RF-18 | El sistema debe mostrar un panel resumen al abrir la ficha de un paciente, con sus antecedentes crónicos y medicación habitual, sin necesidad de revisar todo el historial. |

### Reportes y seguimiento

| ID | Requerimiento |
|---|---|
| RF-19 | El sistema debe permitir exportar la historia clínica de un paciente a formato PDF. |
| RF-20 | El sistema debe permitir visualizar un listado de próximos controles pendientes, en base al campo de seguimiento cargado en cada consulta. |

### Medicamentos y stock

| ID | Requerimiento |
|---|---|
| RF-21 | El sistema debe permitir registrar un catálogo de medicamentos (nombre, presentación, concentración, unidad de medida). |
| RF-22 | El sistema debe permitir registrar lotes de un medicamento, cada uno con su propia fecha de vencimiento. |
| RF-23 | El sistema debe permitir registrar movimientos de stock (entradas por reposición, salidas por administración a un paciente), sin permitir editar el stock actual directamente. |
| RF-24 | El sistema debe registrar, en cada salida de stock, qué profesional la realizó, a qué paciente, en qué fecha y hora, y opcionalmente en el marco de qué consulta. |
| RF-25 | El sistema debe mostrar una alerta cuando el stock de un medicamento caiga por debajo de su stock mínimo definido. |
| RF-26 | El sistema debe mostrar una alerta cuando un lote de medicamento esté a 30 días o menos de su fecha de vencimiento. |

## 4. Requerimientos No Funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Usabilidad | La interfaz debe ser simple e intuitiva, apta para usuarios con bajo manejo de herramientas tecnológicas. |
| RNF-02 | Disponibilidad | El sistema debe ser accesible mientras haya conexión a internet; no se requiere funcionamiento offline. |
| RNF-03 | Seguridad | El acceso a los datos debe estar restringido exclusivamente a profesionales autenticados, mediante políticas de seguridad a nivel de base de datos (Row Level Security). |
| RNF-04 | Confidencialidad | Las credenciales de acceso a servicios (base de datos, repositorio) no deben quedar expuestas en el código fuente ni en el control de versiones. |
| RNF-05 | Portabilidad | El sistema debe ser accesible desde cualquier navegador web moderno, sin requerir instalación (arquitectura web). |
| RNF-06 | Escalabilidad | El modelo de datos debe soportar el crecimiento en cantidad de pacientes y consultas a lo largo de los años sin degradar el rendimiento. |
| RNF-07 | Mantenibilidad | El código debe organizarse en componentes y páginas independientes, facilitando la incorporación de nuevas funcionalidades. |
| RNF-08 | Cumplimiento legal | El sistema debe contemplar el contenido mínimo de la historia clínica exigido por la Ley 26.529 de Derechos del Paciente. |
| RNF-09 | Retención de datos | La información de las historias clínicas no debe eliminarse antes de los 10 años exigidos por la Ley 26.529. |
| RNF-10 | Integridad de datos | El borrado de registros clínicos debe ser lógico (ocultamiento), no físico, para evitar la pérdida accidental de información protegida por ley. |
| RNF-11 | Trazabilidad | El sistema debe registrar qué usuario modificó o eliminó un dato clínico y cuándo, con fines de auditoría. |

---
*Este documento se deriva de `ers-historia-clinica.md`, que contiene el detalle completo del
relevamiento y las decisiones de diseño. Se actualiza junto con él a medida que cambia el alcance.*
