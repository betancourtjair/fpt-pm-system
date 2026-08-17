-- Etiquetas libres en tareas (tercera ronda de mejoras, ver README sección
-- 4): texto libre además de prioridad (que ya es un catálogo cerrado
-- alta/media/baja) — cada Dirección puede organizar por lo que necesite
-- ("cliente X", "urgente-legal") sin tocar el esquema cada vez. Un arreglo
-- de texto es suficiente para este volumen; no se justifica una tabla
-- catálogo + relación aparte todavía.
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS etiquetas TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tareas_etiquetas ON tareas USING GIN (etiquetas);
