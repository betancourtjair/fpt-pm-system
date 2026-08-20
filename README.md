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
   volver a este paso después), `RESEND_API_KEY`, y `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` (adjuntar archivos a proyectos/tareas —
   mismo proyecto de Supabase del paso 1, ambos valores están en Settings →
   API; usa la key "service_role", nunca la "anon public". Si se dejan
   vacías, el resto del sistema sigue funcionando normal y solo la función
   de adjuntos responde error).
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

**Mejoras funcionales completadas después de la Fase 2** (ronda de 12 puntos
priorizados):

1. Alertas de tareas vencidas (además de los recordatorios de 48h/24h).
2. Validación de fechas y dependencias al crear/editar una tarea (fecha de
   inicio posterior a fin, dependencia circular directa o en cadena, tarea
   que inicia antes de que termine su predecesora).
3. Integración continua (GitHub Actions): cada push/PR a `main` compila
   backend y frontend — sin esto no se detecta un error de tipos hasta que
   Render/Netlify fallan el deploy.
4. Respaldo automático diario de la base de datos + guía de monitoreo con
   UptimeRobot (gratuito) — ver sección 6 de este README.
5. Búsqueda y filtros en "Proyectos" (nombre, Dirección, estatus) y en
   "Gestión de usuarios" (nombre/correo, rol, activo/inactivo).
6. Presupuesto real vs. plan: bitácora de gastos por proyecto
   (`gastos_proyecto`) con barra de progreso y aviso de presupuesto
   excedido, respetando la misma visibilidad que ya tenía `presupuesto`.
7. Exportar a Excel tanto la lista de Proyectos como las Tareas de un
   proyecto (mismo estilo visual que la plantilla de usuarios).
8. Edición por arrastrar y soltar en el Gantt (mover una tarea completa o
   alargar/acortar su duración desde el borde), con una ventana de
   confirmación que muestra fecha "antes" y "después" antes de guardar
   nada — cancelar no manda ningún cambio al servidor.
9. Adjuntar archivos a proyectos y tareas (Supabase Storage, bucket
   privado, siempre a través de un endpoint propio autenticado — ver
   variables `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` en la sección 2) y
   reasignación masiva de responsable (selecciona varias tareas en la
   tabla de un proyecto y reasígnalas de un solo golpe).
10. Auditoría y ajustes de vista móvil: menú lateral como cajón deslizable
    en pantallas angostas, encabezados que ya no se encimaban con los
    botones de acción, y tablas/el Gantt con desplazamiento horizontal
    dentro de su propia tarjeta en vez de cortarse. El arrastrar-y-soltar
    del Gantt sigue siendo solo de escritorio (depende de eventos de
    mouse) — en celular el Gantt es de solo lectura.

**Segunda ronda de mejoras** (acercar la herramienta a Monday.com sin
perder lo que ya la hace más simple que MS Project):

1. Prioridad por tarea (alta/media/baja) — chip de color junto al nombre en
   la tabla, el Kanban y el calendario; se edita desde el mismo formulario
   de la tarea.
2. Tablero Kanban (`tareas.prioridad`, `tareas.estatus`): en el detalle de
   un proyecto, botón "Tablero" junto a "Tabla" — arrastra una tarjeta a
   otra columna para cambiar su estatus (mismo endpoint que ya usaba
   "Avance", sin ventana de confirmación: es una acción de bajo riesgo,
   fácil de revertir arrastrando de vuelta).
3. Vista de calendario mensual (botón "Calendario", misma pantalla) —
   alternativa más amigable al Gantt para quien solo quiere ver qué se
   vence esta semana.
4. Comentarios por tarea (`comentarios_tarea`) — hilo simple bajo cada
   tarea (botón "Comentarios" junto a "Archivos"), para discutir sin
   salirse a correo/WhatsApp. Borrar exige ser quien lo escribió o poder
   administrar el proyecto.
5. "Mis tareas" (menú lateral) — todo lo asignado al usuario actual a
   través de TODOS sus proyectos en una sola pantalla, sin tener que
   entrar proyecto por proyecto; marca las que ya vencieron.
6. Plantillas de proyecto — botón "Duplicar como plantilla" en el detalle
   de un proyecto: clona el proyecto completo (áreas, presupuesto y todas
   sus tareas con dependencias y asignaciones) sobre una nueva fecha de
   inicio, conservando la duración relativa de cada tarea. Útil para
   proyectos que se repiten (abrir una sucursal, lanzar un reto). Estatus y
   avance de las tareas clonadas siempre arrancan en cero.
