-- =====================================================================
-- Migración 002 — Módulo de Proyectos y Tareas (Fase 1, PID sección 7)
-- Para bases de datos que ya tenían el esquema de la Fase 0 (por ejemplo,
-- el proyecto de Supabase ya desplegado). Idempotente: se puede correr
-- más de una vez sin romper nada. Db nuevas: db/schema.sql ya incluye esto.
-- =====================================================================

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS responsable_id INT REFERENCES usuarios(id);

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS responsable_id INT REFERENCES usuarios(id);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS dependencia_id INT REFERENCES tareas(id);

CREATE TABLE IF NOT EXISTS tarea_usuarios (
  tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
  usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (tarea_id, usuario_id)
);
