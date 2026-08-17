-- Dependencias múltiples entre tareas (cuarta ronda de mejoras, ver README
-- sección 4): antes una tarea solo podía esperar a UNA predecesora
-- (columna tareas.dependencia_id) — en proyectos reales (ej. abrir una
-- sucursal nueva) es común que una tarea no pueda arrancar hasta que
-- terminen dos o más cosas distintas a la vez. Esta tabla reemplaza esa
-- relación de "uno" a "varios". La columna vieja `tareas.dependencia_id` se
-- deja intacta en la base (no se borra, por si algo externo la lee), pero
-- el backend ya no la usa a partir de esta migración.
CREATE TABLE IF NOT EXISTS tarea_dependencias (
  tarea_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  depende_de_id INT NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  PRIMARY KEY (tarea_id, depende_de_id),
  CHECK (tarea_id <> depende_de_id)
);

-- Para el chequeo de ciclos (recorrer "quién depende de esta tarea") y para
-- el ON DELETE CASCADE en ambas direcciones.
CREATE INDEX IF NOT EXISTS idx_tarea_dependencias_depende_de ON tarea_dependencias(depende_de_id);

-- Migra las dependencias simples que ya existían a la tabla nueva, para no
-- perder información capturada antes de este cambio.
INSERT INTO tarea_dependencias (tarea_id, depende_de_id)
SELECT id, dependencia_id FROM tareas WHERE dependencia_id IS NOT NULL
ON CONFLICT DO NOTHING;