7. Automatizaciones simples: (a) si el % de avance de una tarea llega a
   100, su estatus pasa a "completada" solo (y viceversa, si se marca
   "completada" a mano el % sube a 100); (b) si una tarea pasa a
   "bloqueada", se avisa por correo + notificación in-app a los Directores
   de la Dirección dueña del proyecto (mismo mecanismo de alertas que ya
   existía) — un Director recibe este aviso una sola vez por tarea, aunque
   se bloquee/desbloquee varias veces después.

**Tercera ronda de mejoras** (acercar todavía más la herramienta a
Monday.com, sobre la base ya construida en las dos rondas anteriores):

1. Automatizaciones configurables por el usuario — en el detalle de un
   proyecto, panel "Automatizaciones" (solo visible para quien puede
   administrar el proyecto): crea reglas "si la tarea entra en tal
   condición (prioridad/estatus/vencida, se pueden combinar), avisa a tal
   persona (responsable / director del área / alguien en específico)".
   Las reglas se evalúan solas cada vez que una tarea cambia, y solo
   avisan la primera vez que la tarea ENTRA a cumplir la condición (no en
   cada guardado subsecuente mientras sigue cumpliéndola) — mismo criterio
   que ya usaba el aviso de "tarea bloqueada" de la segunda ronda.
2. Subtareas / checklist dentro de una tarea — botón "Subtareas" junto a
   "Archivos"/"Actividad": una lista de pendientes más finos que la tarea
   misma (ej. "Confirmar con proveedor", "Subir el diseño final"). Marcar
   un ítem como completado lo puede hacer cualquier asignado a la tarea o
   quien administre el proyecto; editar/borrar el texto de un ítem es
   solo de quien administra el proyecto.
3. Etiquetas libres en tareas — texto libre además de la prioridad (ej.
   "cliente-vip", "urgente-legal"), para que cada Dirección organice por
   lo que necesite sin tocar el esquema. Se agregan como chips al crear o
   editar una tarea, se muestran junto al nombre en la tabla, y hay un
   filtro de un clic por etiqueta arriba de la tabla (también disponible
   en "Mis tareas").
4. Vista de carga de trabajo por persona — nueva pestaña "Carga de
   trabajo" en el menú lateral (mismo alcance de roles que "Admin":
   admin/director/gerente de área): cuántas tareas activas y cuántas
   vencidas tiene cada persona dentro de tu alcance, para detectar de un
   vistazo quién está saturado y quién puede tomar más.
5. Bitácora de actividad por tarea — el panel que antes se llamaba
   "Comentarios" ahora se llama "Actividad" y combina los comentarios con
   los eventos del sistema de esa tarea (creación, cambios de estatus,
   responsable o prioridad) en un solo feed ordenado por fecha.
6. Búsqueda global — caja de búsqueda en el encabezado, disponible en
   toda la app: busca a la vez en proyectos, tareas y comentarios,
   siempre respetando lo que el usuario actual puede ver.
7. Menciones (@usuario) en comentarios — al escribir "@" en un comentario
   aparece un buscador de compañeros de ese proyecto; la persona
   mencionada recibe una notificación in-app (campanita). La campanita
   ahora combina dos fuentes de aviso (las alertas de siempre y estas
   notificaciones nuevas, que sí pueden repetirse varias veces sobre la
   misma tarea) en una sola lista ordenada por fecha.
8. Vistas/filtros guardados por usuario — en "Proyectos", guarda la
   combinación actual de búsqueda + filtros con un nombre y vuelve a
   aplicarla después con un menú desplegable ("Vistas guardadas"), sin
   tener que reconstruirla cada vez. Es información puramente personal:
   cada quien ve y administra solo sus propias vistas guardadas.

**Cuarta ronda de mejoras** (sobre la base de las tres rondas anteriores):

1. Dependencias múltiples entre tareas — una tarea ahora puede depender de
   varias otras a la vez (antes solo podía depender de una). En el
   formulario de tarea, el campo "Depende de" es un selector de chips: la
   tarea no puede iniciar hasta que TODAS las que elijas terminen. Se
   sigue rechazando crear un ciclo de dependencias (A depende de B que
   depende de A) y depender de una tarea de otro proyecto o con fechas
   inconsistentes, igual que antes. El Gantt dibuja una flecha por cada
   dependencia.
