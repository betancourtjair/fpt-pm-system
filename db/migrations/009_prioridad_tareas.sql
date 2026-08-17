-- Prioridad de tareas (mejora sugerida tras la ronda de 12 puntos: "otro
-- cambio para que se sienta más como Monday.com y menos como MS Project").
-- Alta/media/baja, con "media" como default para no dejar huecos en tareas
-- ya existentes.
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'media';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tareas_prioridad'
  ) THEN
    ALTER TABLE tareas ADD CONSTRAINT chk_tareas_prioridad
      CHECK (prioridad IN ('alta', 'media', 'baja'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tareas_prioridad ON tareas(prioridad);
