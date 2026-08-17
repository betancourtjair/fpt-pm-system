-- =====================================================================
-- Esquema (DDL) — Sistema de Gestión de Proyectos, Fitness Para Todos
-- Incluye las columnas de autorización de presupuesto (PID sección 2.1 y 8)
-- y las tablas/columnas del módulo de Proyectos y Tareas (Fase 1, PID
-- sección 7): responsables, usuarios asignados y dependencias entre tareas.
-- Aplica esto UNA vez por base de datos (local o Supabase), antes de
-- correr db/seed.sql.
-- =====================================================================

CREATE TABLE IF NOT EXISTS direcciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  color VARCHAR(7)
);

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  direccion_id INT REFERENCES direcciones(id) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  color VARCHAR(7)
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(60) UNIQUE NOT NULL,
  permisos JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol_id INT REFERENCES roles(id) NOT NULL,
  area_id INT REFERENCES areas(id),
  activo BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE,
  ver_presupuesto_autorizado BOOLEAN DEFAULT FALSE,
  presupuesto_autorizado_por INT REFERENCES usuarios(id),
  presupuesto_autorizado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Recuperar contraseña (Fase 2 completa) — ver db/migrations/004_recuperar_password.sql
  reset_password_token_hash VARCHAR(64),
  reset_password_expira TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  presupuesto NUMERIC(14,2) NOT NULL,
  estatus VARCHAR(30) DEFAULT 'no_iniciado',
  responsable_id INT REFERENCES usuarios(id),
  creado_por INT REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS proyecto_areas (
  proyecto_id INT REFERENCES proyectos(id),
  area_id INT REFERENCES areas(id),
  PRIMARY KEY (proyecto_id, area_id)
);

CREATE TABLE IF NOT EXISTS tareas (
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  presupuesto NUMERIC(14,2),
  estatus VARCHAR(30) DEFAULT 'no_iniciada',
  porcentaje_avance SMALLINT DEFAULT 0,
  responsable_id INT REFERENCES usuarios(id),
  dependencia_id INT REFERENCES tareas(id)
);

-- Usuarios asignados a una tarea (M:N) — "asignado" es el scope de permisos
-- del rol colaborador (PID sección 9.2): solo ve/actualiza lo que está aquí.
CREATE TABLE IF NOT EXISTS tarea_usuarios (
  tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
  usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (tarea_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS alertas_enviadas (
  id SERIAL PRIMARY KEY,
  tarea_id INT REFERENCES tareas(id) NOT NULL,
  usuario_id INT REFERENCES usuarios(id) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- asignacion | 48h | 24h | vencida
  fecha_programada TIMESTAMPTZ NOT NULL,
  fecha_enviada TIMESTAMPTZ,
  estatus_envio VARCHAR(20) DEFAULT 'pendiente',
  intentos SMALLINT DEFAULT 0,
  leido BOOLEAN DEFAULT FALSE, -- notificaciones in-app (Fase 2, PID sección 7)
  UNIQUE (tarea_id, usuario_id, tipo)
);
