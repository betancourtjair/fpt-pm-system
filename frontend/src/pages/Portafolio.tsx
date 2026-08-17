import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { catalogoApi, proyectosApi, Direccion, Proyecto } from '../lib/api';

// Mismos colores por estatus que Gantt.tsx (COLOR_ESTATUS) — se duplican
// aquí a propósito en vez de importar del otro archivo: esta pantalla es
// independiente y no debe volverse a romper si Gantt.tsx cambia por otro
// trabajo en curso. Se elige colorear por estatus (no por Área) porque el
// objetivo de esta vista es detectar cruces/saturación de trabajo — el
// estatus es lo que responde "¿esto ya avanzó o está detenido?" de un
// vistazo; el color de Área ya se usa para agrupar (el borde de cada
// sección), así que repetirlo en la barra sería redundante.
const COLOR_ESTATUS: Record<string, string> = {
  no_iniciada: '#BB94E2',
  en_progreso: '#7E3FF2',
  completada: '#2E0A4D',
  bloqueada: '#E8384F',
  no_iniciado: '#BB94E2',
  completado: '#2E0A4D',
  bloqueado: '#E8384F',
};

const ESTATUS_LABEL: Record<string, string> = {
  no_iniciada: 'No iniciada',
  no_iniciado: 'No iniciado',
  en_progreso: 'En progreso',
  completada: 'Completada',
  completado: 'Completado',
  bloqueada: 'Bloqueada',
  bloqueado: 'Bloqueado',
};

const ROW_ALTO = 40;
const VIEWBOX_ANCHO = 1000;
const SIN_DIRECCION = -1;

function aDias(fechaISO: string) {
  return Math.floor(new Date(`${fechaISO}T00:00:00Z`).getTime() / 86400000);
}

