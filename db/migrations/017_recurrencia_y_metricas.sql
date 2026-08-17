-- Tareas recurrentes (cuarta ronda de mejoras, ver README sección 4): una
-- tarea puede marcarse para repetirse sola cuando se completa (mantenimiento
-- mensual de equipo, auditoría de inventario por sucursal, etc.) — al pasar
-- a "completada" se crea automáticamente la siguiente ocurrencia con las
-- fechas desplazadas, sin que nadie tenga que volver a capturarla a mano.
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recurrencia_tipo VARCHAR(10);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recurrencia_intervalo SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recurrencia_activa BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tareas_recurrencia_tipo'
  ) THEN
    ALTER TABLE tareas ADD CONSTRAINT chk_tareas_recurrencia_tipo
      CHECK (recurrencia_tipo IS NULL OR recurrencia_tipo IN ('diaria', 'semanal', 'mensual'));
  END IF;
END $$;

-- Métricas para reportes ejecutivos (cuarta ronda de mejoras): sin fecha de
-- creación ni de finalización real no se puede calcular "tiempo promedio
-- para completar" ni una tendencia mes a mes — antes solo existía `estatus`,
-- sin ningún rastro de cuándo pasó a serlo. `creado_en` en filas ya
-- existentes queda con la fecha de esta migración (no hay forma de
-- reconstruir la real) — se documenta como limitación conocida en el README.
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS completada_en TIMESTAMPTZ;

-- Plantillas de checklist reutilizables (cuarta ronda de mejoras): en vez de
-- recrear a mano el mismo checklist en cada tarea nueva (ej. "abrir
-- sucursal": permisos, inventario inicial, capacitación...), se guarda una
-- vez y se aplica con un clic. Compartidas en toda la organización (no por
-- proyecto) porque suelen repetirse entre proyectos distintos.
CREATE TABLE IF NOT EXISTS plantillas_checklist (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  creado_por INT NOT NULL REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plantillas_checklist_items (
  id SERIAL PRIMARY KEY,
  plantilla_id INT NOT NULL REFERENCES plantillas_checklist(id) ON DELETE CASCADE,
  texto VARCHAR(300) NOT NULL,
  orden SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plantillas_checklist_items_plantilla ON plantillas_checklist_items(plantilla_id);
