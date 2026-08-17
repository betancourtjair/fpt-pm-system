import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { getUsuario, proyectosApi, tareasApi, Proyecto, Tarea } from '../lib/api';
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

// Suma/resta días a una fecha 'YYYY-MM-DD' en UTC (evita corrimientos por
// zona horaria) — usado por el arrastre del Gantt (prioridad 10) para
// calcular la nueva fecha a partir del desplazamiento en pixeles.
function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split('-').map((v) => parseInt(v, 10));
  const ms = Date.UTC(anio, mes - 1, dia) + dias * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatearFechaCorta(fechaISO: string): string {
  return new Date(`${fechaISO}T00:00:00Z`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Cambio de fechas propuesto por un arrastre en el Gantt, pendiente de que
// la persona lo confirme en el diálogo (mejora pedida explícitamente: no
// guardar nada hasta que se vea claro qué se va a mover y se confirme).
interface CambioPendiente {
  tarea: Tarea;
  modo: 'mover' | 'redimensionar';
  diasOffset: number;
  fechaInicioNueva: string;
  fechaFinNueva: string;
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
  const usuario = getUsuario();
  // Mismo criterio que ProyectoDetalle/Proyectos: el permiso base habilita
  // el control en la UI, y el backend re-valida el alcance real por
  // Dirección/Área en cada PATCH (verificarPuedeGestionar) — si alguien sin
  // alcance sobre ese proyecto arrastra una barra, el guardado falla y el
  // Gantt se refresca con los datos reales (revierte visualmente solo).
  const puedeEditar = Boolean(usuario?.permisos?.manage_projects);

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [tareasPorProyecto, setTareasPorProyecto] = useState<Record<number, Tarea[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [errorArrastre, setErrorArrastre] = useState<string | null>(null);
  const [cambioPendiente, setCambioPendiente] = useState<CambioPendiente | null>(null);
  const [confirmando, setConfirmando] = useState(false);

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

  // Editar fechas arrastrando (prioridad 10) — el hijo solo calcula el
  // desplazamiento visual y, al soltar el mouse, avisa aquí en vez de
  // guardar directo: primero se muestra un diálogo con el detalle exacto
  // de lo que va a cambiar (pedido explícito: la persona debe ver y
  // confirmar antes de que se mueva cualquier fecha). La barra se queda
  // "congelada" en la posición previsualizada mientras el diálogo está
  // abierto — solo se persiste si se confirma.
  function solicitarConfirmacion(cambio: CambioPendiente) {
    setCambioPendiente(cambio);
  }

  function cancelarCambioPendiente() {
    setCambioPendiente(null);
  }

  async function confirmarCambioPendiente() {
    if (!cambioPendiente) return;
    const { tarea, fechaInicioNueva, fechaFinNueva } = cambioPendiente;
    setConfirmando(true);
    try {
      await tareasApi.actualizar(tarea.id, { fechaInicio: fechaInicioNueva, fechaFin: fechaFinNueva });
      setErrorArrastre(null);
    } catch (err: any) {
      setErrorArrastre(
        err?.response?.data?.message || `No se pudo mover "${tarea.nombre}" — se revirtió el cambio.`,
      );
    } finally {
      // Se recarga siempre, haya salido bien o mal: si falló, esto es lo que
      // hace que la barra "regrese" a su posición real en el próximo render.
      cargarTareasDeProyecto(tarea.proyectoId);
      setConfirmando(false);
      setCambioPendiente(null);
    }
  }

  return (
    <Layout activo="gantt">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-imprimir">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">Diagrama de Gantt</h1>
        <div className="flex flex-wrap items-center gap-3">
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
      {errorArrastre && (
        <div className="no-imprimir flex items-center justify-between bg-danger-500/10 text-danger-500 text-sm font-medium rounded-lg px-4 py-2 mb-4">
          <span>{errorArrastre}</span>
          <button onClick={() => setErrorArrastre(null)} className="font-bold hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {!loading && !error && proyectos.length === 0 && (
        <p className="text-gray-400 text-sm">No hay proyectos dentro de tu alcance todavía.</p>
      )}

      {!loading && proyectos.length > 0 && (
        <div className="gantt-imprimible space-y-6">
          {puedeEditar && (
            <p className="text-xs text-gray-400 no-imprimir -mb-2">
              Arrastra el centro de una barra para mover sus fechas, o su borde derecho para
              alargarla/acortarla.
            </p>
          )}
          {proyectos.map((p) => (
            <SeccionGanttProyecto
              key={p.id}
              proyecto={p}
              tareas={tareasPorProyecto[p.id] ?? []}
              puedeEditar={puedeEditar && !cambioPendiente}
              cambioPendiente={cambioPendiente}
              onSolicitarConfirmacion={solicitarConfirmacion}
            />
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

      {cambioPendiente && (
        <div className="no-imprimir fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-card p-6 max-w-md w-full">
            <h2 className="font-display font-bold text-lg text-primary-900 mb-1">
              Confirmar cambio de fechas
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {cambioPendiente.modo === 'mover'
                ? 'Vas a mover esta tarea completa (misma duración, nuevas fechas):'
                : 'Vas a cambiar la fecha de fin de esta tarea:'}
            </p>
            <div className="bg-primary-50 rounded-lg p-4 mb-4">
              <p className="font-semibold text-primary-800 mb-2">{cambioPendiente.tarea.nombre}</p>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold">Antes</p>
                  <p className="text-gray-600">
                    {formatearFechaCorta(cambioPendiente.tarea.fechaInicio)} →{' '}
                    {formatearFechaCorta(cambioPendiente.tarea.fechaFin)}
                  </p>
                </div>
                <span className="text-primary-400 font-bold">→</span>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase font-bold">Después</p>
                  <p className="text-primary-700 font-semibold">
                    {formatearFechaCorta(cambioPendiente.fechaInicioNueva)} →{' '}
                    {formatearFechaCorta(cambioPendiente.fechaFinNueva)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelarCambioPendiente}
                disabled={confirmando}
                className="text-gray-600 font-semibold text-sm px-4 py-2 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCambioPendiente}
                disabled={confirmando}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
              >
                {confirmando ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

type ModoArrastre = 'mover' | 'redimensionar';

interface EstadoArrastre {
  tareaId: number;
  modo: ModoArrastre;
  xInicioPx: number;
  diasOffset: number;
}

// Posición visual (en unidades de viewBox) de una barra mientras se
// arrastra — si esta tarea no es la que se está arrastrando, regresa su
// posición normal sin cambios.
function posicionConArrastre(
  t: { id: number; x0: number; x1: number },
  arrastre: EstadoArrastre | null,
  unidadesPorDia: number,
): { x0: number; x1: number } {
  if (!arrastre || arrastre.tareaId !== t.id) return { x0: t.x0, x1: t.x1 };
  const desplazamiento = arrastre.diasOffset * unidadesPorDia;
  if (arrastre.modo === 'mover') {
    return { x0: t.x0 + desplazamiento, x1: t.x1 + desplazamiento };
  }
  return { x0: t.x0, x1: Math.max(t.x1 + desplazamiento, t.x0 + 6) };
}

// Una sección por proyecto: cada una calcula su propia escala de tiempo
// (los proyectos rara vez comparten fechas, así que una escala común los
// dejaría ilegibles) pero todas se ven en la misma pantalla/reporte.
function SeccionGanttProyecto({
  proyecto,
  tareas,
  puedeEditar,
  cambioPendiente,
  onSolicitarConfirmacion,
}: {
  proyecto: Proyecto;
  tareas: Tarea[];
  puedeEditar: boolean;
  cambioPendiente: CambioPendiente | null;
  onSolicitarConfirmacion: (cambio: CambioPendiente) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<EstadoArrastre | null>(null);
  // Espejo de `arrastre` legible de forma síncrona desde los listeners de
  // window — necesario porque el efecto que los registra solo se
  // vuelve a ejecutar cuando cambia tareaId (para no desmontar/montar los
  // listeners en cada pixel de movimiento), así que su clausura sobre
  // `arrastre` quedaría obsoleta (siempre con diasOffset=0) durante todo el
  // arrastre si se leyera directo del estado.
  const arrastreRef = useRef<EstadoArrastre | null>(null);
  function actualizarArrastre(valor: EstadoArrastre | null) {
    arrastreRef.current = valor;
    setArrastre(valor);
  }

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
  const unidadesPorDia = VIEWBOX_ANCHO / rango;

  // Mientras se arrastra en vivo se usa `arrastre`; una vez que se suelta el
  // mouse y queda un cambio pendiente de confirmar (diálogo abierto), la
  // barra debe seguir viéndose en su posición nueva aunque `arrastre` ya se
  // haya limpiado — por eso la vista previa cae de regreso a
  // `cambioPendiente` si pertenece a una tarea de esta sección.
  const vistaPrevia: EstadoArrastre | null =
    arrastre ??
    (cambioPendiente && indicePorId.has(cambioPendiente.tarea.id)
      ? {
          tareaId: cambioPendiente.tarea.id,
          modo: cambioPendiente.modo,
          xInicioPx: 0,
          diasOffset: cambioPendiente.diasOffset,
        }
      : null);

  // Editar fechas arrastrando (prioridad 10) — mousedown en la barra arranca
  // el arrastre; el resto se escucha a nivel window porque el mouse puede
  // salirse del <rect> mientras se arrastra rápido.
  function iniciarArrastre(e: ReactMouseEvent, tareaId: number, modo: ModoArrastre) {
    if (!puedeEditar) return;
    e.preventDefault();
    e.stopPropagation();
    actualizarArrastre({ tareaId, modo, xInicioPx: e.clientX, diasOffset: 0 });
  }

  useEffect(() => {
    if (!arrastre) return;

    function pixelesPorDia(): number {
      const anchoPx = svgRef.current?.getBoundingClientRect().width ?? VIEWBOX_ANCHO;
      return anchoPx / rango;
    }

    function alMover(e: MouseEvent) {
      const prev = arrastreRef.current;
      if (!prev) return;
      const deltaPx = e.clientX - prev.xInicioPx;
      const diasOffset = Math.round(deltaPx / pixelesPorDia());
      if (diasOffset === prev.diasOffset) return; // evita renders de más
      actualizarArrastre({ ...prev, diasOffset });
    }

    // IMPORTANTE: el cálculo y la llamada a onSolicitarConfirmacion leen
    // arrastreRef.current (no el `prev` de un setState) y ocurren UNA sola
    // vez aquí — nunca dentro de un actualizador de estado, porque React
    // puede invocar esa función más de una vez (p. ej. en modo estricto de
    // desarrollo) y eso abriría el diálogo de confirmación dos veces.
    // Soltar el mouse NO guarda nada todavía — solo arma el diálogo de
    // confirmación (mejora pedida: la persona debe ver y confirmar el
    // cambio exacto antes de que se mueva cualquier fecha).
    function alSoltar() {
      const actual = arrastreRef.current;
      if (actual) {
        const tarea = filas.find((f) => f.id === actual.tareaId);
        if (tarea && actual.diasOffset !== 0) {
          if (actual.modo === 'mover') {
            onSolicitarConfirmacion({
              tarea,
              modo: 'mover',
              diasOffset: actual.diasOffset,
              fechaInicioNueva: sumarDias(tarea.fechaInicio, actual.diasOffset),
              fechaFinNueva: sumarDias(tarea.fechaFin, actual.diasOffset),
            });
          } else {
            // Redimensionar: solo cambia fechaFin, sin cruzar fechaInicio
            // (una tarea no puede terminar antes de empezar — misma regla
            // que ya valida el backend en TareasService.validarFechas).
            const nuevaFechaFin = sumarDias(tarea.fechaFin, actual.diasOffset);
            if (nuevaFechaFin >= tarea.fechaInicio) {
              onSolicitarConfirmacion({
                tarea,
                modo: 'redimensionar',
                diasOffset: actual.diasOffset,
                fechaInicioNueva: tarea.fechaInicio,
                fechaFinNueva: nuevaFechaFin,
              });
            }
          }
        }
      }
      actualizarArrastre(null);
    }

    window.addEventListener('mousemove', alMover);
    window.addEventListener('mouseup', alSoltar);
    return () => {
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastre?.tareaId, rango]);

  return (
    <div
      className="bg-white rounded-2xl shadow-card p-6"
      style={{ borderLeft: `4px solid ${colorAcento}` }}
    >
      <h2 className="font-display font-bold text-base mb-4">{proyecto.nombre}</h2>

      {filas.length === 0 ? (
        <p className="text-gray-400 text-sm">Este proyecto todavía no tiene tareas.</p>
      ) : (
        // overflow-x-auto + min-width: en pantallas angostas la columna de
        // nombres (220px fijos) dejaba casi sin espacio a las barras — mejor
        // dejar el diagrama con su ancho cómodo y que se deslice
        // horizontalmente dentro de la tarjeta que encogerlo hasta ilegible.
        // Nota: el arrastre para mover/redimensionar depende de eventos de
        // mouse (mousedown/mousemove) y no responde al tacto — en móvil el
        // Gantt queda de solo lectura, edítalo desde escritorio.
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[220px_1fr] min-w-[640px]">
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
              ref={svgRef}
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
                const { x0, x1 } = posicionConArrastre(t, vistaPrevia, unidadesPorDia);
                return (
                  <rect
                    key={t.id}
                    x={x0}
                    y={y - alturaBarra / 2}
                    width={Math.max(x1 - x0, 6)}
                    height={alturaBarra}
                    rx={4}
                    fill={COLOR_ESTATUS[t.estatus] ?? '#7E3FF2'}
                    style={{ cursor: puedeEditar ? 'grab' : 'default' }}
                    onMouseDown={(e) => iniciarArrastre(e, t.id, 'mover')}
                  >
                    <title>
                      {t.nombre} · {ESTATUS_LABEL(t.estatus)} · {t.porcentajeAvance}%
                      {puedeEditar ? ' · arrastra para mover, borde derecho para alargar/acortar' : ''}
                    </title>
                  </rect>
                );
              })}

              {filas.map((t, i) => {
                // Barra de progreso interna (relleno claro sobre la barra).
                const y = i * ROW_ALTO + ROW_ALTO / 2;
                const alturaBarra = ROW_ALTO * 0.55;
                const { x0, x1 } = posicionConArrastre(t, vistaPrevia, unidadesPorDia);
                const ancho = Math.max(x1 - x0, 6);
                return (
                  <rect
                    key={`avance-${t.id}`}
                    x={x0}
                    y={y - alturaBarra / 2}
                    width={(ancho * t.porcentajeAvance) / 100}
                    height={alturaBarra}
                    rx={4}
                    fill="#FFE600"
                    opacity={0.55}
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              {puedeEditar &&
                filas.map((t, i) => {
                  // Manija de redimensionar: una franja angosta sobre el
                  // borde derecho de la barra, con su propio cursor y su
                  // propio modo de arrastre ('redimensionar' en vez de
                  // 'mover').
                  const y = i * ROW_ALTO + ROW_ALTO / 2;
                  const alturaBarra = ROW_ALTO * 0.55;
                  const { x1 } = posicionConArrastre(t, vistaPrevia, unidadesPorDia);
                  const anchoManija = 10;
                  return (
                    <rect
                      key={`manija-${t.id}`}
                      x={x1 - anchoManija}
                      y={y - alturaBarra / 2}
                      width={anchoManija}
                      height={alturaBarra}
                      fill="transparent"
                      style={{ cursor: 'ew-resize' }}
                      onMouseDown={(e) => iniciarArrastre(e, t.id, 'redimensionar')}
                    />
                  );
                })}

              {filas.flatMap((t) =>
                // Dependencias múltiples (cuarta ronda de mejoras) — una
                // flecha por cada predecesora, en vez de una sola.
                (t.dependencias ?? [])
                  .filter((dep) => indicePorId.has(dep.id))
                  .map((dep) => {
                    const iDestino = indicePorId.get(t.id)!;
                    const iOrigen = indicePorId.get(dep.id)!;
                    const origen = filas[iOrigen];
                    const yOrigen = iOrigen * ROW_ALTO + ROW_ALTO / 2;
                    const yDestino = iDestino * ROW_ALTO + ROW_ALTO / 2;
                    const xOrigen = origen.x1;
                    const xDestino = t.x0;
                    const xMedio = xOrigen + Math.max((xDestino - xOrigen) / 2, 10);
                    return (
                      <path
                        key={`dep-${dep.id}-${t.id}`}
                        d={`M ${xOrigen} ${yOrigen} C ${xMedio} ${yOrigen}, ${xMedio} ${yDestino}, ${xDestino - 8} ${yDestino}`}
                        fill="none"
                        stroke="#7E3FF2"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        markerEnd={`url(#${idMarcador})`}
                      />
                    );
                  }),
              )}
            </svg>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
