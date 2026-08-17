-- Automatizaciones configurables por el usuario (tercera ronda de mejoras,
-- ver README sección 4: "si esto → entonces esto" sin necesitar un motor de
-- reglas complejo). Cada regla vive dentro de un proyecto — solo quien puede
-- administrar ese proyecto puede crear/editar/borrar sus reglas.
CREATE TABLE IF NOT EXISTS reglas_automatizacion (
  id SERIAL PRIMARY KEY,
  proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  -- Condiciones: NULL significa "cualquiera" en ese campo. Al menos una de
  -- las tres debe venir distinta de NULL/false (se valida en el DTO).
  condicion_prioridad VARCHAR(10),
  condicion_estatus VARCHAR(30),
  condicion_vencida BOOLEAN NOT NULL DEFAULT false,
  -- Acción: a quién avisar cuando la tarea ENTRA a cumplir la condición.
  -- VARCHAR(30): "notificar_responsable" ya son 22 caracteres por sí solo.
  accion_tipo VARCHAR(30) NOT NULL,
  accion_usuario_id INT REFERENCES usuarios(id),
  activa BOOLEAN NOT NULL DEFAULT true,
  creado_por INT NOT NULL REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reglas_condicion_prioridad'
  ) THEN
    ALTER TABLE reglas_automatizacion ADD CONSTRAINT chk_reglas_condicion_prioridad
      CHECK (condicion_prioridad IS NULL OR condicion_prioridad IN ('alta', 'media', 'baja'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reglas_accion_tipo'
  ) THEN
    ALTER TABLE reglas_automatizacion ADD CONSTRAINT chk_reglas_accion_tipo
      CHECK (accion_tipo IN ('notificar_responsable', 'notificar_director', 'notificar_usuario'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reglas_automatizacion_proyecto ON reglas_automatizacion(proyecto_id);

-- Notificaciones in-app que NO son las alertas por correo de siempre
-- (alertas_enviadas): esta tabla es para avisos que pueden repetirse más de
-- una vez para la misma tarea+usuario (una mención nueva en cada comentario,
-- una automatización que se activa varias veces) — por eso NO lleva un
-- UNIQUE(tarea_id, usuario_id, tipo) como alertas_enviadas. Se combinan con
-- alertas_enviadas en NotificacionesController para una sola campanita.
CREATE TABLE IF NOT EXISTS notificaciones_personalizadas (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(20) NOT NULL,
  tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
  mensaje VARCHAR(300) NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_personalizadas_usuario ON notificaciones_personalizadas(usuario_id);
