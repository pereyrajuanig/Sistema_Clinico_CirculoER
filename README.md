# Sistema de Historia Clínica — Círculo de Retirados y Pensionados de la Policía de Entre Ríos

## Cómo arrancar

0. Si todavía no tenés pnpm instalado:
   ```
   npm install -g pnpm
   ```

1. Instalar dependencias:
   ```
   pnpm install
   ```

2. Copiar `.env.example` a `.env` y completar con los datos de tu proyecto de Supabase
   (Project Settings → API → Project URL y anon public key):
   ```
   cp .env.example .env
   ```

3. Levantar el servidor de desarrollo:
   ```
   pnpm dev
   ```

## Qué ya está armado

- Conexión a Supabase configurada (`src/lib/supabaseClient.js`) con sesión persistente
  (no hace falta re-loguearse en cada uso, como se definió en el relevamiento)
- Contexto de autenticación (`src/lib/AuthContext.jsx`)
- Pantalla de login (`src/pages/Login.jsx`)
- Ruta protegida: sin sesión, redirige a `/login` (`src/components/ProtectedRoute.jsx`)
- Pantalla de Pacientes como placeholder (`src/pages/Pacientes.jsx`)
- Tailwind v4 configurado y funcionando

## Cómo dar de alta a los 3 usuarios

Los usuarios no se registran solos (no hay pantalla de "crear cuenta" pública, y así debe ser
para un sistema de datos médicos). Se crean manualmente desde el dashboard de Supabase:

Authentication → Users → Add user → completar email y contraseña.

El trigger que ya está en la base de datos (`schema-historia-clinica.sql`) crea automáticamente
la fila correspondiente en la tabla `profesionales` apenas se crea el usuario.

## Próximos pasos de desarrollo

- [ ] Listado real de pacientes (tabla `pacientes`) con búsqueda
- [ ] Formulario de alta de paciente
- [ ] Vista de historia clínica de un paciente (consultas + antecedentes)
- [ ] Selector de "quién atiende" al iniciar una consulta
- [ ] Formulario de nueva consulta (con signos vitales)
- [ ] Carga de documentos adjuntos
- [ ] Timeout de sesión por inactividad
