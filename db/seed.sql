-- =====================================================================
-- Seed inicial: Direcciones, Áreas, Roles y usuario admin por defecto
-- Sistema de Gestión de Proyectos — Fitness Para Todos
-- Compatible con el esquema definido en el PID, sección 5.2 (Supabase/PostgreSQL)
-- Idempotente: se puede ejecutar más de una vez sin duplicar filas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Restricciones necesarias para que el seed sea idempotente
--    (si ya las creaste al correr el DDL original, este bloque no rompe nada;
--    "ADD CONSTRAINT IF NOT EXISTS" no existe en PostgreSQL, por eso se
--    verifica primero en pg_constraint antes de crearla).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direcciones_nombre_key') THEN
    ALTER TABLE direcciones ADD CONSTRAINT direcciones_nombre_key UNIQUE (nombre);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'areas_direccion_nombre_key') THEN
    ALTER TABLE areas ADD CONSTRAINT areas_direccion_nombre_key UNIQUE (direccion_id, nombre);
  END IF;
END $$;
-- roles.nombre ya es UNIQUE en el DDL original.

-- ---------------------------------------------------------------------
-- 0.b Columnas para la autorización de "ver presupuesto" de gerente_area
--     Regla de negocio confirmada: un gerente_area puede VER (no editar)
--     el presupuesto de su Área únicamente si su Director (o un admin) lo
--     autoriza explícitamente, activando ver_presupuesto_autorizado.
--     ADD COLUMN IF NOT EXISTS sí existe en PostgreSQL (a diferencia de
--     ADD CONSTRAINT), así que no requiere el patrón DO/pg_constraint.
-- ---------------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ver_presupuesto_autorizado BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS presupuesto_autorizado_por INT REFERENCES usuarios(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS presupuesto_autorizado_en TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 1. Roles (catálogo confirmado: admin, director, gerente_area, colaborador)
--    gerente_area incluye "view_budget_if_authorized": true — el permiso
--    real de ver presupuesto lo da la bandera por-usuario de arriba, no
--    este JSON; aquí solo se documenta que el rol es candidato a esa
--    autorización (colaborador nunca lo es).
--    Se usa ON CONFLICT ... DO UPDATE para que, si vuelves a correr este
--    seed, los permisos de roles ya existentes se actualicen también.
-- ---------------------------------------------------------------------
INSERT INTO roles (nombre, permisos) VALUES
  ('admin', '{
      "scope": "global",
      "manage_users": true,
      "manage_roles": true,
      "manage_catalog": true,
      "manage_projects": true,
      "manage_tasks": true,
      "manage_budget": true
   }'::jsonb),
  ('director', '{
      "scope": "direccion",
      "manage_users": false,
      "manage_roles": false,
      "manage_catalog": false,
      "manage_projects": true,
      "manage_tasks": true,
      "manage_budget": true
   }'::jsonb),
  ('gerente_area', '{
      "scope": "area",
      "manage_users": false,
      "manage_roles": false,
      "manage_catalog": false,
      "manage_projects": true,
      "manage_tasks": true,
      "manage_budget": false,
      "view_budget_if_authorized": true
   }'::jsonb),
  ('colaborador', '{
      "scope": "asignado",
      "manage_users": false,
      "manage_roles": false,
      "manage_catalog": false,
      "manage_projects": true,
      "manage_tasks": true,
      "manage_budget": false,
      "view_budget_if_authorized": false
   }'::jsonb)
ON CONFLICT (nombre) DO UPDATE SET permisos = EXCLUDED.permisos;

-- ---------------------------------------------------------------------
-- 2. Direcciones (7)
-- ---------------------------------------------------------------------
INSERT INTO direcciones (nombre) VALUES
  ('Dirección General'),
  ('Finanzas'),
  ('Operaciones'),
  ('Construcción'),
  ('Expansión'),
  ('Capital Humano'),
  ('Marketing')
ON CONFLICT (nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Áreas (13) — ligadas a su Dirección por nombre
--    Nota: Dirección General, Construcción, Expansión y Capital Humano
--    reciben un Área homónima (mismo nombre que la Dirección), para que
--    siempre haya un Área a la cual asignar usuarios dentro de ellas.
-- ---------------------------------------------------------------------
INSERT INTO areas (direccion_id, nombre)
SELECT d.id, a.nombre
FROM (VALUES
  -- Dirección General -> Área homónima
  ('Dirección General', 'Dirección General'),

  -- Finanzas -> 5 áreas
  ('Finanzas', 'TI'),
  ('Finanzas', 'Contraloría'),
  ('Finanzas', 'Compras'),
  ('Finanzas', 'Legal'),
  ('Finanzas', 'Tesorería'),

  -- Operaciones -> 2 áreas
  ('Operaciones', 'Mantenimiento'),
  ('Operaciones', 'Operación club'),

  -- Construcción -> Área homónima
  ('Construcción', 'Construcción'),

  -- Expansión -> Área homónima
  ('Expansión', 'Expansión'),

  -- Capital Humano -> Área homónima
  ('Capital Humano', 'Capital Humano'),

  -- Marketing -> 2 áreas
  ('Marketing', 'Relaciones Públicas'),
  ('Marketing', 'MKT de clubes')
) AS a(direccion_nombre, nombre)
JOIN direcciones d ON d.nombre = a.direccion_nombre
ON CONFLICT (direccion_id, nombre) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Usuario administrador por defecto (admin/admin)
--    - must_change_password = TRUE fuerza el cambio de contraseña en el
--      primer login (ver riesgo de seguridad en el PID, sección 8).
--    - El hash corresponde a la contraseña "admin" (bcrypt, 10 rounds).
--      Genera uno nuevo para producción con:
--      node -e "console.log(require('bcryptjs').hashSync('admin', 10))"
-- ---------------------------------------------------------------------
INSERT INTO usuarios (nombre, email, password_hash, rol_id, area_id, activo, must_change_password)
SELECT
  'Administrador',
  'admin@fitnessparatodos.local',
  '$2b$10$MAlBQjwOs/EkzeMZsgGy/u4501Rm8EyFMyIkPUmBnRjSCkOMbHZom',
  (SELECT id FROM roles WHERE nombre = 'admin'),
  (SELECT a.id FROM areas a JOIN direcciones d ON d.id = a.direccion_id
     WHERE d.nombre = 'Dirección General' AND a.nombre = 'Dirección General'),
  TRUE,
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@fitnessparatodos.local');

-- ---------------------------------------------------------------------
-- 5. Usuarios reales — lote 1 (2 personas, desde Catalogo_Usuarios_FPT.xlsx)
--    Correcciones aplicadas sobre lo capturado en el Excel:
--    - "Jair Pulido" aparecía dos veces (la fila de ejemplo sobrescrita +
--      una fila nueva) con datos idénticos; se cargó una sola vez.
--    - Correo de Jair corregido de "jair@fpt.como.mx" a "jair@fpt.com.mx"
--      (typo: sobra la "o"; coincide con el dominio real de la empresa).
--    - Rol "Admin" normalizado a "admin" (en el Excel se escribió a mano,
--      no se eligió del desplegable, por eso no coincidía en mayúsculas).
--    - must_change_password = TRUE: ambos deben cambiar su contraseña
--      temporal en el primer login. Las contraseñas temporales van en un
--      documento aparte, NO en este script (no debe llegar al repo de Git).
-- ---------------------------------------------------------------------
INSERT INTO usuarios (nombre, email, password_hash, rol_id, area_id, activo, must_change_password)
SELECT v.nombre, v.email, v.password_hash,
       (SELECT id FROM roles WHERE nombre = v.rol_nombre),
       (SELECT a.id FROM areas a JOIN direcciones d ON d.id = a.direccion_id
          WHERE d.nombre = v.direccion_nombre AND a.nombre = v.area_nombre),
       TRUE, TRUE
FROM (VALUES
  ('Jair Pulido',    'jair@fpt.com.mx',  '$2b$10$j7HiqjQYUwnIMa/FEtOOcOof1LxqDiEXgTALeeg5IEFM/NTCTjSCa', 'admin',       'Finanzas', 'TI'),
  ('Oscar Herrería', 'oscar@fpt.com.mx', '$2b$10$N2ZD8C0P8SHQRyGE7PjSMuFVCI84/kt4nB/zhTx0sYcGygMaJK89a', 'colaborador', 'Finanzas', 'TI')
) AS v(nombre, email, password_hash, rol_nombre, direccion_nombre, area_nombre)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. Verificación rápida
-- ---------------------------------------------------------------------
-- SELECT * FROM roles;
-- SELECT d.nombre AS direccion, a.nombre AS area FROM areas a JOIN direcciones d ON d.id = a.direccion_id ORDER BY 1, 2;
-- SELECT nombre, email, must_change_password, ver_presupuesto_autorizado FROM usuarios;
