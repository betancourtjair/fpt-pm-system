import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { proyectosApi, tareasApi, Proyecto, Tarea } from '../lib/api';
import { getSocket } from '../lib/socket';

const COLOR_ESTATUS: Record<string, string> = {
  no_iniciada: '#BB94E2',
  en_progreso: '#7E3FF2',
  completada: '#2E0A4D',
  bloqueada: '#E8384F',
};

const ROW_ALTO = 44;
const VIEWBOX_ANCHO = 1000;

function aDias(fechaISO: string) {
  return Math.floor(new Date(`${fechaISO}T00:00:00Z`).getTime() / 86400000);
}

// Gantt ligero hecho a mano con divs/SVG (sin librería nueva — decisión
// tomada para no agregar una dependencia pesada solo para esto, PID sección
// 7.3). Se refresca solo cada 2 minutos y se exporta a PDF con la
// impresión nativa del navegador (ver estilos @media print).
export default function Gantt() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  useEffect(() => {
    proyectosApi
      .listar()
      .then((lista) => {
        setProyectos(lista);
        if (lista.length > 0) setProyectoId(lista[0].id);
      })
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  }, []);

  function cargarTareas(pid: number) {
    tareasApi
      .listarDeProyecto(pid)
      .then((t) => {
        setTareas(t);
        setUltimaActualizacion(new Date());
      })
      .catch(() => setError('No se pudieron cargar las tareas de este proyecto.'));
  }

  useEffect(() => {
    if (proyectoId === null) return;
    cargarTareas(proyectoId);
    // Auto-refresco cada 2 minutos, como especifica el PID sección 7.3 — se
    // conserva como respaldo aunque ya haya WebSockets: si el socket se cae
    // (red restrictiva, cold start de Render, etc.) el Gantt igual se pone
    // al día solo, sin que la persona tenga que recargar la página a mano.
    const intervalo = setInterval(() => cargarTareas(proyectoId), 2 * 60 * 1000);

    // Tiempo real (Fase 2 completa): se une a la room del proyecto y se
    // refresca al instante cuando alguien más crea/edita/borra una tarea,
    // en vez de esperar hasta 2 minutos a que llegue el polling de respaldo.
    const socket = getSocket();
    socket.emit('unirse-proyecto', { proyectoId });
    const alCambiarTarea = (evento: { proyectoId: number }) => {
      if (evento.proyectoId === proyectoId) cargarTareas(proyectoId);
    };
    socket.on('tarea:cambio', alCambiarTarea);

    return () => {
      clearInterval(intervalo);
      socket.emit('salir-proyecto', { proyectoId });
      socket.off('tarea:cambio', alCambiarTarea);
    };
  }, [proyectoId]);

  const { minDia, rango, filas } = useMemo(() => {
    if (tareas.length === 0) return { minDia: 0, rango: 1, filas: [] as Array<Tarea & { x0: number; x1: number }> };
    const dias = tareas.flatMap((t) => [aDias(t.fechaInicio), aDias(t.fechaFin)]);
    const min = Math.min(...dias);
    const max = Math.max(...dias);
    const totalDias = Math.max(max - min, 1);
    const filas = tareas.map((t) => {
      const d0 = aDias(t.fechaInicio) - min;
      const d1 = aDias(t.fechaFin) - min;
      return { ...t, x0: (d0 / totalDias) * VIEWBOX_ANCHO, x1: (d1 / totalDias) * VIEWBOX_ANCHO };
    });
    return { minDia: min, rango: totalDias, filas };
  }, [tareas]);

  const indicePorId = useMemo(() => {
    const mapa = new Map<number, number>();
    filas.forEach((f, i) => mapa.set(f.id, i));
    return mapa;
  }, [filas]);

  const altoTotal = Math.max(filas.length, 1) * ROW_ALTO;

  return (
    <Layout activo="gantt">
      <div className="flex items-center justify-between mb-6 no-imprimir">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">Diagrama de Gantt</h1>
        <div className="flex items-center gap-3">
          {ultimaActualizacion && (
            <span className="text-xs text-gray-400">
              Actualizado {ultimaActualizacion.toLocaleTimeString('es-MX')} · en vivo (respaldo cada 2 min)
            </span>
          )}
          <select
            value={proyectoId ?? ''}
            onChange={(e) => setProyectoId(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            disabled={filas.length === 0}
            className="bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            Exportar a PDF
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
      {error && <p className="text-danger-500 text-sm">{error}</p>}

      {!loading && !error && proyectos.length === 0 && (
        <p className="text-gray-400 text-sm">No hay proyectos dentro de tu alcance todavía.</p>
      )}

      {!loading && proyectos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6 gantt-imprimible">
          <h2 className="font-display font-bold text-base mb-4">
            {proyectos.find((p) => p.id === proyectoId)?.nombre}
          </h2>

          {filas.length === 0 ? (
            <p className="text-gray-400 text-sm">Este proyecto todavía no tiene tareas.</p>
          ) : (
            <div className="grid grid-cols-[220px_1fr]">
              <div>
                <div style={{ height: 24 }} />
                {filas.map((t) => (
                  <div
                    key={t.id}
                    style={{ height: ROW_ALTO }}
                    className="flex items-center text-sm font-semibold text-primary-800 pr-3 truncate"
                    title={t.nombre}
                  >
                    {t.nombre}
                  </div>
                ))}
              </div>

              <div className="relative border-l border-gray-100">
                <div className="flex justify-between text-xs text-gray-400 px-1" style={{ height: 24 }}>
                  <span>{tareas.length ? new Date(minDia * 86400000).toLocaleDateString('es-MX') : ''}</span>
                  <span>
                    {tareas.length
                      ? new Date((minDia + rango) * 86400000).toLocaleDateString('es-MX')
                      : ''}
                  </span>
                </div>

                <svg
                  viewBox={`0 0 ${VIEWBOX_ANCHO} ${altoTotal}`}
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: altoTotal, display: 'block' }}
                >
                  <defs>
                    <marker id="flecha" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#7E3FF2" />
                    </marker>
                  </defs>

                  {filas.map((t, i) => {
                    const y = i * ROW_ALTO + ROW_ALTO / 2;
                    const alturaBarra = ROW_ALTO * 0.55;
                    return (
                      <rect
                        key={t.id}
                        x={t.x0}
                        y={y - alturaBarra / 2}
                        width={Math.max(t.x1 - t.x0, 6)}
                        height={alturaBarra}
                        rx={4}
                        fill={COLOR_ESTATUS[t.estatus] ?? '#7E3FF2'}
                      >
                        <title>
                          {t.nombre} · {ESTATUS_LABEL(t.estatus)} · {t.porcentajeAvance}%
                        </title>
                      </rect>
                    );
                  })}

                  {filas.map((t, i) => {
                    // Barra de progreso interna (relleno claro sobre la barra).
                    const y = i * ROW_ALTO + ROW_ALTO / 2;
                    const alturaBarra = ROW_ALTO * 0.55;
                    const ancho = Math.max(t.x1 - t.x0, 6);
                    return (
                      <rect
                        key={`avance-${t.id}`}
                        x={t.x0}
                        y={y - alturaBarra / 2}
                        width={(ancho * t.porcentajeAvance) / 100}
                        height={alturaBarra}
                        rx={4}
                        fill="#FFE600"
                        opacity={0.55}
                      />
                    );
                  })}

                  {filas
                    .filter((t) => t.dependenciaId && indicePorId.has(t.dependenciaId))
                    .map((t) => {
                      const iDestino = indicePorId.get(t.id)!;
                      const iOrigen = indicePorId.get(t.dependenciaId!)!;
                      const origen = filas[iOrigen];
                      const yOrigen = iOrigen * ROW_ALTO + ROW_ALTO / 2;
                      const yDestino = iDestino * ROW_ALTO + ROW_ALTO / 2;
                      const xOrigen = origen.x1;
                      const xDestino = t.x0;
                      const xMedio = xOrigen + Math.max((xDestino - xOrigen) / 2, 10);
                      return (
                        <path
                          key={`dep-${t.id}`}
                          d={`M ${xOrigen} ${yOrigen} C ${xMedio} ${yOrigen}, ${xMedio} ${yDestino}, ${xDestino - 8} ${yDestino}`}
                          fill="none"
                          stroke="#7E3FF2"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          markerEnd="url(#flecha)"
                        />
                      );
                    })}
                </svg>
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-6 text-xs text-gray-500 no-imprimir">
            {Object.entries(COLOR_ESTATUS).map(([clave, color]) => (
              <span key={clave} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {ESTATUS_LABEL(clave)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-500 opacity-70" />
              Avance completado
            </span>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ESTATUS_LABEL(estatus: string) {
  const mapa: Record<string, string> = {
    no_iniciada: 'No iniciada',
    en_progreso: 'En progreso',
    completada: 'Completada',
    bloqueada: 'Bloqueada',
  };
  return mapa[estatus] ?? estatus;
}
