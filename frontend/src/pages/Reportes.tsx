import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { reportesApi, ResumenDireccion, TendenciaMes } from '../lib/api';

// Reportes / dashboard ejecutivo con tendencias (cuarta ronda de mejoras):
// a diferencia de "Inicio" (foto del momento), esta pantalla está pensada
// para dirección revisando avance mes contra mes — % de cumplimiento por
// Dirección, tiempo promedio de finalización, y cuántas automatizaciones se
// dispararon. Gráfica hecha a mano con divs (sin librería nueva, mismo
// criterio que el Gantt — ver Gantt.tsx) para no agregar una dependencia
// pesada solo para un par de barras.
const OPCIONES_MESES = [3, 6, 12, 24];

function MesLabel(mes: string): string {
  const [anio, m] = mes.split('-').map((v) => parseInt(v, 10));
  const fecha = new Date(anio, m - 1, 1);
  return fecha.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
}

export default function Reportes() {
  const [resumen, setResumen] = useState<ResumenDireccion[] | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaMes[] | null>(null);
  const [meses, setMeses] = useState(6);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([reportesApi.resumen(), reportesApi.tendencia(meses)])
      .then(([r, t]) => {
        setResumen(r);
        setTendencia(t);
      })
      .catch(() => setError('No se pudo cargar la información de reportes.'))
      .finally(() => setCargando(false));
  }, [meses]);

  // "Suficiente actividad" = al menos una Dirección con tareas, o algo de
  // movimiento en la serie mensual — si no, mostrar la gráfica en ceros no
  // ayuda a nadie y solo confunde.
  const sinActividad =
    (resumen?.every((r) => r.totalTareas === 0) ?? true) &&
    (tendencia?.every((t) => t.tareasCreadas === 0 && t.tareasCompletadas === 0 && t.automatizacionesActivadas === 0) ?? true);

  const maxTareasMes = Math.max(1, ...(tendencia ?? []).flatMap((t) => [t.tareasCreadas, t.tareasCompletadas]));
  const maxAutomatizaciones = Math.max(1, ...(tendencia ?? []).map((t) => t.automatizacionesActivadas));

  return (
    <Layout activo="reportes">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-primary-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Dashboard ejecutivo con tendencias: cumplimiento por Dirección y avance mes contra mes.
          </p>
        </div>
        <label className="text-sm text-gray-500 flex items-center gap-2">
          Periodo
          <select
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-primary-800 font-semibold"
          >
            {OPCIONES_MESES.map((m) => (
              <option key={m} value={m}>
                Últimos {m} meses
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando ? (
        <p className="text-gray-500 text-sm">Cargando…</p>
      ) : error ? (
        <p className="text-danger-500 text-sm">{error}</p>
      ) : sinActividad ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center text-gray-400">
          Todavía no hay suficiente actividad para mostrar tendencias.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cumplimiento por Dirección */}
          <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-primary-50 text-primary-800 text-left">
                <tr>
                  <th className="px-5 py-3 font-bold">Dirección</th>
                  <th className="px-5 py-3 font-bold">Proyectos</th>
                  <th className="px-5 py-3 font-bold">% Cumplimiento</th>
                  <th className="px-5 py-3 font-bold">Vencidas</th>
                  <th className="px-5 py-3 font-bold">Tiempo prom. finalización</th>
                </tr>
              </thead>
              <tbody>
                {(resumen ?? []).map((r) => (
                  <tr key={r.direccionId} className="border-t border-gray-100 align-top">
                    <td className="px-5 py-3 font-semibold text-primary-800">{r.direccionNombre}</td>
                    <td className="px-5 py-3 text-gray-500">{r.totalProyectos}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary-800 w-10 text-right">{r.porcentajeCumplimiento}%</span>
                        <div className="w-32 h-1.5 bg-gray-100 rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${r.porcentajeCumplimiento >= 70 ? 'bg-primary-500' : r.porcentajeCumplimiento >= 40 ? 'bg-accent-500' : 'bg-danger-500'}`}
                            style={{ width: `${r.porcentajeCumplimiento}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs">
                          ({r.tareasCompletadas}/{r.totalTareas})
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {r.tareasVencidas > 0 ? (
                        <span className="text-xs font-bold uppercase text-danger-500 bg-danger-500/10 px-2 py-0.5 rounded-full">
                          {r.tareasVencidas} vencida{r.tareasVencidas === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {r.tiempoPromedioFinalizacionDias !== null ? (
                        <>{r.tiempoPromedioFinalizacionDias} día{r.tiempoPromedioFinalizacionDias === 1 ? '' : 's'}</>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tendencia mensual: tareas creadas vs. completadas */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-primary-900">Tareas creadas vs. completadas</h2>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-primary-300 inline-block" /> Creadas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-primary-700 inline-block" /> Completadas
                </span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-40 overflow-x-auto pb-1">
              {(tendencia ?? []).map((t) => (
                <div key={t.mes} className="flex flex-col items-center gap-1 shrink-0 w-14">
                  <div className="flex items-end gap-1 h-32">
                    <div
                      className="w-5 bg-primary-300 rounded-t"
                      style={{ height: `${(t.tareasCreadas / maxTareasMes) * 100}%` }}
                      title={`${t.tareasCreadas} creadas`}
                    />
                    <div
                      className="w-5 bg-primary-700 rounded-t"
                      style={{ height: `${(t.tareasCompletadas / maxTareasMes) * 100}%` }}
                      title={`${t.tareasCompletadas} completadas`}
                    />
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{MesLabel(t.mes)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Automatizaciones activadas por mes */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-primary-900 mb-4">Automatizaciones activadas</h2>
            <div className="flex items-end gap-3 h-24 overflow-x-auto pb-1">
              {(tendencia ?? []).map((t) => (
                <div key={t.mes} className="flex flex-col items-center gap-1 shrink-0 w-14">
                  <div className="flex items-end h-16">
                    <div
                      className="w-8 bg-accent-500 rounded-t"
                      style={{ height: `${(t.automatizacionesActivadas / maxAutomatizaciones) * 100}%` }}
                      title={`${t.automatizacionesActivadas} automatizaciones`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-primary-800">{t.automatizacionesActivadas}</span>
                  <span className="text-xs text-gray-400 capitalize">{MesLabel(t.mes)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
