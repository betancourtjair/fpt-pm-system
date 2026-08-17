-- Comentarios por tarea — mejora sugerida: colaboración dentro de la
-- herramienta (discutir una tarea sin salirse a correo/WhatsApp).
CREATE TABLE IF NOT EXISTS comentarios_tarea (
  id SERIAL PRIMARY KEY,
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_tarea_id ON comentarios_tarea(tarea_id);
