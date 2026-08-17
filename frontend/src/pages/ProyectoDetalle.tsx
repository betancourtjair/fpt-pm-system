import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PanelArchivos from '../components/PanelArchivos';
import PanelComentarios from '../components/PanelComentarios';
import KanbanTareas from '../components/KanbanTareas';
import CalendarioTareas from '../components/CalendarioTareas';
import {
  descargarBlob,
  getUsuario,
  proyectosApi,
  tareasApi,
  usuariosApi,
  Gasto,
  Proyecto,
  Tarea,
} from '../lib/api';

const ESTATUS_TAREA = ['no_iniciada', 'en_progreso', 'completada', 'bloqueada'];
const ESTATUS_LABEL: Record<string, string> = {
  no_iniciado: 'No iniciado',
  en_progreso: 'En progreso',
  completado: 'Completado',
  completada: 'Completada',
  bloqueado: 'Bloqueado',
  bloqueada: 'Bloqueada',
  no_iniciada: 'No iniciada',
};

// Prioridad (mejora sugerida, ver README sección 4) — ayuda a un
// responsable con muchas tareas a saber cuál atacar primero.
const PRIORIDAD_LABEL: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PRIORIDAD_CLASE: Record<string, string> = {
  alta: 'bg-danger-500/10 text-danger-600',
  media: 'bg-accent-500/15 text-accent-700',
  baja: 'bg-gray-100 text-gray-500',
};

type FormTarea = {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  presupuesto: string;
  responsableId: string;
  usuarioIds: number[];
  dependenciaId: string;
  prioridad: string;
};

const FORM_VACIO: FormTarea = {
  nombre: '',
  fechaInicio: '',
  fechaFin: '',
  presupuesto: '',
  responsableId: '',
  usuarioIds: [],
  dependenciaId: '',
  prioridad: 'media',
};

