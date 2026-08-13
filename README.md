# Sistema de Gestión de Proyectos — Fitness Para Todos

Primer montado del sistema: backend (NestJS + TypeORM + PostgreSQL) y frontend
(React + Vite + TailwindCSS) con login, JWT, control de acceso por rol (RBAC)
y lectura del catálogo de Direcciones/Áreas/Roles. Cubre la Fase 0 del roadmap
del PID. Los módulos de Proyectos, Tareas, Gantt y Alertas se construyen en las
Fases 1 y 2 (ver PID, sección 7).

Todo lo de este repositorio ya se probó de punta a punta contra una base de
datos PostgreSQL real antes de entregarse: creación de tablas, siembra de
catálogo, login, cambio de contraseña obligatorio, y el guard de roles
bloqueando a un usuario sin permiso.

## Estructura

```
backend/    NestJS + TypeORM (API)
frontend/   React + Vite + TailwindCSS (SPA)
db/
  schema.sql   DDL de las tablas (aplícalo una vez por base de datos)
  seed.sql     Catálogo (Direcciones/Áreas/Roles) + usuarios ya cargados
docker-compose.yml   Entorno de desarrollo local (Postgres + Redis + app)
render.yaml          Blueprint para desplegar el backend en Render
netlify.toml         Configuración para desplegar el frontend en Netlify
```

## 1. Desarrollo local

Requisitos: Docker y Docker Compose.

```bash
# 1. Levanta Postgres y Redis
docker compose up -d db redis

# 2. Aplica el esquema y el catálogo (una sola vez)
psql postgresql://fpt_user:fpt_pass@localhost:5432/fpt_pm -f db/schema.sql
psql postgresql://fpt_user:fpt_pass@localhost:5432/fpt_pm -f db/seed.sql

# 3. Backend (en una terminal)
cd backend
cp .env.example .env   # los valores por defecto ya apuntan al Postgres de docker compose
npm install
npm run start:dev      # http://localhost:3000

# 4. Frontend (en otra terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev             # http://localhost:5173
```

Prueba de humo (con el backend corriendo):

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"up",...}
```

Inicia sesión en http://localhost:5173/login con uno de los usuarios de
`db/seed.sql` (las contraseñas temporales están en el archivo confidencial
que se entregó aparte — nunca en este repositorio).

## 2. Desplegar a producción (plan gratuito confirmado — PID sección 4.3)

Orden recomendado — cada paso depende del anterior:

1. **Supabase** (base de datos): crea el proyecto → Settings → Database →
   copia la cadena de conexión (modo "Session"). En el editor SQL de Supabase,
   corre `db/schema.sql` y luego `db/seed.sql`.
2. **Upstash** (Redis): crea una base gratuita → copia la cadena de conexión
   `rediss://...` (se usa a partir de la Fase 2, con las alertas — puedes
   crearla ahora y dejarla lista).
3. **Resend** (correo): crea la cuenta y copia el API key (también se conecta
   en la Fase 2).
4. **Render** (backend): New → Blueprint → conecta este repositorio de GitHub
   → Render detecta `render.yaml`. Completa las variables marcadas como
   secretas en el dashboard: `DATABASE_URL` (la de Supabase), `CORS_ORIGIN`
   (la URL que te dé Netlify en el paso siguiente — puedes dejarla vacía y
   volver a este paso después), `RESEND_API_KEY`.
5. **Netlify** (frontend): Add new site → Import an existing project →
   conecta el mismo repositorio → Netlify detecta `netlify.toml`. Agrega la
   variable de entorno `VITE_API_URL` con la URL que te dio Render en el
   paso 4 (algo como `https://fpt-pm-backend.onrender.com`).
6. Regresa a Render y actualiza `CORS_ORIGIN` con la URL final de Netlify.
   Cada push a la rama principal vuelve a desplegar ambos servicios
   automáticamente (deploy-from-git, tal como se confirmó en el PID).

## 3. Subir este código a tu repositorio de GitHub existente

Desde esta carpeta:

```bash
git init
git add .
git commit -m "Primer montado: backend NestJS + frontend React, auth y RBAC"
git remote add origin https://github.com/betancourtjair/fpt-pm-system.git
git branch -M main
git push -u origin main
```

El repositorio ya existe y está vacío (`betancourtjair/fpt-pm-system`), así que
estos comandos son suficientes — no hace falta crear nada desde la web.

## 4. Qué SÍ y qué NO incluye este primer montado

Incluye: login con JWT, cambio de contraseña obligatorio (`must_change_password`),
guard de roles (`@Roles(...)`) probado contra el catálogo real (4 roles, 7
Direcciones, 13 Áreas, 3 usuarios ya cargados), lectura del catálogo desde el
frontend, identidad visual Planet Fitness aplicada (Tailwind + tipografías).

No incluye todavía (Fase 1-2 del roadmap): módulo de Proyectos/Tareas, el
Gantt interactivo, WebSockets en tiempo real, ni el envío de alertas por
correo. La base de datos y las entidades ya están listas para esos módulos
(`proyectos`, `tareas`, `alertas_enviadas` ya existen en `db/schema.sql`).

## 5. Seguridad — antes de invitar usuarios reales

- Cambia `JWT_SECRET` por un valor propio y largo en producción (Render puede
  generarlo automáticamente si usas `render.yaml` tal cual).
- Nunca subas `.env` ni el archivo de credenciales temporales a Git — ambos
  están en `.gitignore`.
- Todas las cuentas cargadas por seed tienen `must_change_password = true`:
  confirma que cada persona cambie su contraseña en su primer login antes de
  empezar a usar el sistema.
