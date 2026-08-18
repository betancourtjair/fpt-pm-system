-- Recordatorio "día programado" (mejora reportada por el usuario sobre la
-- cuarta ronda): a diferencia de las alertas 48h/24h/vencida (que dependen
-- de fecha_fin y de que la tarea siga sin completarse), este recordatorio
-- se dispara el día que la tarea está programada para iniciar
-- (fecha_inicio), sin importar si después se atrasa. Aplica a cualquier
-- tarea, no solo a las recurrentes (útil como "reminder" puntual).
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recordar_dia_programado BOOLEAN NOT NULL DEFAULT false;
