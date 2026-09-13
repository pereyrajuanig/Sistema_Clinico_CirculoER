# Especificación de Requisitos de Software (ERS)
## Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

---

## 1. Datos generales del proyecto

- [x] Cliente privado real (no es trabajo de facultad) — primer proyecto profesional del desarrollador
- [x] Objetivo: sistema de gestión de historia clínica para uso interno de médicos y enfermeras
- [x] Sin fecha límite fija, pero se busca arrancar a usarlo lo antes posible

## 2. Usuarios y alcance de uso

- [x] 3 usuarios en total: 2 médicos + 1 enfermera
- [x] Todos con el mismo rol y permisos (no hay diferenciación por tipo de profesional)
- [x] Uso desde 2 computadoras fijas, ya existentes en el lugar
- [x] Conexión a internet estable disponible → **no se necesita soporte offline**
- [x] Contexto de usuarios: personas grandes, algunos no cómodos con la tecnología → prioridad en simplicidad de uso

## 3. Alcance funcional

- [x] Cualquiera de los 3 profesionales puede atender a cualquier paciente
- [x] Todos ven la misma historia clínica completa (sin compartimentación entre profesionales)
- [x] No hay derivaciones formales entre profesionales (se anotan en observaciones si hace falta)
- [x] No se maneja turnos/agenda por ahora (queda afuera del alcance inicial, posible mejora futura)
- [x] Sistema cerrado: sin integración con obra social ni laboratorios
- [ ] *Posible mejora futura*: integración para recordatorios por WhatsApp

## 4. Modelo de datos (definido, cerrado y ya creado en Supabase)

**PACIENTE**
- [x] Nombre, apellido, DNI, fecha de nacimiento, sexo/género
- [x] Teléfono, dirección
- [x] Contacto de un familiar/referencia (exigido por Ley 26.529)
- [x] Obra social / n° de afiliado
- [x] Grupo sanguíneo, ocupación, estado civil

**ANTECEDENTE** (tabla flexible: tipo + descripción)
- [x] Tipos soportados: alergia, patológico, quirúrgico, familiar/hereditario, hábito, vacuna, medicación crónica

**CONSULTA** (núcleo del sistema)
- [x] Motivo, examen físico, diagnóstico, tratamiento, medicación, evolución, pronóstico, próximo control, observaciones
- [x] Signos vitales incluidos directo en la consulta (siempre van juntos, nunca sueltos): presión arterial, frecuencia cardíaca, temperatura, frecuencia respiratoria, saturación de oxígeno, peso, talla, glucemia
- [x] Vinculada al profesional que atendió (para trazabilidad/auditoría médico-legal)

**DOCUMENTO**
- [x] Adjuntos opcionales por consulta (estudios, análisis, fichas escaneadas)

**PROFESIONALES**
- [x] Uno por profesional (no un usuario único compartido), extiende auth.users de Supabase

## 5. Autenticación y seguridad

- [x] Sesión persistente por computadora (no re-loguearse en cada uso)
- [ ] Selector rápido de "quién atiende" al iniciar cada consulta (sin tipear usuario/contraseña) — pendiente de implementar
- [x] Cada profesional tiene su propia contraseña personal, simple y sin restricciones excesivas
- [ ] La sesión debe expirar después de un tiempo de inactividad — pendiente de implementar
- [x] RLS habilitado en las 5 tablas: cualquier usuario autenticado tiene acceso completo (ya que los 3 tienen el mismo rol)
- [x] No hay pantalla pública de registro — los usuarios se dan de alta manualmente desde el dashboard de Supabase

## 6. Migración de datos

- [x] Existen fichas en papel, pero son muchas y con letra difícil de leer
- [x] Decisión: no migrar estructuradamente. Cuando un paciente con ficha vieja vuelve, se escanea/fotografía y se adjunta como documento a su historia digital

## 7. Infraestructura y hosting

- [x] Backend: Supabase (Postgres + Auth + Storage + RLS), plan gratuito por ahora
- [x] Proyecto de Supabase creado (organización propia, separada de otros proyectos personales)
- [x] Frontend: React + Vite + Tailwind v4, gestor de paquetes **pnpm** (no npm)
- [x] Repositorio en GitHub: privado — `pereyrajuanig/Sistema_Clinico_CirculoER`
- [x] Entorno de desarrollo: Windows, configurado desde cero (PC recién formateada)
- [ ] **Pendiente**: automatizar ping periódico para evitar la pausa por inactividad del plan gratuito (GitHub Actions)
- [ ] **Pendiente**: automatizar backup periódico de la base de datos (GitHub Actions + pg_dump), ya que el plan gratuito no incluye backups
- [ ] **Pendiente**: agregar PWA (vite-plugin-pwa) para que se pueda "instalar" en las 2 computadoras — no bloquea el desarrollo

## 8. Temas administrativos pendientes (no bloquean el desarrollo, pero hay que resolverlos)

- [ ] Hablar con el presidente de la entidad sobre pagos/temas legales (el contacto actual, la enfermera, es solo para consultas clínicas)
- [ ] Definir a nombre de quién queda la cuenta de Supabase el día que se decida pagar el plan Pro ($25/mes, sin descuento anual oficial pero con opción de cargar saldo por adelantado)
- [ ] Definir quién se hace cargo del mantenimiento del sistema a largo plazo (no hablado todavía)

## 9. Estado actual de desarrollo

**Hecho:**
- [x] Estructura del proyecto (React + Vite + Tailwind + Supabase client) armada y en GitHub
- [x] Login funcional: autenticación contra Supabase Auth, sesión persistente, redirección automática al loguearse
- [x] Rutas protegidas (sin sesión, redirige a `/login`)
- [x] Pantalla de Pacientes: listado real conectado a la tabla `pacientes`, con buscador por nombre/apellido/DNI
- [x] Alta de paciente nuevo (modal con formulario, todos los campos del modelo)
- [x] `CLAUDE.md` creado para dar contexto persistente a Claude Code

**Pendiente (próximos pasos de desarrollo):**
- [ ] Vista de historia clínica de un paciente (consultas + antecedentes)
- [ ] Selector de "quién atiende" al iniciar una consulta
- [ ] Formulario de nueva consulta (con signos vitales)
- [ ] Carga de documentos adjuntos
- [ ] Timeout de sesión por inactividad

## 10. Preferencias de trabajo (con Claude)

- [x] "add md" → sumar lo nuevo a este documento
- [x] "commit" → dar el mensaje de commit resumiendo lo hecho

---
*Documento vivo: se actualiza a medida que se toman nuevas decisiones, surgen cambios de alcance, o avanza el desarrollo.*
