-- Reemplaza el color por Área (migración 005) por color a nivel Dirección:
-- más simple de administrar (7 direcciones vs. 13 áreas) y es lo que ahora
-- pide el PID para el Dashboard ("por dirección nada más"). La columna
-- areas.color queda sin usar (no se borra, por si acaso, pero el backend
-- ya no la lee); cada Área hereda el color de su Dirección en su lugar.
ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS color VARCHAR(7);
