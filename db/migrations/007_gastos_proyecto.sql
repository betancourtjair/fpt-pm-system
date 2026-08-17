-- Mejora funcional (prioridad 8 de la lista): presupuesto real vs. plan.
-- `proyectos.presupuesto` ya guardaba el presupuesto PLANEADO; esta tabla
-- registra el gasto REAL como una bitácora de movimientos (no un solo
-- número editable), para que quede rastro de cuándo y en qué se gastó.
-- El total gastado se calcula sumando esta tabla — ver
-- ProyectosService.mapaGastosPorProyecto().
CREATE TABLE IF NOT EXISTS gastos_proyecto (
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE NOT NULL,
  concepto VARCHAR(200) NOT NULL,
  monto NUMERIC(14, 2) NOT NULL,
  fecha DATE NOT NULL,
  creado_por INT REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_proyecto_proyecto_id ON gastos_proyecto(proyecto_id);
