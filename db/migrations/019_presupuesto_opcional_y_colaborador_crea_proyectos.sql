-- Mejoras reportadas por el usuario:
-- 1. El presupuesto de un proyecto ya no es obligatorio — no todos los
--    proyectos llevan uno definido desde el arranque.
-- 2. El rol "colaborador" ya puede crear proyectos (antes solo
--    admin/director/gerente_area) — acotado a su propia Área, igual que
--    gerente_area (ver ProyectosService.validarAreasEnAlcance).

ALTER TABLE proyectos ALTER COLUMN presupuesto DROP NOT NULL;

-- Se hace un merge (||) en vez de sobrescribir todo el jsonb, para no
-- pisar ningún otro campo de permisos que ya tuviera el rol.
UPDATE roles
SET permisos = permisos || '{"manage_projects": true}'::jsonb
WHERE nombre = 'colaborador';
