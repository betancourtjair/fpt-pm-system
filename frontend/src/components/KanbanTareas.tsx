import { useState } from 'react';
import { Tarea } from '../lib/api';

// Tablero Kanban (mejora sugerida, ver README sección 4): reutiliza el
// mismo campo `estatus` que ya existía para la tabla — arrastrar una
// tarjeta a otra columna dispara el mismo cambio de estatus que ya hacía
// el flujo de "Avance" en la tabla, solo que de forma visual e inmediata
// (sin ventana de confirmación, a diferencia del Gantt: mover una tarjeta
// de columna es una acción de bajo riesgo, fácil de revertir arrastrándola
// de vuelta).
const COLUMNAS: { estatus: string; titulo: string }[] = [
  { estatus: 'no_iniciada', titulo: 'No iniciada' },
  { estatus: 'en_progreso', titulo: 'En progreso' },
  { estatus: 'bloqueada', titulo: 'Bloqueada' },
  { estatus: 'completada', titulo: 'Completada' },
];

const PRIORIDAD_CLASE: Record<string, string> = {
  alta: 'border-l-4 border-danger-500',
  media: 'border-l-4 border-accent-500',
  baja: 'border-l-4 border-gray-300',
};

export default function KanbanTareas({
  tareas,
  puedeArrastrar,
  onCambiarEstatus,
}: {
  tareas: Tarea[];
  puedeArrastrar: (t: Tarea) => boolean;
  onCambiarEstatus: (tarea: Tarea, nuevoEstatus: string) => void;
}) {
  const [sobreColumna, setSobreColumna] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNAS.map((col) => {
        const deEstaColumna = tareas.filter((t) => t.estatus === col.estatus);
        return (
          <div
            key={col.estatus}
            onDragOver={(e) => {
              e.preventDefault();
              setSobreColumna(col.estatus);
            }}
            onDragLeave={() => setSobreColumna((v) => (v === col.estatus ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setSobreColumna(null);
              const tareaId = Number(e.dataTransfer.getData('text/tarea-id'));
              const tarea = tareas.find((t) => t.id === tareaId);
              if (tarea && tarea.estatus !== col.estatus) onCambiarEstatus(tarea, col.estatus);
            }}
            className={`rounded-2xl p-3 min-h-[200px] transition-colors ${
              sobreColumna === col.estatus ? 'bg-primary-50' : 'bg-gray-100'
            }`}
          >
            <h3 className="font-display font-bold text-xs uppercase text-gray-500 mb-3 px-1">
              {col.titulo} <span className="text-gray-400">({deEstaColumna.length})</span>
            </h3>
            <div className="space-y-2">
              {deEstaColumna.map((t) => {
                const arrastrable = puedeArrastrar(t);
                return (
                  <div
                    key={t.id}
                    draggable={arrastrable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/tarea-id', String(t.id));
                    }}
                    className={`bg-white rounded-xl shadow-card p-3 text-sm ${
                      PRIORIDAD_CLASE[t.prioridad] ?? PRIORIDAD_CLASE.media
                    } ${arrastrable ? 'cursor-grab active:cursor-grabbing' : 'opacity-80'}`}
                    title={arrastrable ? 'Arrastra para cambiar de estatus' : 'Solo lectura'}
                  >
                    <p className="font-semibold text-primary-800 break-words">{t.nombre}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.responsable?.nombre ?? 'Sin responsable'}</p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2">
                      <div
                        className="h-1.5 bg-accent-500 rounded-full"
                        style={{ width: `${t.porcentajeAvance}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{t.fechaFin}</p>
                  </div>
                );
              })}
              {deEstaColumna.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Sin tareas</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
