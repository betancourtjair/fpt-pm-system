-- Adjuntar archivos a proyectos/tareas (prioridad 11 de la lista). El
-- archivo en sí vive en Supabase Storage (bucket "adjuntos", privado); esta
-- tabla solo guarda el metadato + la ruta dentro del bucket. Exactamente
-- una de proyecto_id/tarea_id debe estar llena — un adjunto es de un
-- proyecto O de una tarea, nunca de ambos ni de ninguno.
CREATE TABLE IF NOT EXISTS adjuntos (
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta_storage VARCHAR(500) NOT NULL,
  tipo_mime VARCHAR(150),
  tamano_bytes BIGINT NOT NULL,
  subido_por INT REFERENCES usuarios(id),
  subido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_adjunto_un_solo_dueno CHECK (
    (proyecto_id IS NOT NULL AND tarea_id IS NULL) OR
    (proyecto_id IS NULL AND tarea_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_adjuntos_proyecto_id ON adjuntos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_adjuntos_tarea_id ON adjuntos(tarea_id);