function formatearFechaCorta(dia: number): string {
  return new Date(dia * 86400000).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Primer día de cada mes dentro de [minDia, maxDia] — usados como marcas del
// eje compartido (mismo criterio en todas las secciones, a diferencia de
// Gantt.tsx donde cada proyecto trae su propio rango).
function marcasDeMes(minDia: number, maxDia: number): number[] {
  const marcas: number[] = [];
  const inicio = new Date(minDia * 86400000);
  const cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
  while (cursor.getTime() / 86400000 <= maxDia) {
    marcas.push(Math.floor(cursor.getTime() / 86400000));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return marcas;
}

// Vista de portafolio (bird's-eye view) — a diferencia de Gantt.tsx, donde
// cada proyecto tiene su propia escala de tiempo (ideal para leer un
// proyecto a detalle, pero imposible para comparar entre proyectos), aquí
// TODOS los proyectos comparten un solo eje de fechas: el objetivo es ver de
// un vistazo dónde se traslapan/saturan varios proyectos de la misma
// Dirección, algo que con ejes independientes no se puede notar.
export default function Portafolio() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colapsadas, setColapsadas] = useState<Record<number, boolean>>({});

  useEffect(() => {
    Promise.all([proyectosApi.listar(), catalogoApi.direcciones()])
      .then(([listaProyectos, listaDirecciones]) => {
        setProyectos(listaProyectos);
        setDirecciones(listaDirecciones);
      })
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  }, []);

  // Un proyecto puede tener varias Áreas (y por lo tanto, en teoría, varias
  // Direcciones) — se agrupa bajo la Dirección de su primera Área nada más:
  // es la opción más simple que sigue siendo correcta en el caso normal (un
  // proyecto casi siempre vive dentro de una sola Dirección) sin duplicar la
  // barra del proyecto en varias secciones.
  const gruposPorDireccion = useMemo(() => {
    const mapa = new Map<number, Proyecto[]>();
    for (const p of proyectos) {
      const direccionId = p.areas[0]?.direccionId ?? SIN_DIRECCION;
      const lista = mapa.get(direccionId) ?? [];
      lista.push(p);
      mapa.set(direccionId, lista);
    }
    return mapa;
  }, [proyectos]);

  // Solo se listan las Direcciones que sí tienen al menos un proyecto dentro
  // del alcance de este usuario — una Dirección vacía no debe ocupar espacio
  // en pantalla (pedido explícito).
  const seccionesOrdenadas = useMemo(() => {
    const secciones = direcciones
      .filter((d) => gruposPorDireccion.has(d.id))
      .map((d) => ({ id: d.id, nombre: d.nombre, color: d.color, proyectos: gruposPorDireccion.get(d.id)! }));
    const sinDireccion = gruposPorDireccion.get(SIN_DIRECCION);
    if (sinDireccion?.length) {
      secciones.push({ id: SIN_DIRECCION, nombre: 'Sin Dirección asignada', color: '#94a3b8', proyectos: sinDireccion });
    }
    return secciones;
  }, [direcciones, gruposPorDireccion]);

  // Rango global de fechas: el único eje que comparten todas las secciones.
  // Con 0 proyectos min/max no existen — se cae a un rango de 1 día para no
  // dividir entre cero al calcular las posiciones de las barras.
  const { minDia, rango } = useMemo(() => {
    if (proyectos.length === 0) return { minDia: 0, rango: 1 };
    const dias = proyectos.flatMap((p) => [aDias(p.fechaInicio), aDias(p.fechaFin)]);
    const min = Math.min(...dias);
    const max = Math.max(...dias);
    return { minDia: min, rango: Math.max(max - min, 1) };
  }, [proyectos]);

  const maxDia = minDia + rango;
  const hoyDia = aDias(new Date().toISOString().slice(0, 10));
  const hoyEnRango = hoyDia >= minDia && hoyDia <= maxDia;
  const xHoy = ((hoyDia - minDia) / rango) * VIEWBOX_ANCHO;

  const marcas = useMemo(() => marcasDeMes(minDia, maxDia), [minDia, maxDia]);

  function xDe(fechaISO: string): number {
    return ((aDias(fechaISO) - minDia) / rango) * VIEWBOX_ANCHO;
  }

  function toggleSeccion(direccionId: number) {
    setColapsadas((prev) => ({ ...prev, [direccionId]: !prev[direccionId] }));
  }

  return (
    <Layout activo="portafolio">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-primary-900">
            Portafolio de proyectos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Todos tus proyectos en una sola línea de tiempo, agrupados por Dirección — así se ven
            los traslapes y las cargas de trabajo entre proyectos de un vistazo.
          </p>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
      {error && <p className="text-danger-500 text-sm">{error}</p>}

      {!loading && !error && proyectos.length === 0 && (
        <p className="text-gray-400 text-sm">No hay proyectos dentro de tu alcance todavía.</p>
      )}

      {!loading && !error && proyectos.length > 0 && (
        <div className="space-y-6">
          {/* Eje de fechas compartido — se dibuja una sola vez arriba de todo
              (no por sección) porque es la misma escala para toda la
              pantalla; cada sección solo alinea sus barras contra estas
              mismas marcas. */}
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="grid grid-cols-[220px_1fr]">
              <div />
              <div className="relative h-6 text-xs text-gray-400 border-l border-gray-100">
                {marcas.map((dia) => (
                  <span
                    key={dia}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${((dia - minDia) / rango) * 100}%` }}
                  >
                    {formatearFechaCorta(dia)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {seccionesOrdenadas.map((seccion) => {
            const abierta = !colapsadas[seccion.id];
            const alturaTotal = Math.max(seccion.proyectos.length, 1) * ROW_ALTO;
            return (
              <div key={seccion.id} className="bg-white rounded-2xl shadow-card p-6">
                <button
                  type="button"
                  onClick={() => toggleSeccion(seccion.id)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: seccion.color }}
                    />
                    <h2 className="font-display font-bold text-base text-primary-900">
                      {seccion.nombre}
                    </h2>
                    <span className="text-xs text-gray-400 font-semibold">
                      {seccion.proyectos.length} proyecto{seccion.proyectos.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="text-primary-400 text-sm">{abierta ? '▾' : '▸'}</span>
                </button>

                {abierta && (
                  <div className="mt-4 overflow-x-auto">
                    <div className="grid grid-cols-[220px_1fr] min-w-[640px]">
                      <div>
                        {seccion.proyectos.map((p) => (
                          <div
                            key={p.id}
                            style={{ height: ROW_ALTO }}
                            className="flex items-center text-sm font-semibold text-primary-800 pr-3 truncate cursor-pointer hover:text-primary-600"
                            title={p.nombre}
                            onClick={() => navigate(`/proyectos/${p.id}`)}
                          >
                            {p.nombre}
                          </div>
                        ))}
                      </div>

                      <div className="relative border-l border-gray-100">
                        <svg
                          viewBox={`0 0 ${VIEWBOX_ANCHO} ${alturaTotal}`}
                          preserveAspectRatio="none"
                          style={{ width: '100%', height: alturaTotal, display: 'block' }}
                        >
                          {marcas.map((dia) => (
                            <line
                              key={dia}
                              x1={((dia - minDia) / rango) * VIEWBOX_ANCHO}
                              x2={((dia - minDia) / rango) * VIEWBOX_ANCHO}
                              y1={0}
                              y2={alturaTotal}
                              stroke="#F3ECFB"
                              strokeWidth={1}
                            />
                          ))}

                          {hoyEnRango && (
                            <line
                              x1={xHoy}
                              x2={xHoy}
                              y1={0}
                              y2={alturaTotal}
                              stroke="#E8384F"
                              strokeWidth={1.5}
                              strokeDasharray="3 3"
                            />
                          )}

                          {seccion.proyectos.map((p, i) => {
                            const y = i * ROW_ALTO + ROW_ALTO / 2;
                            const alturaBarra = ROW_ALTO * 0.55;
                            const x0 = xDe(p.fechaInicio);
                            const x1 = xDe(p.fechaFin);
                            return (
                              <rect
                                key={p.id}
                                x={x0}
                                y={y - alturaBarra / 2}
                                width={Math.max(x1 - x0, 6)}
                                height={alturaBarra}
                                rx={4}
                                fill={COLOR_ESTATUS[p.estatus] ?? '#7E3FF2'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => navigate(`/proyectos/${p.id}`)}
                              >
                                <title>
                                  {p.nombre} · {ESTATUS_LABEL[p.estatus] ?? p.estatus} ·{' '}
                                  {p.fechaInicio} → {p.fechaFin}
                                </title>
                              </rect>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {Object.entries({
              no_iniciada: COLOR_ESTATUS.no_iniciada,
              en_progreso: COLOR_ESTATUS.en_progreso,
              completada: COLOR_ESTATUS.completada,
              bloqueada: COLOR_ESTATUS.bloqueada,
            }).map(([clave, color]) => (
              <span key={clave} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {ESTATUS_LABEL[clave] ?? clave}
              </span>
            ))}
            {hoyEnRango && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-danger-500" />
                Hoy
              </span>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
