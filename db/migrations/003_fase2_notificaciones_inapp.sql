-- =====================================================================
-- Migración 003 — Notificaciones dentro de la app (Fase 2, PID sección 7)
-- Para bases de datos que ya tenían el esquema de las Fases 0-2 (por
-- ejemplo, el proyecto de Supabase ya desplegado). Idempotente: se puede
-- correr más de una vez sin romper nada. Bases nuevas: db/schema.sql ya
-- incluye esto.
--
-- Reutilizamos alertas_enviadas como fuente de las notificaciones in-app
-- (asignación, 48h, 24h) en vez de crear una tabla nueva — cada fila ya
-- representa exactamente "a esta persona le tocaba avisarle de esto", que
-- es lo mismo que necesita la campanita de notificaciones del frontend.
-- La columna "leido" es la única pieza nueva: si el correo falló pero la
-- fila existe, igual aparece como notificación no leída dentro de la app
-- (así la persona se entera aunque Resend haya fallado ese día).
-- =====================================================================

ALTER TABLE alertas_enviadas ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT FALSE;
