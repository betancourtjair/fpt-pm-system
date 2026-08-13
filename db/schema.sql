-- =====================================================================
-- Esquema (DDL) — Sistema de Gestión de Proyectos, Fitness Para Todos
-- Idéntico al definido y probado en el PID, sección 5.2, ya incluyendo
-- las columnas de autorización de presupuesto (PID sección 2.1 y 8).
-- Aplica esto UNA vez por base de datos (local o Supabase), antes de
-- correr db/seed.sql.
-- =====================================================================

CREATE TABLE IF NOT EXISTS direcciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  direccion_id INT REFERENCES direcciones(id) NOT NULL,
  nombre VARCHAR(120) NOT NULL
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  presupuesto NUMERIC(14,2) NOT NULL,
  estatus VARCHAR(30) DEFAULT 'no_iniciado',
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
  porcentaje_avance SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alertas_enviadas (
  id SERIAL PRIMARY KEY,
  tarea_id INT REFERENCES tareas(id) NOT NULL,
  usuario_id INT REFERENCES usuarios(id) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- asignacion | 48h | 24h
  fecha_programada TIMESTAMPTZ NOT NULL,
  fecha_enviada TIMESTAMPTZ,
  estatus_envio VARCHAR(20) DEFAULT 'pendiente',
  intentos SMALLINT DEFAULT 0,
  UNIQUE (tarea_id, usuario_id, tipo)
);
