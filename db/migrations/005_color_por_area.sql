-- Fase: color por área en Proyectos/Dashboard. Columna opcional — si es
-- NULL, el backend calcula un color por defecto determinístico a partir
-- del id (ver backend/src/catalogo/paleta-colores.ts), así que no hace
-- falta rellenarla para las áreas ya existentes.
ALTER TABLE areas ADD COLUMN IF NOT EXISTS color VARCHAR(7);
