import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { getUsuario, proyectosApi, tareasApi, usuariosApi, Proyecto, Tarea } from '../lib/api';

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

type FormTarea = {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  presupuesto: string;
  responsableId: string;
  usuarioIds: number[];
  dependenciaId: string;
};

const FORM_VACIO: FormTarea = {
  nombre: '',
  fechaInicio: '',
  fechaFin: '',
  presupuesto: '',
  responsableId: '',
  usuarioIds: [],
  dependenciaId: '',
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

  function cargarTodo() {
    setLoading(true);
    Promise.all([proyectosApi.obtener(proyectoId), tareasApi.listarDeProyecto(proyectoId)])
      .then(([p, t]) => {
        setProyecto(p);
        setTareas(t);
      })
      .catch(() => setError('No se pudo cargar el proyecto (puede estar fuera de tu alcance).'))
      .finally(() => setLoading(false));
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
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-primary-900">{proyecto.nombre}</h1>
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
        </div>
        <div className="flex gap-2">
          {puedeGestionar && (
            <button
              onClick={abrirNueva}
              className="bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg px-4 py-2 text-sm"
            >
              + Nueva tarea
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
      {'presupuesto' in proyecto && (
        <p className="text-sm font-semibold text-primary-700 mb-6">
          Presupuesto: ${Number(proyecto.presupuesto).toLocaleString('es-MX')}
        </p>
      )}
      {!('presupuesto' in proyecto) && <div className="mb-6" />}

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

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary-50 text-primary-800 text-left">
            <tr>
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
              <tr key={t.id} className="border-t border-gray-100 align-top">
                <td className="px-5 py-3 font-semibold text-primary-800">{t.nombre}</td>
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
            ))}
            {tareas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  Este proyecto todavía no tiene tareas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
