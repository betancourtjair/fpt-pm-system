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

function ESTATUS_LABEL(estatus: string) {
  const mapa: Record<string, string> = {
    no_iniciada: 'No iniciada',
    en_progreso: 'En progreso',
    completada: 'Completada',
    bloqueada: 'Bloqueada',
  };
  return mapa[estatus] ?? estatus;
}

// Gantt ligero hecho a mano con divs/SVG (sin librería nueva — decisión
// tomada para no agregar una dependencia pesada solo para esto, PID sección
// 7.3). Se refresca solo cada 2 minutos y se exporta a PDF con la
// impresión nativa del navegador (ver estilos @media print).
//
// El Gantt es la vista de conjunto: muestra TODOS los proyectos dentro del
// alcance de la persona (el backend ya filtra por rol), uno debajo del
// otro, en vez de obligar a elegir uno a la vez — así siempre se ve "todo
// lo que tienes" de un vistazo, y "Exportar a PDF" saca el reporte
// completo.
export default function Gantt() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [tareasPorProyecto, setTareasPorProyecto] = useState<Record<number, Tarea[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  function cargarTareasDeProyecto(pid: number) {
    tareasApi
      .listarDeProyecto(pid)
      .then((t) => {
        setTareasPorProyecto((prev) => ({ ...prev, [pid]: t }));
        setUltimaActualizacion(new Date());
      })
      .catch(() => {});
  }

  useEffect(() => {
    proyectosApi
      .listar()
      .then(async (lista) => {
        setProyectos(lista);
        const entradas = await Promise.all(
          lista.map((p) =>
            tareasApi
              .listarDeProyecto(p.id)
              .then((t) => [p.id, t] as const)
              .catch(() => [p.id, [] as Tarea[]] as const),
          ),
        );
        setTareasPorProyecto(Object.fromEntries(entradas));
        setUltimaActualizacion(new Date());
      })
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (proyectos.length === 0) return;

    // Auto-refresco cada 2 minutos, como especifica el PID sección 7.3 — se
    // conserva como respaldo aunque ya haya WebSockets: si el socket se cae
    // (red restrictiva, cold start de Render, etc.) el Gantt igual se pone
    // al día solo, sin que la persona tenga que recargar la página a mano.
    const intervalo = setInterval(() => {
      proyectos.forEach((p) => cargarTareasDeProyecto(p.id));
    }, 2 * 60 * 1000);

    // Tiempo real (Fase 2 completa): se une a la room de cada proyecto
    // visible y se refresca al instante el que corresponda cuando alguien
    // más crea/edita/borra una tarea, en vez de esperar hasta 2 minutos.
    const socket = getSocket();
    proyectos.forEach((p) => socket.emit('unirse-proyecto', { proyectoId: p.id }));
    const alCambiarTarea = (evento: { proyectoId: number }) => {
      if (proyectos.some((p) => p.id === evento.proyectoId)) {
        cargarTareasDeProyecto(evento.proyectoId);
      }
    };
    socket.on('tarea:cambio', alCambiarTarea);

    return () => {
      clearInterval(intervalo);
      proyectos.forEach((p) => socket.emit('salir-proyecto', { proyectoId: p.id }));
      socket.off('tarea:cambio', alCambiarTarea);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectos]);

  const hayAlgoQueImprimir = proyectos.some((p) => (tareasPorProyecto[p.id]?.length ?? 0) > 0);

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
          <button
            onClick={() => window.print()}
            disabled={!hayAlgoQueImprimir}
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
        <div className="gantt-imprimible space-y-6">
          {proyectos.map((p) => (
            <SeccionGanttProyecto key={p.id} proyecto={p} tareas={tareasPorProyecto[p.id] ?? []} />
          ))}

          <div className="flex flex-wrap gap-4 text-xs text-gray-500 no-imprimir">
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

// Una sección por proyecto: cada una calcula su propia escala de tiempo
// (los proyectos rara vez comparten fechas, así que una escala común los
// dejaría ilegibles) pero todas se ven en la misma pantalla/reporte.
function SeccionGanttProyecto({ proyecto, tareas }: { proyecto: Proyecto; tareas: Tarea[] }) {
  const { minDia, rango, filas } = useMemo(() => {
    if (tareas.length === 0) return { minDia: 0, rango: 1, filas: [] as Array<Tarea & { x0: number; x1: number }> };
    const dias = tareas.flatMap((t) => [aDias(t.fechaInicio), aDias(t.fechaFin)]);
    const min = Math.min(...dias);
    const max = Math.max(...dias);
    const totalDias = Math.max(max - min, 1);
    const filasCalc = tareas.map((t) => {
      const d0 = aDias(t.fechaInicio) - min;
      const d1 = aDias(t.fechaFin) - min;
      return { ...t, x0: (d0 / totalDias) * VIEWBOX_ANCHO, x1: (d1 / totalDias) * VIEWBOX_ANCHO };
    });
    return { minDia: min, rango: totalDias, filas: filasCalc };
  }, [tareas]);

  const indicePorId = useMemo(() => {
    const mapa = new Map<number, number>();
    filas.forEach((f, i) => mapa.set(f.id, i));
    return mapa;
  }, [filas]);

  const altoTotal = Math.max(filas.length, 1) * ROW_ALTO;
  const colorAcento = proyecto.areas[0]?.color || '#94a3b8';
  const idMarcador = `flecha-${proyecto.id}`;

  return (
    <div
      className="bg-white rounded-2xl shadow-card p-6"
      style={{ borderLeft: `4px solid ${colorAcento}` }}
    >
      <h2 className="font-display font-bold text-base mb-4">{proyecto.nombre}</h2>

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
                {tareas.length ? new Date((minDia + rango) * 86400000).toLocaleDateString('es-MX') : ''}
              </span>
            </div>

            <svg
              viewBox={`0 0 ${VIEWBOX_ANCHO} ${altoTotal}`}
              preserveAspectRatio="none"
              style={{ width: '100%', height: altoTotal, display: 'block' }}
            >
              <defs>
                <marker id={idMarcador} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
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
                      markerEnd={`url(#${idMarcador})`}
                    />
                  );
                })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
