import { FormEvent, useEffect, useRef, useState } from 'react';
import { plantillasChecklistApi, subtareasApi, PlantillaChecklist, SubtareaChecklist } from '../lib/api';
import ModalPlantillasChecklist from './ModalPlantillasChecklist';

// Subtareas / checklist dentro de una tarea (tercera ronda de mejoras) —
// mismo patrón de panel expandible que Archivos/Comentarios, una tarea a la
// vez. Marcar "completada" es para el asignado o quien administra el
// proyecto (puedeMarcar); editar/borrar el texto del ítem es solo para quien
// administra (puedeGestionar) — el backend es quien realmente lo hace
// cumplir, aquí solo se oculta lo que de todos modos rechazaría.
export default function PanelSubtareas({
  tareaId,
  puedeGestionar,
  puedeMarcar,
}: {
  tareaId: number;
  puedeGestionar: boolean;
  puedeMarcar: boolean;
}) {
  const [subtareas, setSubtareas] = useState<SubtareaChecklist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [textoEditando, setTextoEditando] = useState('');

  // Plantillas de checklist reutilizables (cuarta ronda de mejoras) — el
  // menú se llena al abrirlo (no en cada montaje: cada fila de tarea trae
  // su propio PanelSubtareas y no todas se van a usar) y siempre se
  // refresca para reflejar plantillas creadas/borradas desde el modal.
  const [mostrarMenuPlantillas, setMostrarMenuPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaChecklist[]>([]);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [aplicandoPlantillaId, setAplicandoPlantillaId] = useState<number | null>(null);
  const [mostrarModalPlantillas, setMostrarModalPlantillas] = useState(false);
  const menuPlantillasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mostrarMenuPlantillas) return;
    function alClicFuera(e: MouseEvent) {
      if (menuPlantillasRef.current && !menuPlantillasRef.current.contains(e.target as Node)) {
        setMostrarMenuPlantillas(false);
      }
    }
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, [mostrarMenuPlantillas]);

  function alternarMenuPlantillas() {
    const abrir = !mostrarMenuPlantillas;
    setMostrarMenuPlantillas(abrir);
    if (abrir) {
      setCargandoPlantillas(true);
      plantillasChecklistApi
        .listar()
        .then(setPlantillas)
        .catch(() => setError('No se pudieron cargar las plantillas.'))
        .finally(() => setCargandoPlantillas(false));
    }
  }

  async function aplicarPlantilla(p: PlantillaChecklist) {
    setError(null);
    setAplicandoPlantillaId(p.id);
    try {
      const actualizadas = await plantillasChecklistApi.aplicarATarea(p.id, tareaId);
      setSubtareas(actualizadas);
      setMostrarMenuPlantillas(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo aplicar la plantilla.');
    } finally {
      setAplicandoPlantillaId(null);
    }
  }

  useEffect(() => {
    subtareasApi
      .deTarea(tareaId)
      .then(setSubtareas)
      .catch(() => setError('No se pudo cargar el checklist.'))
      .finally(() => setCargando(false));
  }, [tareaId]);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setError(null);
    setAgregando(true);
    try {
      const actualizadas = await subtareasApi.crear(tareaId, limpio);
      setSubtareas(actualizadas);
      setTexto('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo agregar el ítem.');
    } finally {
      setAgregando(false);
    }
  }

  async function alternarCompletada(s: SubtareaChecklist) {
    setError(null);
    try {
      const actualizadas = await subtareasApi.actualizar(s.id, { completada: !s.completada });
      setSubtareas(actualizadas);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo actualizar el ítem.');
    }
  }

  function abrirEdicion(s: SubtareaChecklist) {
    setEditandoId(s.id);
    setTextoEditando(s.texto);
  }

  async function guardarEdicion(s: SubtareaChecklist) {
    const limpio = textoEditando.trim();
    if (!limpio) return;
    setError(null);
    try {
      const actualizadas = await subtareasApi.actualizar(s.id, { texto: limpio });
      setSubtareas(actualizadas);
      setEditandoId(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo editar el ítem.');
    }
  }

  async function eliminar(s: SubtareaChecklist) {
    if (!confirm(`¿Eliminar el ítem "${s.texto}"?`)) return;
    try {
      await subtareasApi.eliminar(s.id);
      setSubtareas((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el ítem.');
    }
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando checklist…</p>;

  const completadas = subtareas.filter((s) => s.completada).length;

  return (
    <div>
      {subtareas.length > 0 && (
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {completadas}/{subtareas.length} completadas
        </p>
      )}
      {subtareas.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Todavía no hay ítems en el checklist.</p>
      ) : (
        <ul className="mb-2 divide-y divide-gray-50">
          {subtareas.map((s) => (
            <li key={s.id} className="py-1.5 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.completada}
                disabled={!puedeMarcar}
                onChange={() => alternarCompletada(s)}
              />
              {editandoId === s.id ? (
                <>
                  <input
                    type="text"
                    value={textoEditando}
                    onChange={(e) => setTextoEditando(e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => guardarEdicion(s)}
                    className="text-primary-700 font-bold hover:underline shrink-0"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="text-gray-400 hover:underline shrink-0"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`flex-1 min-w-0 break-words ${
                      s.completada ? 'line-through text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    {s.texto}
                  </span>
                  {puedeGestionar && (
                    <>
                      <button
                        onClick={() => abrirEdicion(s)}
                        className="text-gray-500 font-bold hover:underline shrink-0"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(s)}
                        className="text-danger-500 font-bold hover:underline shrink-0"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-danger-500 text-xs font-medium mb-2">{error}</p>}
      {puedeGestionar && (
        <div className="flex items-center gap-3 mb-2">
          <div className="relative" ref={menuPlantillasRef}>
            <button
              type="button"
              onClick={alternarMenuPlantillas}
              className="text-xs font-bold text-primary-600 hover:text-primary-800"
            >
              + Aplicar plantilla ▾
            </button>
            {mostrarMenuPlantillas && (
              <div className="absolute z-10 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-card py-1">
                {cargandoPlantillas ? (
                  <p className="px-3 py-2 text-xs text-gray-400">Cargando…</p>
                ) : plantillas.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">Todavía no hay plantillas creadas.</p>
                ) : (
                  plantillas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => aplicarPlantilla(p)}
                      disabled={aplicandoPlantillaId !== null}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-primary-50 disabled:opacity-50"
                    >
                      {p.nombre} <span className="text-gray-400">({p.items.length})</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMostrarModalPlantillas(true)}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600"
          >
            Administrar plantillas
          </button>
        </div>
      )}
      <form onSubmit={agregar} className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Agregar ítem al checklist…"
          maxLength={200}
          disabled={agregando}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={agregando || !texto.trim()}
          className="text-xs font-bold text-primary-600 hover:text-primary-800 disabled:text-gray-300"
        >
          {agregando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
      {mostrarModalPlantillas && (
        <ModalPlantillasChecklist onClose={() => setMostrarModalPlantillas(false)} />
      )}
    </div>
  );
}
