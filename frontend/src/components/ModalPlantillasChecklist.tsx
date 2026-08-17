import { FormEvent, useEffect, useState } from 'react';
import { plantillasChecklistApi, PlantillaChecklist } from '../lib/api';

// Administración de plantillas de checklist reutilizables (cuarta ronda de
// mejoras) — modal aparte porque se abre desde cualquier fila de tarea con
// su PanelSubtareas expandido, no tiene pantalla propia en el menú.
export default function ModalPlantillasChecklist({ onClose }: { onClose: () => void }) {
  const [plantillas, setPlantillas] = useState<PlantillaChecklist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    setCargando(true);
    plantillasChecklistApi
      .listar()
      .then(setPlantillas)
      .catch(() => setError('No se pudieron cargar las plantillas.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  function actualizarItem(i: number, valor: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? valor : it)));
  }

  function agregarItem() {
    setItems((prev) => [...prev, '']);
  }

  function quitarItem(i: number) {
    // siempre queda al menos un input de ítem visible, aunque esté vacío
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const itemsLimpios = items.map((it) => it.trim()).filter(Boolean);

  async function crear(e: FormEvent) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || itemsLimpios.length === 0) return;
    setError(null);
    setGuardando(true);
    try {
      const actualizadas = await plantillasChecklistApi.crear({ nombre: nombreLimpio, items: itemsLimpios });
      setPlantillas(actualizadas);
      setNombre('');
      setItems(['']);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear la plantilla.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p: PlantillaChecklist) {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    setError(null);
    try {
      // el backend rechaza esto con 403 si quien pide no es el creador ni admin
      const actualizadas = await plantillasChecklistApi.eliminar(p.id);
      setPlantillas(actualizadas);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo eliminar la plantilla.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-lg text-primary-900">Plantillas de checklist</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Se comparten en toda la organización — cualquiera puede aplicarlas a una tarea; solo quien las
          creó (o un admin) puede eliminarlas.
        </p>

        {error && <p className="text-danger-500 text-xs font-medium mb-3">{error}</p>}

        {cargando ? (
          <p className="text-xs text-gray-400 mb-4">Cargando plantillas…</p>
        ) : plantillas.length === 0 ? (
          <p className="text-xs text-gray-400 mb-4">Todavía no hay plantillas creadas.</p>
        ) : (
          <ul className="mb-4 divide-y divide-gray-100">
            {plantillas.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-700">{p.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {p.items.length} ítem{p.items.length === 1 ? '' : 's'}
                    {p.creador ? ` · creada por ${p.creador.nombre}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => eliminar(p)}
                  className="text-danger-500 font-bold hover:underline text-xs shrink-0"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={crear} className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">+ Nueva plantilla</p>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la plantilla (p. ej. Abrir sucursal nueva)"
            maxLength={120}
            disabled={guardando}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={it}
                  onChange={(e) => actualizarItem(i, e.target.value)}
                  placeholder={`Ítem ${i + 1}`}
                  maxLength={200}
                  disabled={guardando}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => quitarItem(i)}
                  disabled={items.length === 1}
                  className="text-gray-400 hover:text-danger-500 font-bold disabled:opacity-30"
                  aria-label="Quitar ítem"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={agregarItem}
            className="text-xs font-bold text-primary-600 hover:text-primary-800"
          >
            + Agregar ítem
          </button>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={guardando || !nombre.trim() || itemsLimpios.length === 0}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Crear plantilla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
