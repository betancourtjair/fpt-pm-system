import { ChangeEvent, useEffect, useState } from 'react';
import { archivosApi, Archivo, getUsuario } from '../lib/api';

// Panel de adjuntos reutilizable — mismo componente para el proyecto
// completo y para una tarea individual (prioridad 11). Subir un archivo
// solo exige poder VER el proyecto/tarea dueño (si esta pantalla ya cargó,
// el usuario ya pasó ese filtro); borrar exige ser quien lo subió o poder
// administrar el proyecto — el backend es quien realmente lo hace cumplir,
// aquí solo se oculta el botón para no invitar a un intento que va a fallar.
const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Dueño = { proyectoId: number } | { tareaId: number };

export default function PanelArchivos({ dueño, puedeGestionar }: { dueño: Dueño; puedeGestionar: boolean }) {
  const usuario = getUsuario();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    const promesa = 'proyectoId' in dueño ? archivosApi.deProyecto(dueño.proyectoId) : archivosApi.deTarea(dueño.tareaId);
    promesa
      .then(setArchivos)
      .catch(() => setError('No se pudieron cargar los archivos adjuntos.'))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, ['proyectoId' in dueño ? dueño.proyectoId : dueño.tareaId]);

  async function subir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setError('El archivo supera el límite de 15 MB.');
      return;
    }
    setError(null);
    setSubiendo(true);
    try {
      const actualizados =
        'proyectoId' in dueño
          ? await archivosApi.subirAProyecto(dueño.proyectoId, archivo)
          : await archivosApi.subirATarea(dueño.tareaId, archivo);
      setArchivos(actualizados);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(a: Archivo) {
    if (!confirm(`¿Eliminar el archivo "${a.nombreArchivo}"?`)) return;
    try {
      await archivosApi.eliminar(a.id);
      setArchivos((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el archivo.');
    }
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando archivos…</p>;

  return (
    <div>
      {archivos.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Todavía no hay archivos adjuntos.</p>
      ) : (
        <ul className="mb-2 divide-y divide-gray-50">
          {archivos.map((a) => {
            const puedeBorrar = puedeGestionar || a.subidoPor?.id === usuario?.id;
            return (
              <li key={a.id} className="py-1.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <button
                    onClick={() => archivosApi.descargar(a.id, a.nombreArchivo)}
                    className="font-semibold text-primary-700 hover:underline truncate block"
                    title={a.nombreArchivo}
                  >
                    {a.nombreArchivo}
                  </button>
                  <span className="text-gray-400">
                    {formatearTamano(a.tamanoBytes)} · {a.subidoPor?.nombre ?? '—'} ·{' '}
                    {new Date(a.subidoEn).toLocaleDateString('es-MX')}
                  </span>
                </div>
                {puedeBorrar && (
                  <button
                    onClick={() => eliminar(a)}
                    className="text-danger-500 font-bold hover:underline shrink-0"
                  >
                    Eliminar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-danger-500 text-xs font-medium mb-2">{error}</p>}
      <label className="inline-block text-xs font-bold text-primary-600 hover:text-primary-800 cursor-pointer">
        {subiendo ? 'Subiendo…' : '+ Adjuntar archivo'}
        <input type="file" className="hidden" disabled={subiendo} onChange={subir} />
      </label>
      <span className="text-[11px] text-gray-400 ml-2">Máximo 15 MB.</span>
    </div>
  );
}
