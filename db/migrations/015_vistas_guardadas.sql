-- Vistas/filtros guardados por usuario (tercera ronda de mejoras, ver
-- README sección 4): cada quien guarda su combinación favorita de filtros
-- por pantalla, para no volver a armarla cada vez que entra.
CREATE TABLE IF NOT EXISTS vistas_guardadas (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  pantalla VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vistas_guardadas_usuario ON vistas_guardadas(usuario_id, pantalla);
