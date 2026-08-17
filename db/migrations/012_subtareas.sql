-- Subtareas / checklist dentro de una tarea (tercera ronda de mejoras, ver
-- README sección 4): desglosar una tarea grande en pasos chicos sin tener
-- que crear una tarea completa (con responsable/fechas propias) por cada
-- paso. "orden" es un entero simple (no hace falta drag-and-drop fino aquí,
-- solo subir/bajar) para que el checklist se muestre siempre igual.
CREATE TABLE IF NOT EXISTS subtareas_checklist (
  id SERIAL PRIMARY KEY,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  texto VARCHAR(300) NOT NULL,
  completada BOOLEAN NOT NULL DEFAULT false,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subtareas_checklist_tarea ON subtareas_checklist(tarea_id);
