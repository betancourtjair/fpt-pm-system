import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { tareasApi, Tarea } from '../lib/api';

// "Mis tareas" (mejora sugerida, ver README sección 4): todo lo asignado al
// usuario actual a través de TODOS sus proyectos, para no tener que entrar
// proyecto por proyecto a ver qué le toca — el dolor más común de quien no
// es gerente de proyecto.
const ESTATUS_LABEL: Record<string, string> = {
  no_iniciada: 'No iniciada',
  en_progreso: 'En progreso',
  completada: 'Completada',
  bloqueada: 'Bloqueada',
};
const PRIORIDAD_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PRIORIDAD_CLASE: Record<string, string> = {
  alta: 'bg-danger-500/10 text-danger-600',
  media: 'bg-accent-500/15 text-accent-700',
  baja: 'bg-gray-100 text-gray-500',
};

function estaVencida(t: Tarea): boolean {
  return t.estatus !== 'completada' && t.fechaFin < new Date().toISOString().slice(0, 10);
}

export default function MisTareas() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(true);

  useEffect(() => {
    tareasApi
      .misTareas()
      .then(setTareas)
      .catch(() => setError('No se pudieron cargar tus tareas.'))
      .finally(() => setCargando(false));
  }, []);

  const visibles = soloPendientes ? tareas.filter((t) => t.estatus !== 'completada') : tareas;

  return (
    <Layout activo="mis-tareas">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">Mis tareas</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Ocultar completadas
        </label>
      </div>

      {cargando ? (
        <p className="text-gray-500 text-sm">Cargando…</p>
      ) : error ? (
        <p className="text-danger-500 text-sm">{error}</p>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center text-gray-400">
          {soloPendientes ? 'No tienes tareas pendientes. 🎉' : 'No tienes tareas asignadas todavía.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-primary-50 text-primary-800 text-left">
              <tr>
                <th className="px-5 py-3 font-bold">Tarea</th>
                <th className="px-5 py-3 font-bold">Proyecto</th>
                <th className="px-5 py-3 font-bold">Fecha límite</th>
                <th className="px-5 py-3 font-bold">Prioridad</th>
                <th className="px-5 py-3 font-bold">Estatus / avance</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 align-top">
                  <td className="px-5 py-3 font-semibold text-primary-800">{t.nombre}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {t.proyecto ? (
                      <Link to={`/proyectos/${t.proyecto.id}`} className="text-primary-600 hover:underline">
                        {t.proyecto.nombre}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`px-5 py-3 ${estaVencida(t) ? 'text-danger-500 font-bold' : 'text-gray-500'}`}>
                    {t.fechaFin}
                    {estaVencida(t) && ' · Vencida'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        PRIORIDAD_CLASE[t.prioridad] ?? PRIORIDAD_CLASE.media
                      }`}
                    >
                      {PRIORIDAD_LABEL[t.prioridad] ?? 'Media'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-bold uppercase text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                      {ESTATUS_LABEL[t.estatus] ?? t.estatus}
                    </span>
                    <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5">
                      <div
                        className="h-1.5 bg-accent-500 rounded-full"
                        style={{ width: `${t.porcentajeAvance}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
