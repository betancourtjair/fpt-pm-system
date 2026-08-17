import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  catalogoApi,
  descargarBlob,
  getUsuario,
  proyectosApi,
  usuariosApi,
  vistasGuardadasApi,
  Direccion,
  Proyecto,
  VistaGuardada,
} from '../lib/api';

const ESTATUS_LABEL: Record<string, string> = {
  no_iniciado: 'No iniciado',
  en_progreso: 'En progreso',
  completado: 'Completado',
  bloqueado: 'Bloqueado',
};

// Módulo de Proyectos — Fase 1 (PID sección 7). El backend ya filtra por
// alcance de rol y oculta el presupuesto cuando no corresponde; esta
// pantalla solo decide qué controles mostrar (crear/editar/eliminar).
export default function Proyectos() {
  const usuario = getUsuario();
  const navigate = useNavigate();
  const puedeCrear = Boolean(usuario?.permisos?.manage_projects);

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [areaIds, setAreaIds] = useState<number[]>([]);
  const [exportando, setExportando] = useState(false);

  async function exportarExcel() {
    setExportando(true);
    try {
      const blob = await proyectosApi.exportarExcel();
      descargarBlob(blob, 'Proyectos_FPT.xlsx');
    } catch {
      setError('No se pudo generar el archivo de Excel.');
    } finally {
      setExportando(false);
    }
  }

  // Búsqueda y filtros (mejora funcional: prioridad 7) — todo client-side,
  // el volumen de proyectos de una organización de este tamaño no justifica
  // paginar/filtrar en el backend todavía.
  const [busqueda, setBusqueda] = useState('');
  const [filtroDireccionId, setFiltroDireccionId] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  // Vistas guardadas (mejora funcional): la combinación de los 3 filtros de
  // arriba se puede nombrar y recuperar después — se guarda tal cual como
  // `filtros` para que aplicarla sea simplemente leer las 3 llaves de vuelta.
  const [vistasGuardadas, setVistasGuardadas] = useState<VistaGuardada[]>([]);
  const [vistaSeleccionadaId, setVistaSeleccionadaId] = useState('');

  function cargarVistas() {
    vistasGuardadasApi
      .listar('proyectos')
      .then(setVistasGuardadas)
      .catch(() => {});
  }

  function aplicarVista(id: string) {
    setVistaSeleccionadaId(id);
    const vista = vistasGuardadas.find((v) => String(v.id) === id);
    if (!vista) return;
    const f = vista.filtros as Record<string, unknown>;
    setBusqueda(typeof f.busqueda === 'string' ? f.busqueda : '');
    setFiltroDireccionId(typeof f.filtroDireccionId === 'string' ? f.filtroDireccionId : '');
    setFiltroEstatus(typeof f.filtroEstatus === 'string' ? f.filtroEstatus : '');
  }

  async function guardarVistaActual() {
    const nombre = prompt('Nombre de la vista:');
    if (!nombre) return;
    try {
      await vistasGuardadasApi.crear({
        pantalla: 'proyectos',
        nombre,
        filtros: { busqueda, filtroDireccionId, filtroEstatus },
      });
      cargarVistas();
    } catch {
      setError('No se pudo guardar la vista.');
    }
  }

  async function eliminarVistaSeleccionada() {
    if (!vistaSeleccionadaId) return;
    try {
      await vistasGuardadasApi.eliminar(Number(vistaSeleccionadaId));
      setVistaSeleccionadaId('');
      cargarVistas();
    } catch {
      setError('No se pudo eliminar la vista.');
    }
  }

  function cargar() {
    setLoading(true);
    proyectosApi
      .listar()
      .then(setProyectos)
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    cargarVistas();
    // Direcciones se usan tanto para el formulario de creación (admin/
    // director/gerente_area) como para el filtro de la lista (cualquiera
    // con acceso a Proyectos) — por eso ya no depende de puedeCrear.
    catalogoApi.direcciones().then(setDirecciones).catch(() => {});
    if (puedeCrear) {
      // Un usuario con rol admin también puede quedar como Responsable de
      // un proyecto real (es una persona del equipo, no deja de serlo por
      // tener ese rol) — este selector solo muestra el nombre, nunca el
      // rol, así que no hace falta filtrar nada para que quede "invisible".
      usuariosApi.listar().then(setUsuarios).catch(() => {});
    }
  }, []);

  const proyectosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      if (termino && !p.nombre.toLowerCase().includes(termino)) return false;
      if (filtroDireccionId && !p.areas.some((a) => String(a.direccionId) === filtroDireccionId)) {
        return false;
      }
      if (filtroEstatus && p.estatus !== filtroEstatus) return false;
      return true;
    });
  }, [proyectos, busqueda, filtroDireccionId, filtroEstatus]);

  const hayFiltrosActivos = Boolean(busqueda || filtroDireccionId || filtroEstatus);

  // Áreas que este usuario puede seleccionar al crear un proyecto: admin
  // ve todas, director solo las de su Dirección, gerente_area solo la suya
  // (el backend re-valida esto de todas formas — ver validarAreasEnAlcance).
  const areasDisponibles = useMemo(() => {
    const todas = direcciones.flatMap((d) => d.areas.map((a) => ({ ...a, direccionNombre: d.nombre })));
    if (usuario?.rol === 'admin') return todas;
    if (usuario?.rol === 'director') {
      const dir = direcciones.find((d) => d.id === usuario.direccionId);
      return dir ? dir.areas.map((a) => ({ ...a, direccionNombre: dir.nombre })) : [];
    }
    if (usuario?.rol === 'gerente_area') {
      return todas.filter((a) => a.id === usuario.areaId);
    }
    return [];
  }, [direcciones, usuario]);

  useEffect(() => {
    if (usuario?.rol === 'gerente_area' && areasDisponibles.length === 1) {
      setAreaIds([areasDisponibles[0].id]);
    }
  }, [areasDisponibles]);

  function toggleArea(id: number) {
    if (usuario?.rol === 'gerente_area') return; // única área, fija
    setAreaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    if (areaIds.length === 0) {
      setErrorForm('Selecciona al menos un área.');
      return;
    }
    setGuardando(true);
    try {
      await proyectosApi.crear({
        nombre,
        fechaInicio,
        fechaFin,
        presupuesto: Number(presupuesto),
        responsableId: Number(responsableId),
        areaIds,
      });
      setMostrarForm(false);
      setNombre('');
      setFechaInicio('');
      setFechaFin('');
      setPresupuesto('');
      setResponsableId('');
      setAreaIds(usuario?.rol === 'gerente_area' ? areaIds : []);
      cargar();
    } catch (err: any) {
      setErrorForm(err?.response?.data?.message || 'No se pudo crear el proyecto.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Layout activo="proyectos">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">Proyectos</h1>
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={exportando}
            className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
          >
            {exportando ? 'Generando…' : '⬇ Exportar a Excel'}
          </button>
          {puedeCrear && (
            <button
              onClick={() => setMostrarForm((v) => !v)}
              className="bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg px-4 py-2 text-sm"
            >
              {mostrarForm ? 'Cancelar' : '+ Nuevo proyecto'}
            </button>
          )}
        </div>
      </div>

      {mostrarForm && (
        <form onSubmit={crear} className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
              <input
                required
                minLength={3}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                required
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de fin</label>
              <input
                type="date"
                required
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Presupuesto (MXN)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable</label>
              <select
                required
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
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
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Áreas involucradas</label>
              <div className="flex flex-wrap gap-2">
                {areasDisponibles.map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => toggleArea(a.id)}
                    className={`text-sm px-3 py-1.5 rounded-full border ${
                      areaIds.includes(a.id)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {a.nombre}
                  </button>
                ))}
                {areasDisponibles.length === 0 && (
                  <p className="text-sm text-gray-400">No hay áreas disponibles para tu rol.</p>
                )}
              </div>
            </div>
          </div>
          {errorForm && <p className="text-danger-500 text-sm font-medium">{errorForm}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Crear proyecto'}
          </button>
        </form>
      )}

      {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
      {error && <p className="text-danger-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar proyecto por nombre…"
            className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={filtroDireccionId}
            onChange={(e) => setFiltroDireccionId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas las direcciones</option>
            {direcciones.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los estatus</option>
            {Object.entries(ESTATUS_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setFiltroDireccionId('');
                setFiltroEstatus('');
              }}
              className="text-sm font-semibold text-primary-600 hover:text-primary-800"
            >
              Limpiar filtros
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <select
              value={vistaSeleccionadaId}
              onChange={(e) => aplicarVista(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Vistas guardadas…</option>
              {vistasGuardadas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
            {vistaSeleccionadaId && (
              <button
                type="button"
                onClick={eliminarVistaSeleccionada}
                title="Eliminar vista guardada"
                className="text-sm font-semibold text-danger-500 hover:text-danger-600 px-1"
              >
                ×
              </button>
            )}
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={guardarVistaActual}
                className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-semibold rounded-lg px-3 py-2 text-sm"
              >
                Guardar vista actual
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-primary-50 text-primary-800 text-left">
              <tr>
                <th className="px-5 py-3 font-bold">Proyecto</th>
                <th className="px-5 py-3 font-bold">Áreas</th>
                <th className="px-5 py-3 font-bold">Responsable</th>
                <th className="px-5 py-3 font-bold">Fechas</th>
                <th className="px-5 py-3 font-bold">Estatus</th>
                {/* El backend omite el campo por completo cuando el usuario no
                    puede verlo — basta con revisar el primer proyecto. */}
                {proyectos[0] && 'presupuesto' in proyectos[0] && (
                  <th className="px-5 py-3 font-bold">Presupuesto</th>
                )}
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((p, i) => {
                // El borde de acento usa el color de la Dirección del
                // proyecto (un proyecto puede tener varias áreas; se usa
                // la primera). El fondo, en cambio, alterna claro/oscuro
                // por posición —como el banding de una tabla de Excel—
                // para que filas consecutivas siempre se distingan entre
                // sí, incluso cuando comparten Dirección (PID: "que se
                // diferencien por color... como las tablas de Excel").
                const colorFila = p.areas[0]?.color || '#94a3b8';
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/proyectos/${p.id}`)}
                    style={{ borderLeft: `4px solid ${colorFila}` }}
                    className={`border-t border-gray-100 cursor-pointer transition hover:bg-primary-100/60 ${
                      i % 2 === 1 ? 'bg-primary-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-5 py-3 font-semibold text-primary-700">{p.nombre}</td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {p.areas.map((a) => (
                          <span
                            key={a.id}
                            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: a.color }}
                          >
                            {a.nombre}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.responsable?.nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {p.fechaInicio} → {p.fechaFin}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold uppercase text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                        {ESTATUS_LABEL[p.estatus] ?? p.estatus}
                      </span>
                    </td>
                    {'presupuesto' in p && (
                      <td className="px-5 py-3 text-gray-700">
                        ${Number(p.presupuesto).toLocaleString('es-MX')}
                      </td>
                    )}
                  </tr>
                );
              })}
              {proyectosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    {proyectos.length === 0
                      ? 'No hay proyectos dentro de tu alcance todavía.'
                      : 'Ningún proyecto coincide con la búsqueda/filtros.'}
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