2. Tareas recurrentes — al crear una tarea, el campo "Tarea recurrente"
   permite marcarla como diaria/semanal/mensual (con un intervalo, ej.
   "cada 2 semanas"). Al guardarla, el sistema calendariza de una vez
   TODA la serie de ocurrencias futuras (la actual y las siguientes según
   el intervalo), hasta la fecha de finalización del proyecto que la
   contiene — ya no espera a que se complete la ocurrencia actual para
   generar la siguiente, así que el Gantt y "Mis tareas" muestran desde
   el día uno todas las fechas futuras de la serie. Cada ocurrencia copia
   responsable, asignados, prioridad, etiquetas y presupuesto de la
   tarea original; las dependencias no se copian (se revisan caso por
   caso). Por seguridad la serie se limita a 200 ocurrencias futuras como
   tope. Editar la recurrencia de una tarea ya creada NO regenera la
   serie (para evitar duplicados) — solo aplica al crearla. Se puede
   desactivar la recurrencia en cualquier momento desde el formulario.
3. Plantillas de checklist reutilizables — desde el panel de "Subtareas"
   de cualquier tarea, "Administrar plantillas" abre una biblioteca de
   checklists compartida en toda la organización (ej. "Abrir sucursal
   nueva" con sus pasos ya definidos); "Aplicar plantilla" agrega de un
   clic todos los ítems de una plantilla como subtareas de la tarea
   actual. Cualquiera puede aplicar una plantilla; solo quien la creó (o
   un admin) puede eliminarla.
4. Vista de portafolio — nueva pestaña "Portafolio" en el menú lateral,
   visible para cualquiera que pueda ver al menos un proyecto: todos los
   proyectos en una sola línea de tiempo compartida, agrupados por
   Dirección, para ver de un vistazo los traslapes entre proyectos (a
   diferencia del Gantt, que usa una escala independiente por proyecto).
5. Reportes ejecutivo con tendencias — nueva pestaña "Reportes" (mismo
   alcance de roles que "Carga de trabajo": admin/director/gerente de
   área): una tabla resumen por Dirección (% de cumplimiento, tareas
   vencidas, tiempo promedio de finalización) y dos gráficas de tendencia
   mes contra mes (tareas creadas vs. completadas, automatizaciones
   activadas), con selector de periodo (últimos 3/6/12 meses).
6. Recordarme el día programado — cualquier tarea (recurrente o no) tiene
   ahora, en su formulario, la casilla "Recordarme el día programado":
   si se activa, el día en que la tarea está programada para iniciar
   (fecha de inicio) llega un correo + notificación in-app avisando que
   "hoy toca" esa tarea, sin importar si después se atrasa — a
   diferencia de los recordatorios de 48h/24h/vencida, que giran sobre la
   fecha límite. Funciona como un reminder independiente del avance de
   la tarea. En la tabla de tareas aparece un badge "🔔 Recordatorio"
   junto al de "↻ Recurrente" cuando está activo.

**Quinta ronda de mejoras:**

1. Presupuesto de proyecto opcional — al crear un proyecto, el campo
   "Presupuesto (MXN)" ya no es obligatorio. Si se deja vacío, el proyecto
   queda sin presupuesto asignado: en la tabla de Proyectos se muestra "—"
   en vez de "$0", y en el detalle del proyecto la tarjeta de "Presupuesto
   vs. gasto real" muestra "Sin presupuesto asignado" (sin barra de avance
   ni aviso de excedido, ya que no hay plan contra el cual comparar).
2. Un colaborador ya puede crear proyectos — antes solo admin, director y
   gerente_area podían. Un colaborador queda acotado a su propia Área
   (igual que gerente_area): solo puede marcarla a ella como Área
   involucrada, y el selector de "Responsable" solo le muestra a otras
   personas de esa misma Área. Ve y administra (registrar gastos, ver el
   equipo) los proyectos que crea igual que cualquier otro rol que
   administra proyectos.
3. Un rol/permiso cambiado desde Admin ya se refleja solo — antes, si un
   admin le cambiaba el rol a alguien, esa persona tenía que cerrar sesión
   y volver a entrar para que la interfaz lo reflejara (el backend ya
   aplicaba el cambio de inmediato en cada petición; solo la pantalla se
   quedaba con el rol viejo, cacheado desde el login). Ahora cada pantalla
   revisa al cargar si tu rol/permisos cambiaron y, si es así, recarga la
   página una sola vez con los datos frescos — ya no hace falta pedirle a
   nadie que cierre sesión manualmente.

No incluye todavía: permisos granulares adicionales más allá de los roles
actuales, ni hardening de seguridad más allá de lo ya implementado (JWT,
RBAC, cambio de contraseña obligatorio, límite de peticiones por IP). El
roadmap completo con las 6 fases originales está en el PID, sección 7.

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
