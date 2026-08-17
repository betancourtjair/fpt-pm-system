# Sistema de Gestión de Proyectos — Fitness Para Todos

Backend (NestJS + TypeORM + PostgreSQL) y frontend (React + Vite +
TailwindCSS) con login, JWT, control de acceso por rol (RBAC), catálogo de
Direcciones/Áreas/Roles, Proyectos/Tareas con Gantt, alertas por correo
(Resend) y tiempo real por WebSocket. Cubre las Fases 0, 1 y 2 completas del
roadmap del PID (ver PID, sección 7).

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

## 4. Qué SÍ y qué NO incluye (estado actual: Fases 0-2 completas)

Incluye: login con JWT, cambio de contraseña obligatorio (`must_change_password`),
guard de roles (`@Roles(...)`) probado contra el catálogo real, lectura del
catálogo desde el frontend, identidad visual Planet Fitness (Tailwind +
tipografías), CRUD de Proyectos/Tareas con visibilidad por Área/Dirección,
Gantt de solo lectura con exportación a PDF (impresión nativa), alertas por
correo (asignación + recordatorios de 48h/24h vía Resend, con control de
duplicados en `alertas_enviadas`), tiempo real por WebSocket (Socket.IO) para
que el Gantt se actualice al instante entre usuarios que ven el mismo
proyecto —con el refresco cada 2 minutos como respaldo si el socket se cae—,
y notificaciones dentro de la app (campanita en el sidebar, reutiliza la
misma tabla de alertas).

Además: carga masiva de usuarios vía Excel en "Gestión de usuarios" (botón
para descargar la plantilla con listas desplegables de Rol/Dirección/Área y
botón para subirla ya llena — cada fila se valida por separado y al final se
muestra una tabla con la contraseña temporal de cada cuenta creada), una
pestaña de "Metodología" con la guía de cómo gestionar un proyecto de punta
a punta con esta herramienta (desde la junta de arranque hasta el cierre),
un enlace de Ayuda (`mailto:soporte@fpt.com.mx`) al pie del menú lateral, y
recuperación de contraseña desde el login (enlace de un solo uso enviado por
correo, válido 1 hora, con mensaje de respuesta siempre genérico para no
revelar qué correos existen en el sistema).

También: logo oficial de FPT en login, recuperación de contraseña, favicon y
encabezado de la app; en "Proyectos" cualquier parte de la fila navega al
detalle (no solo el nombre); y cierre de sesión automático cada 3 horas
(respaldado también del lado del servidor con `JWT_EXPIRES_IN`, ver sección 2).

Color por Dirección: cada Dirección tiene un color propio (por defecto uno de
una paleta fija asignada por id — ver `backend/src/catalogo/paleta-colores.ts`
— personalizable solo por un admin desde el menú "Admin", antes llamado
"Usuarios"); cada Área hereda el color de su Dirección. Ese color pinta el
acento de cada fila en "Proyectos" y sus chips de Área — las filas además
alternan fondo claro/oscuro (estilo Excel) para que dos proyectos consecutivos
siempre se distingan entre sí, aunque compartan Dirección. En "Inicio" hay un
resumen colapsable "Proyectos por Dirección": por default solo muestra el
conteo por Dirección, y al hacer click en una se despliega el detalle por
Área debajo.

**Importante sobre el remitente de correo (`EMAIL_REMITENTE`):** debe ser una
dirección `@fpt.com.mx` (el dominio raíz verificado en Resend). El subdominio
`send.fpt.com.mx` que aparece en el DNS **no** es un dominio de envío válido
— sus registros MX/TXT son solo el Return-Path/bounce interno que usa
Resend/SES. Usarlo como remitente hace que Resend rechace el correo con
"domain is not verified" (nos pasó en producción y quedó documentado en
`email.service.ts`).

No incluye todavía (Fase 3 en adelante del roadmap): edición drag-and-drop de
fechas/dependencias en el Gantt, filtros avanzados, dashboards de presupuesto
vs. avance, permisos granulares adicionales, ni hardening de seguridad más
allá de lo ya implementado (JWT, RBAC, cambio de contraseña obligatorio). El
roadmap completo con las 6 fases está en el PID, sección 7.

## 5. Seguridad — antes de invitar usuarios reales

- Cambia `JWT_SECRET` por un valor propio y largo en producción (Render puede
  generarlo automáticamente si usas `render.yaml` tal cual).
- Nunca subas `.env` ni el archivo de credenciales temporales a Git — ambos
  están en `.gitignore`.
- Todas las cuentas cargadas por seed tienen `must_change_password = true`:
  confirma que cada persona cambie su contraseña en su primer login antes de
  empezar a usar el sistema.

## 6. Respaldos y monitoreo

**Respaldo automático diario.** `.github/workflows/backup-db.yml` corre todos
los días a las 9am UTC (además de poder lanzarse a mano desde la pestaña
Actions → "Respaldo diario de la base de datos" → "Run workflow") y sube un
dump completo de la base de datos de Supabase como artifact de GitHub Actions,
con 90 días de retención (el máximo disponible). Para que funcione hace falta
un secreto de repositorio:

1. En Supabase: Project Settings → Database → Connection string → copia la de
   modo "Session" (puerto 5432), con el password real incluido.
2. En GitHub: Settings del repo → Secrets and variables → Actions → "New
   repository secret" → nombre `SUPABASE_DATABASE_URL`, valor la cadena del
   paso anterior.

Para restaurar un respaldo (por ejemplo tras un error en producción): descarga
el artifact desde la pestaña Actions del run que quieras, y localmente:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://usuario:password@host:puerto/nombre_bd" \
  respaldo-fpt-pm-YYYY-MM-DD.dump
```

Esto no es un respaldo *point-in-time* (solo captura el estado del momento en
que corrió), pero cubre el caso más común: recuperar el estado de un día
anterior si algo sale mal.

**Monitoreo de disponibilidad (uptime).** No forma parte del código — se
configura una sola vez en una herramienta externa gratuita como
[UptimeRobot](https://uptimerobot.com):

1. Crea una cuenta gratuita (plan Free: hasta 50 monitores, revisión cada 5
   minutos).
2. Agrega un monitor tipo "HTTP(s)" apuntando a `https://<tu-backend>.onrender.com/health`
   — este endpoint ya existe y no cuenta contra el límite de peticiones (ver
   `@SkipThrottle()` en `health.controller.ts`).
3. Agrega un segundo monitor para la URL del frontend en Netlify.
4. En "Alert Contacts" agrega tu correo (o un número de WhatsApp/Telegram si
   prefieres) para que te avisen apenas alguno de los dos deje de responder —
   esto es lo que hoy falta: sin esto, un caído de Render o Netlify solo se
   nota cuando alguien del equipo intenta entrar y no puede.
