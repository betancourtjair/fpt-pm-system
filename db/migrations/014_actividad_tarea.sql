-- Bitácora de actividad por tarea (tercera ronda de mejoras, ver README
-- sección 4): registro de cambios de estatus/responsable/prioridad, para
-- combinarlo con los comentarios en una sola pestaña "Actividad" y que se
-- pueda ver "quién hizo qué y cuándo" sin adivinar.
CREATE TABLE IF NOT EXISTS actividad_tarea (
  id SERIAL PRIMARY KEY,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  usuario_id INT REFERENCES usuarios(id),
  tipo VARCHAR(30) NOT NULL,
  detalle VARCHAR(300) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actividad_tarea_tarea ON actividad_tarea(tarea_id);