// Detalle de un proyecto: tareas, dependencias, asignaciones y el flujo de
// avance de autoservicio para colaboradores asignados (PID sección 9.2).
export default function ProyectoDetalle() {
  const { id } = useParams();
  const proyectoId = Number(id);
  const navigate = useNavigate();
  const usuario = getUsuario();
  const puedeGestionar = Boolean(usuario?.permisos?.manage_projects);
  const esAdmin = usuario?.rol === 'admin';

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<'ninguno' | 'nueva' | number>('ninguno');
  const [form, setForm] = useState<FormTarea>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [avanceEditando, setAvanceEditando] = useState<number | null>(null);
  const [avanceEstatus, setAvanceEstatus] = useState('');
  const [avancePorcentaje, setAvancePorcentaje] = useState(0);

  // Presupuesto real vs. plan (prioridad 8) — bitácora de gastos reales,
  // visible solo para quien ya puede ver `presupuesto` (misma regla que el
  // backend aplica en ProyectosService.verificarPuedeVerPresupuesto).
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoFecha, setGastoFecha] = useState('');
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [errorGasto, setErrorGasto] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);

  // Plantillas de proyecto (mejora sugerida) — clonar este proyecto con
  // todas sus tareas sobre una nueva fecha de inicio.
  const [mostrarClonar, setMostrarClonar] = useState(false);
  const [clonarNombre, setClonarNombre] = useState('');
  const [clonarFechaInicio, setClonarFechaInicio] = useState('');
  const [clonando, setClonando] = useState(false);
  const [errorClonar, setErrorClonar] = useState<string | null>(null);

  // Adjuntar archivos a una tarea (prioridad 11) — panel expandible bajo la
  // fila de la tarea, una a la vez, para no saturar la tabla por default.
  const [tareaArchivosAbierta, setTareaArchivosAbierta] = useState<number | null>(null);

  // Comentarios por tarea (mejora sugerida) — mismo patrón de panel
  // expandible que los archivos, una tarea a la vez.
  const [tareaComentariosAbierta, setTareaComentariosAbierta] = useState<number | null>(null);

  // Tablero Kanban (mejora sugerida) — vista alterna a la tabla, ambas leen
  // del mismo estado `tareas`.
  const [vista, setVista] = useState<'tabla' | 'kanban' | 'calendario'>('tabla');
  const [errorKanban, setErrorKanban] = useState<string | null>(null);

  async function cambiarEstatusDesdeKanban(t: Tarea, nuevoEstatus: string) {
    setErrorKanban(null);
    try {
      if (puedeGestionar) {
        await tareasApi.actualizar(t.id, { estatus: nuevoEstatus });
      } else {
        await tareasApi.actualizarAvance(t.id, { estatus: nuevoEstatus });
      }
      cargarTodo();
    } catch (err: any) {
      setErrorKanban(err?.response?.data?.message || 'No se pudo actualizar el estatus de la tarea.');
    }
  }

  // Reasignación masiva de responsable (prioridad 11, segunda mitad) — solo
  // quien puede administrar el proyecto ve la columna de selección.
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [nuevoResponsableId, setNuevoResponsableId] = useState('');
  const [reasignando, setReasignando] = useState(false);
  const [errorReasignar, setErrorReasignar] = useState<string | null>(null);

  async function exportarExcel() {
    setExportando(true);
    setErrorExportar(null);
    try {
      const blob = await tareasApi.exportarExcel(proyectoId);
      descargarBlob(blob, `Tareas_${proyecto?.nombre ?? proyectoId}.xlsx`);
    } catch {
      setErrorExportar('No se pudo generar el archivo de Excel.');
    } finally {
      setExportando(false);
    }
  }

  function cargarTodo() {
    setLoading(true);
    Promise.all([proyectosApi.obtener(proyectoId), tareasApi.listarDeProyecto(proyectoId)])
      .then(([p, t]) => {
        setProyecto(p);
        setTareas(t);
        // Descarta de la selección cualquier tarea que ya no exista (borrada
        // por otra pestaña/usuario) para no mandar un id fantasma al reasignar.
        const idsVigentes = new Set(t.map((x) => x.id));
        setSeleccionadas((prev) => prev.filter((id) => idsVigentes.has(id)));
        if ('presupuesto' in p) {
          proyectosApi.gastos(proyectoId).then(setGastos).catch(() => {});
        }
      })
      .catch(() => setError('No se pudo cargar el proyecto (puede estar fuera de tu alcance).'))
      .finally(() => setLoading(false));
  }

  async function agregarGasto(e: FormEvent) {
    e.preventDefault();
    setErrorGasto(null);
    setGuardandoGasto(true);
    try {
      const actualizados = await proyectosApi.crearGasto(proyectoId, {
        concepto: gastoConcepto,
        monto: Number(gastoMonto),
        fecha: gastoFecha,
      });
      setGastos(actualizados);
      setGastoConcepto('');
      setGastoMonto('');
      setGastoFecha('');
      setMostrarFormGasto(false);
      // El total (proyecto.gastoTotal) vive en el objeto proyecto — hay que
      // refrescarlo para que la barra de comparación quede al día.
      proyectosApi.obtener(proyectoId).then(setProyecto).catch(() => {});
    } catch (err: any) {
      setErrorGasto(err?.response?.data?.message || 'No se pudo registrar el gasto.');
    } finally {
      setGuardandoGasto(false);
    }
  }

  async function eliminarGasto(g: Gasto) {
    if (!confirm(`¿Eliminar el gasto "${g.concepto}"?`)) return;
    const actualizados = await proyectosApi.eliminarGasto(proyectoId, g.id);
    setGastos(actualizados);
    proyectosApi.obtener(proyectoId).then(setProyecto).catch(() => {});
  }

  useEffect(() => {
    cargarTodo();
    // Un usuario con rol admin (como cualquier otro) sí puede quedar como
    // responsable o colaborador de un proyecto/tarea real — admin no deja
    // de ser una persona del equipo solo por tener ese rol. Este selector
    // solo muestra el nombre (nunca el rol), así que no hace falta filtrar
    // nada aquí para que el rol admin quede "invisible" en este flujo.
    if (puedeGestionar) usuariosApi.listar().then(setUsuarios).catch(() => {});
    // Refresco automático cada 2 minutos — mismo intervalo usado en el
    // Gantt (PID sección 7.3), para que el avance de tareas se vea al día
    // sin que el usuario tenga que recargar la página manualmente.
    const intervalo = setInterval(cargarTodo, 2 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [proyectoId]);

  function esAsignado(t: Tarea) {
    return t.responsable?.id === usuario?.id || t.usuariosAsignados.some((u) => u.id === usuario?.id);
  }

  function abrirNueva() {
    setForm(FORM_VACIO);
    setModo('nueva');
    setErrorForm(null);
  }

  function abrirEdicion(t: Tarea) {
    setForm({
      nombre: t.nombre,
      fechaInicio: t.fechaInicio,
      fechaFin: t.fechaFin,
      presupuesto: t.presupuesto !== undefined ? String(t.presupuesto) : '',
      responsableId: t.responsable ? String(t.responsable.id) : '',
      usuarioIds: t.usuariosAsignados.map((u) => u.id),
      dependenciaId: t.dependenciaId ? String(t.dependenciaId) : '',
      prioridad: t.prioridad ?? 'media',
    });
    setModo(t.id);
    setErrorForm(null);
  }

  function toggleUsuario(uid: number) {
    setForm((f) => ({
      ...f,
      usuarioIds: f.usuarioIds.includes(uid) ? f.usuarioIds.filter((x) => x !== uid) : [...f.usuarioIds, uid],
    }));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    setGuardando(true);
    const dto: Record<string, unknown> = {
      nombre: form.nombre,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      responsableId: Number(form.responsableId),
      usuarioIds: form.usuarioIds,
      prioridad: form.prioridad,
    };
    if (form.presupuesto !== '') dto.presupuesto = Number(form.presupuesto);
    if (form.dependenciaId !== '') dto.dependenciaId = Number(form.dependenciaId);
    try {
      if (modo === 'nueva') {
        await tareasApi.crear(proyectoId, dto);
      } else if (typeof modo === 'number') {
        await tareasApi.actualizar(modo, dto);
      }
      setModo('ninguno');
      cargarTodo();
    } catch (err: any) {
      setErrorForm(err?.response?.data?.message || 'No se pudo guardar la tarea.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarTarea(t: Tarea) {
    if (!confirm(`¿Eliminar la tarea "${t.nombre}"? Esta acción no se puede deshacer.`)) return;
    await tareasApi.eliminar(t.id);
    cargarTodo();
  }

  async function eliminarProyecto() {
    if (!proyecto) return;
    if (!confirm(`¿Eliminar el proyecto "${proyecto.nombre}" y todas sus tareas? Esta acción no se puede deshacer.`)) return;
    await proyectosApi.eliminar(proyecto.id);
    navigate('/proyectos');
  }

  function abrirClonar() {
    setClonarNombre(proyecto ? `${proyecto.nombre} (copia)` : '');
    setClonarFechaInicio('');
    setErrorClonar(null);
    setMostrarClonar(true);
  }

  async function clonarProyecto(e: FormEvent) {
    e.preventDefault();
    setErrorClonar(null);
    setClonando(true);
    try {
      const nuevo = await proyectosApi.clonar(proyectoId, {
        nombre: clonarNombre,
        fechaInicio: clonarFechaInicio,
      });
      navigate(`/proyectos/${nuevo.id}`);
    } catch (err: any) {
      setErrorClonar(err?.response?.data?.message || 'No se pudo clonar el proyecto.');
    } finally {
      setClonando(false);
    }
  }

  function abrirAvance(t: Tarea) {
    setAvanceEditando(t.id);
    setAvanceEstatus(t.estatus);
    setAvancePorcentaje(t.porcentajeAvance);
  }

  async function guardarAvance(t: Tarea) {
    await tareasApi.actualizarAvance(t.id, { estatus: avanceEstatus, porcentajeAvance: avancePorcentaje });
    setAvanceEditando(null);
    cargarTodo();
  }

  const tareasParaDependencia = useMemo(
    () => tareas.filter((t) => (typeof modo === 'number' ? t.id !== modo : true)),
    [tareas, modo],
  );

  // La columna de checkboxes solo existe cuando puedeGestionar — el colSpan
  // de las filas "de ancho completo" (panel de archivos, tabla vacía) debe
  // seguirla para no dejar una columna huérfana sin cubrir.
  const numColumnas = puedeGestionar ? 8 : 7;

  function toggleSeleccion(tareaId: number) {
    setSeleccionadas((prev) =>
      prev.includes(tareaId) ? prev.filter((id) => id !== tareaId) : [...prev, tareaId],
    );
  }

  function toggleSeleccionarTodas() {
    setSeleccionadas((prev) => (prev.length === tareas.length ? [] : tareas.map((t) => t.id)));
  }

  async function reasignarSeleccionadas() {
    if (!nuevoResponsableId || seleccionadas.length === 0) return;
    setErrorReasignar(null);
    setReasignando(true);
    try {
      await tareasApi.reasignarMasivo(proyectoId, seleccionadas, Number(nuevoResponsableId));
      setSeleccionadas([]);
      setNuevoResponsableId('');
      cargarTodo();
    } catch (err: any) {
      setErrorReasignar(err?.response?.data?.message || 'No se pudo reasignar las tareas seleccionadas.');
    } finally {
      setReasignando(false);
    }
  }

  if (loading) {
    return (
      <Layout activo="proyectos">
        <p className="text-gray-500 text-sm">Cargando…</p>
      </Layout>
    );
  }

  if (error || !proyecto) {
    return (
      <Layout activo="proyectos">
        <p className="text-danger-500 text-sm">{error ?? 'Proyecto no encontrado.'}</p>
      </Layout>
    );
  }

  return (
    <Layout activo="proyectos">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-2xl text-primary-900 break-words">{proyecto.nombre}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {proyecto.areas.map((a) => (
              <span
                key={a.id}
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: a.color }}
              >
                {a.nombre}
              </span>
            ))}
          </div>
          <p className="text-gray-500 text-sm mt-1.5">
            {proyecto.fechaInicio} → {proyecto.fechaFin} · Responsable: {proyecto.responsable?.nombre ?? '—'}
          </p>
          {errorExportar && <p className="text-danger-500 text-xs font-medium mt-1">{errorExportar}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportarExcel}
            disabled={exportando}
            className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
          >
            {exportando ? 'Generando…' : '⬇ Exportar tareas'}
          </button>
          {puedeGestionar && (
            <button
              onClick={abrirNueva}
              className="bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg px-4 py-2 text-sm"
            >
              + Nueva tarea
            </button>
          )}
          {puedeGestionar && (
            <button
              onClick={abrirClonar}
              className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-bold rounded-lg px-4 py-2 text-sm"
            >
              ⧉ Duplicar como plantilla
            </button>
          )}
          {esAdmin && (
            <button
              onClick={eliminarProyecto}
              className="border border-danger-500 text-danger-500 font-bold rounded-lg px-4 py-2 text-sm hover:bg-danger-500/5"
            >
              Eliminar proyecto
            </button>
          )}
        </div>
      </div>

      {mostrarClonar && (
        <form onSubmit={clonarProyecto} className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="font-display font-bold text-base">Duplicar "{proyecto.nombre}" como plantilla</h2>
          <p className="text-xs text-gray-500">
            Se copian todas sus tareas (fechas, dependencias, prioridad y asignaciones) desplazadas a la
            nueva fecha de inicio, manteniendo la misma duración relativa. El estatus y el avance de cada
            tarea empiezan de cero.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del nuevo proyecto</label>
              <input
                required
                minLength={3}
                value={clonarNombre}
                onChange={(e) => setClonarNombre(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nueva fecha de inicio</label>
              <input
                type="date"
                required
                value={clonarFechaInicio}
                onChange={(e) => setClonarFechaInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          {errorClonar && <p className="text-danger-500 text-sm font-medium">{errorClonar}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={clonando}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
            >
              {clonando ? 'Duplicando…' : 'Duplicar proyecto'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarClonar(false)}
              className="text-gray-600 font-semibold text-sm px-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {'presupuesto' in proyecto ? (
        <div className="bg-white rounded-2xl shadow-card p-5 mb-6">
          {(() => {
            const plan = Number(proyecto.presupuesto);
            const real = Number(proyecto.gastoTotal ?? 0);
            const porcentaje = plan > 0 ? Math.min(100, Math.round((real / plan) * 100)) : 0;
            const excedido = real > plan;
            return (
              <>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h2 className="font-display font-bold text-base text-primary-900">
                    Presupuesto vs. gasto real
                  </h2>
                  {puedeGestionar && (
                    <button
                      onClick={() => setMostrarFormGasto((v) => !v)}
                      className="text-sm font-bold text-primary-600 hover:text-primary-800"
                    >
                      {mostrarFormGasto ? 'Cancelar' : '+ Registrar gasto'}
                    </button>
                  )}
                </div>
                <div className="flex items-baseline gap-3 text-sm mb-1.5">
                  <span className="font-semibold text-gray-700">
                    Gastado: ${real.toLocaleString('es-MX')}
                  </span>
                  <span className="text-gray-400">de ${plan.toLocaleString('es-MX')} planeado</span>
                  {excedido && (
                    <span className="text-xs font-bold uppercase text-danger-500 bg-danger-500/10 px-2 py-0.5 rounded-full">
                      Presupuesto excedido
                    </span>
                  )}
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full ${excedido ? 'bg-danger-500' : 'bg-accent-500'}`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>

                {mostrarFormGasto && (
                  <form onSubmit={agregarGasto} className="grid grid-cols-3 gap-3 mt-4 items-end">
                    <div className="col-span-3 sm:col-span-1">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Concepto</label>
                      <input
                        required
                        minLength={3}
                        value={gastoConcepto}
                        onChange={(e) => setGastoConcepto(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Monto (MXN)</label>
                      <input
                        type="number"
                        required
                        min={0.01}
                        step="0.01"
                        value={gastoMonto}
                        onChange={(e) => setGastoMonto(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha</label>
                      <input
                        type="date"
                        required
                        value={gastoFecha}
                        onChange={(e) => setGastoFecha(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      {errorGasto && (
                        <p className="text-danger-500 text-xs font-medium mb-2">{errorGasto}</p>
                      )}
                      <button
                        type="submit"
                        disabled={guardandoGasto}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                      >
                        {guardandoGasto ? 'Guardando…' : 'Guardar gasto'}
                      </button>
                    </div>
                  </form>
                )}

                {gastos.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {gastos.map((g) => (
                          <tr key={g.id} className="border-t border-gray-50 first:border-t-0">
                            <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{g.fecha}</td>
                            <td className="py-1.5 pr-3 text-gray-700">{g.concepto}</td>
                            <td className="py-1.5 pr-3 font-semibold text-gray-800 whitespace-nowrap">
                              ${g.monto.toLocaleString('es-MX')}
                            </td>
                            <td className="py-1.5 text-gray-400">{g.creador?.nombre ?? '—'}</td>
                            {puedeGestionar && (
                              <td className="py-1.5 text-right">
                                <button
                                  onClick={() => eliminarGasto(g)}
                                  className="text-danger-500 font-bold hover:underline"
                                >
                                  Eliminar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="mb-6" />
      )}

      <div className="bg-white rounded-2xl shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-base text-primary-900 mb-3">Archivos del proyecto</h2>
        <PanelArchivos dueño={{ proyectoId }} puedeGestionar={puedeGestionar} />
      </div>

      {(modo === 'nueva' || typeof modo === 'number') && (
        <form onSubmit={guardar} className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="font-display font-bold text-base">
            {modo === 'nueva' ? 'Nueva tarea' : 'Editar tarea'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
              <input
                required
                minLength={3}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                required
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de fin</label>
              <input
                type="date"
                required
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Presupuesto (opcional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.presupuesto}
                onChange={(e) => setForm({ ...form, presupuesto: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable</label>
              <select
                required
                value={form.responsableId}
                onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Selecciona…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Prioridad</label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                {Object.entries(PRIORIDAD_LABEL).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Depende de (opcional)
              </label>
              <select
                value={form.dependenciaId}
                onChange={(e) => setForm({ ...form, dependenciaId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Sin dependencia</option>
                {tareasParaDependencia.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Usuarios asignados</label>
              <div className="flex flex-wrap gap-2">
                {usuarios.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleUsuario(u.id)}
                    className={`text-sm px-3 py-1.5 rounded-full border ${
                      form.usuarioIds.includes(u.id)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {u.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {errorForm && <p className="text-danger-500 text-sm font-medium">{errorForm}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setModo('ninguno')}
              className="text-gray-600 font-semibold text-sm px-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {puedeGestionar && seleccionadas.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-primary-800">
            {seleccionadas.length} {seleccionadas.length === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}
          </span>
          <select
            value={nuevoResponsableId}
            onChange={(e) => setNuevoResponsableId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Reasignar a…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
          <button
            onClick={reasignarSeleccionadas}
            disabled={!nuevoResponsableId || reasignando}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-4 py-1.5 text-sm disabled:opacity-60"
          >
            {reasignando ? 'Reasignando…' : 'Reasignar'}
          </button>
          <button
            onClick={() => setSeleccionadas([])}
            className="text-gray-500 text-sm font-semibold hover:underline"
          >
            Cancelar selección
          </button>
          {errorReasignar && <p className="text-danger-500 text-xs font-medium w-full">{errorReasignar}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setVista('tabla')}
          className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
            vista === 'tabla' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          Tabla
        </button>
        <button
          onClick={() => setVista('kanban')}
          className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
            vista === 'kanban' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          Tablero
        </button>
        <button
          onClick={() => setVista('calendario')}
          className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
            vista === 'calendario' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          Calendario
        </button>
      </div>

      {vista === 'kanban' ? (
        <div className="mb-6">
          {errorKanban && <p className="text-danger-500 text-xs font-medium mb-2">{errorKanban}</p>}
          <KanbanTareas
            tareas={tareas}
            puedeArrastrar={(t) => puedeGestionar || esAsignado(t)}
            onCambiarEstatus={cambiarEstatusDesdeKanban}
          />
        </div>
      ) : vista === 'calendario' ? (
        <div className="mb-6">
          <CalendarioTareas tareas={tareas} />
        </div>
      ) : (
      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-primary-50 text-primary-800 text-left">
            <tr>
              {puedeGestionar && (
                <th className="px-5 py-3 font-bold w-8">
                  <input
                    type="checkbox"
                    checked={tareas.length > 0 && seleccionadas.length === tareas.length}
                    onChange={toggleSeleccionarTodas}
                  />
                </th>
              )}
              <th className="px-5 py-3 font-bold">Tarea</th>
              <th className="px-5 py-3 font-bold">Fechas</th>
              <th className="px-5 py-3 font-bold">Responsable</th>
              <th className="px-5 py-3 font-bold">Asignados</th>
              <th className="px-5 py-3 font-bold">Depende de</th>
              <th className="px-5 py-3 font-bold">Estatus / avance</th>
              <th className="px-5 py-3 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tareas.map((t) => (
              <Fragment key={t.id}>
                <tr className="border-t border-gray-100 align-top">
                  {puedeGestionar && (
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionadas.includes(t.id)}
                        onChange={() => toggleSeleccion(t.id)}
                      />
                    </td>
                  )}
                  <td className="px-5 py-3 font-semibold text-primary-800">
                    <div className="flex items-center gap-2">
                      <span>{t.nombre}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                          PRIORIDAD_CLASE[t.prioridad] ?? PRIORIDAD_CLASE.media
                        }`}
                      >
                        {PRIORIDAD_LABEL[t.prioridad] ?? 'Media'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {t.fechaInicio} → {t.fechaFin}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{t.responsable?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {t.usuariosAsignados.map((u) => u.nombre).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{t.dependencia?.nombre ?? '—'}</td>
                  <td className="px-5 py-3">
                    {avanceEditando === t.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={avanceEstatus}
                          onChange={(e) => setAvanceEstatus(e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        >
                          {ESTATUS_TAREA.map((s) => (
                            <option key={s} value={s}>
                              {ESTATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={avancePorcentaje}
                          onChange={(e) => setAvancePorcentaje(Number(e.target.value))}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => guardarAvance(t)}
                          className="text-primary-700 font-bold text-xs hover:underline"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setAvanceEditando(null)}
                          className="text-gray-400 text-xs hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-bold uppercase text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                          {ESTATUS_LABEL[t.estatus] ?? t.estatus}
                        </span>
                        <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5">
                          <div
                            className="h-1.5 bg-accent-500 rounded-full"
                            style={{ width: `${t.porcentajeAvance}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-3">
                      {(puedeGestionar || esAsignado(t)) && avanceEditando !== t.id && (
                        <button
                          onClick={() => abrirAvance(t)}
                          className="text-primary-700 text-xs font-bold hover:underline"
                        >
                          Avance
                        </button>
                      )}
                      <button
                        onClick={() => setTareaArchivosAbierta((v) => (v === t.id ? null : t.id))}
                        className="text-gray-600 text-xs font-bold hover:underline"
                      >
                        {tareaArchivosAbierta === t.id ? 'Ocultar archivos' : 'Archivos'}
                      </button>
                      <button
                        onClick={() => setTareaComentariosAbierta((v) => (v === t.id ? null : t.id))}
                        className="text-gray-600 text-xs font-bold hover:underline"
                      >
                        {tareaComentariosAbierta === t.id ? 'Ocultar comentarios' : 'Comentarios'}
                      </button>
                      {puedeGestionar && (
                        <>
                          <button
                            onClick={() => abrirEdicion(t)}
                            className="text-gray-600 text-xs font-bold hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarTarea(t)}
                            className="text-danger-500 text-xs font-bold hover:underline"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {tareaArchivosAbierta === t.id && (
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td colSpan={numColumnas} className="px-5 py-3">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                        Archivos de "{t.nombre}"
                      </p>
                      <PanelArchivos dueño={{ tareaId: t.id }} puedeGestionar={puedeGestionar} />
                    </td>
                  </tr>
                )}
                {tareaComentariosAbierta === t.id && (
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td colSpan={numColumnas} className="px-5 py-3">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                        Comentarios de "{t.nombre}"
                      </p>
                      <PanelComentarios tareaId={t.id} puedeGestionar={puedeGestionar} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {tareas.length === 0 && (
              <tr>
                <td colSpan={numColumnas} className="px-5 py-8 text-center text-gray-400">
                  Este proyecto todavía no tiene tareas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </Layout>
  );
}
