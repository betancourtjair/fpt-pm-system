import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import {
  catalogoApi,
  descargarBlob,
  getUsuario,
  usuariosApi,
  Direccion,
  Rol,
  ResultadoImportacionExcel,
  UsuarioDirectorio,
} from '../lib/api';

type FormUsuario = {
  nombre: string;
  email: string;
  password: string;
  rolId: string;
  areaId: string;
  activo: boolean;
};

const FORM_VACIO: FormUsuario = {
  nombre: '',
  email: '',
  password: '',
  rolId: '',
  areaId: '',
  activo: true,
};

// Gestión de usuarios — exclusiva de admin (permiso manage_users, ver
// catálogo de roles en db/seed.sql). El rol "admin" tiene alcance global y
// no pertenece a ninguna Dirección/Área: por eso el selector de área se
// oculta cuando el rol elegido es admin, y el backend fuerza areaId a
// null sin importar lo que se envíe (UsuariosService.validarRolYArea).
export default function Usuarios() {
  const usuarioActual = getUsuario();
  const puedeGestionar = Boolean(usuarioActual?.permisos?.manage_users);

  const [usuarios, setUsuarios] = useState<UsuarioDirectorio[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<'ninguno' | 'nuevo' | number>('ninguno');
  const [form, setForm] = useState<FormUsuario>(FORM_VACIO);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Colores por Dirección — PID: "agrega [en Admin] la opción para hacer
  // el cambio de color de las direcciones". Cada Área hereda el color de
  // su Dirección (Dashboard y Proyectos lo pintan, aquí solo se edita).
  const [guardandoColorId, setGuardandoColorId] = useState<number | null>(null);
  const [errorColor, setErrorColor] = useState<string | null>(null);

  // Carga masiva por Excel (PID sección 9.2) — descarga de plantilla y
  // subida del archivo lleno, con una tabla de resultados por fila
  // (incluye la contraseña temporal de cada cuenta creada).
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [descargando, setDescargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);
  const [resultadoImportacion, setResultadoImportacion] = useState<ResultadoImportacionExcel | null>(
    null,
  );

  // Búsqueda y filtros (mejora funcional: prioridad 7) — igual que en
  // Proyectos, client-side dado el tamaño actual del directorio.
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  function cargar() {
    setLoading(true);
    usuariosApi
      .listar()
      .then(setUsuarios)
      .catch(() => setError('No se pudo cargar el directorio de usuarios.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
    if (puedeGestionar) {
      catalogoApi.roles().then(setRoles).catch(() => {});
      catalogoApi.direcciones().then(setDirecciones).catch(() => {});
    }
  }, []);

  const areasDisponibles = useMemo(
    () => direcciones.flatMap((d) => d.areas.map((a) => ({ ...a, direccionNombre: d.nombre }))),
    [direcciones],
  );

  const rolSeleccionado = useMemo(
    () => roles.find((r) => String(r.id) === form.rolId),
    [roles, form.rolId],
  );
  const esRolAdmin = rolSeleccionado?.nombre === 'admin';

  const rolesPresentes = useMemo(
    () => [...new Set(usuarios.map((u) => u.rol).filter((r): r is string => Boolean(r)))].sort(),
    [usuarios],
  );

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (termino && !u.nombre.toLowerCase().includes(termino) && !u.email.toLowerCase().includes(termino)) {
        return false;
      }
      if (filtroRol && u.rol !== filtroRol) return false;
      if (filtroEstatus === 'activo' && !u.activo) return false;
      if (filtroEstatus === 'inactivo' && u.activo) return false;
      return true;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstatus]);

  const hayFiltrosActivos = Boolean(busqueda || filtroRol || filtroEstatus);

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setNuevaPassword('');
    setErrorForm(null);
    setModo('nuevo');
  }

  function abrirEdicion(u: UsuarioDirectorio) {
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rolId: String(u.rolId),
      areaId: u.areaId ? String(u.areaId) : '',
      activo: u.activo,
    });
    setNuevaPassword('');
    setErrorForm(null);
    setModo(u.id);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    setGuardando(true);
    try {
      if (modo === 'nuevo') {
        await usuariosApi.crear({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rolId: Number(form.rolId),
          areaId: esRolAdmin ? undefined : form.areaId ? Number(form.areaId) : undefined,
        });
      } else if (typeof modo === 'number') {
        const dto: Record<string, unknown> = {
          nombre: form.nombre,
          email: form.email,
          rolId: Number(form.rolId),
          areaId: esRolAdmin ? null : form.areaId ? Number(form.areaId) : null,
          activo: form.activo,
        };
        if (nuevaPassword) dto.nuevaPassword = nuevaPassword;
        await usuariosApi.actualizar(modo, dto);
      }
      setModo('ninguno');
      cargar();
    } catch (err: any) {
      setErrorForm(err?.response?.data?.message || 'No se pudo guardar el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(u: UsuarioDirectorio) {
    await usuariosApi.actualizar(u.id, { activo: !u.activo });
    cargar();
  }

  async function alternarPresupuesto(u: UsuarioDirectorio) {
    await usuariosApi.autorizarPresupuesto(u.id, !u.verPresupuestoAutorizado);
    cargar();
  }

  async function cambiarColorDireccion(direccionId: number, color: string) {
    setErrorColor(null);
    setGuardandoColorId(direccionId);
    try {
      await catalogoApi.actualizarColorDireccion(direccionId, color);
      setDirecciones((prev) => prev.map((d) => (d.id === direccionId ? { ...d, color } : d)));
    } catch {
      setErrorColor('No se pudo guardar el color de la Dirección.');
    } finally {
      setGuardandoColorId(null);
    }
  }

  async function descargarPlantilla() {
    setDescargando(true);
    try {
      const blob = await usuariosApi.descargarPlantilla();
      descargarBlob(blob, 'Plantilla_Usuarios_FPT.xlsx');
    } catch {
      setErrorImportacion('No se pudo descargar la plantilla.');
    } finally {
      setDescargando(false);
    }
  }

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si hace falta reintentar
    if (!archivo) return;

    setErrorImportacion(null);
    setResultadoImportacion(null);
    setImportando(true);
    try {
      const resultado = await usuariosApi.importarExcel(archivo);
      setResultadoImportacion(resultado);
      cargar();
    } catch (err: any) {
      setErrorImportacion(err?.response?.data?.message || 'No se pudo procesar el archivo.');
    } finally {
      setImportando(false);
    }
  }

  if (!puedeGestionar) {
    return (
      <Layout activo="usuarios">
        <p className="text-gray-500 text-sm">
          Tu rol no tiene permiso para gestionar usuarios.
        </p>
      </Layout>
    );
  }

  return (
    <Layout activo="usuarios">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">
          Gestión de usuarios
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={descargarPlantilla}
            disabled={descargando}
            className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
          >
            {descargando ? 'Descargando…' : '⬇ Descargar plantilla'}
          </button>
          <button
            onClick={() => inputArchivoRef.current?.click()}
            disabled={importando}
            className="bg-white border border-primary-200 hover:bg-primary-50 text-primary-800 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
          >
            {importando ? 'Cargando…' : '⬆ Cargar Excel'}
          </button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onArchivoSeleccionado}
          />
          <button
            onClick={abrirNuevo}
            className="bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg px-4 py-2 text-sm"
          >
            + Nuevo usuario
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 mb-6 max-w-3xl">
        <h2 className="font-display font-bold text-base mb-1">Colores por Dirección</h2>
        <p className="text-xs text-gray-400 mb-4">
          Este color se usa para pintar Proyectos y el resumen de Inicio — cada Área hereda el
          color de su Dirección.
        </p>
        {errorColor && <p className="text-danger-500 text-sm font-medium mb-3">{errorColor}</p>}
        <div className="grid grid-cols-2 gap-3">
          {direcciones.map((d) => (
            <div key={d.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-gray-700 truncate" title={d.nombre}>
                {d.nombre}
              </span>
              <input
                type="color"
                value={d.color}
                disabled={guardandoColorId === d.id}
                onChange={(e) => cambiarColorDireccion(d.id, e.target.value)}
                title={`Color de ${d.nombre}`}
                className="w-8 h-8 rounded border border-gray-200 cursor-pointer disabled:opacity-50"
              />
            </div>
          ))}
          {direcciones.length === 0 && (
            <p className="text-sm text-gray-400">Sin Direcciones registradas.</p>
          )}
        </div>
      </div>

      {errorImportacion && (
        <p className="text-danger-500 text-sm font-medium mb-4">{errorImportacion}</p>
      )}

      {resultadoImportacion && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base">
              Resultado de la carga: {resultadoImportacion.creados} de {resultadoImportacion.total}{' '}
              usuarios creados
              {resultadoImportacion.conError > 0 && (
                <span className="text-danger-500"> · {resultadoImportacion.conError} con error</span>
              )}
            </h2>
            <button
              onClick={() => setResultadoImportacion(null)}
              className="text-gray-500 text-sm font-semibold hover:underline"
            >
              Cerrar
            </button>
          </div>
          {resultadoImportacion.creados > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              Comparte cada contraseña temporal únicamente con su dueño (idealmente 1 a 1, no por
              correo grupal ni chat de equipo). Todas las cuentas deben cambiarla en su primer
              inicio de sesión.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 text-primary-800 text-left">
                <tr>
                  <th className="px-3 py-2 font-bold">Fila</th>
                  <th className="px-3 py-2 font-bold">Nombre</th>
                  <th className="px-3 py-2 font-bold">Correo</th>
                  <th className="px-3 py-2 font-bold">Resultado</th>
                  <th className="px-3 py-2 font-bold">Contraseña temporal</th>
                </tr>
              </thead>
              <tbody>
                {resultadoImportacion.resultados.map((r) => (
                  <tr key={r.fila} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500">{r.fila}</td>
                    <td className="px-3 py-2 font-semibold text-primary-800">{r.nombre || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.email || '—'}</td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="text-xs font-bold uppercase text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                          Creado ({r.rol})
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold text-danger-500 bg-danger-500/10 px-2 py-0.5 rounded-full"
                          title={r.mensaje}
                        >
                          {r.mensaje}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">
                      {r.passwordTemporal ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(modo === 'nuevo' || typeof modo === 'number') && (
        <form onSubmit={guardar} className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
          <h2 className="font-display font-bold text-base">
            {modo === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Rol</label>
              <select
                required
                value={form.rolId}
                onChange={(e) => setForm({ ...form, rolId: e.target.value, areaId: '' })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Selecciona…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            {!esRolAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Área</label>
                <select
                  required={!esRolAdmin}
                  value={form.areaId}
                  onChange={(e) => setForm({ ...form, areaId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">Selecciona…</option>
                  {areasDisponibles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.direccionNombre})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {esRolAdmin && (
              <div className="flex items-end">
                <p className="text-xs text-gray-400 pb-2">
                  El rol admin tiene alcance global — no pertenece a ninguna Área ni Dirección.
                </p>
              </div>
            )}
            {modo === 'nuevo' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Contraseña temporal
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  El usuario deberá cambiarla al iniciar sesión por primera vez.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Restablecer contraseña (opcional)
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    placeholder="Dejar en blanco para no cambiarla"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="activo" className="text-sm font-semibold text-gray-700">
                    Cuenta activa
                  </label>
                </div>
              </>
            )}
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

      {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
      {error && <p className="text-danger-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize"
          >
            <option value="">Todos los roles</option>
            {rolesPresentes.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </select>
          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los estatus</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setFiltroRol('');
                setFiltroEstatus('');
              }}
              className="text-sm font-semibold text-primary-600 hover:text-primary-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-primary-50 text-primary-800 text-left">
              <tr>
                <th className="px-5 py-3 font-bold">Nombre</th>
                <th className="px-5 py-3 font-bold">Correo</th>
                <th className="px-5 py-3 font-bold">Rol</th>
                <th className="px-5 py-3 font-bold">Área / Dirección</th>
                <th className="px-5 py-3 font-bold">Estatus</th>
                <th className="px-5 py-3 font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-5 py-3 font-semibold text-primary-800">{u.nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{u.rol}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {u.rol === 'admin' ? (
                      <span className="text-gray-400">Alcance global</span>
                    ) : (
                      `${u.area ?? '—'} · ${u.direccion ?? '—'}`
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                        u.activo ? 'text-primary-700 bg-primary-100' : 'text-danger-500 bg-danger-500/10'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {u.rol === 'gerente_area' && u.verPresupuestoAutorizado && (
                      <span className="ml-1 text-xs font-bold uppercase text-accent-700 bg-accent-100 px-2 py-0.5 rounded-full">
                        Ve presupuesto
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-3">
                      <button
                        onClick={() => abrirEdicion(u)}
                        className="text-gray-600 text-xs font-bold hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => alternarActivo(u)}
                        className="text-xs font-bold hover:underline text-primary-700"
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      {u.rol === 'gerente_area' && (
                        <button
                          onClick={() => alternarPresupuesto(u)}
                          className="text-xs font-bold hover:underline text-primary-700"
                        >
                          {u.verPresupuestoAutorizado ? 'Quitar presupuesto' : 'Autorizar presupuesto'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    {usuarios.length === 0
                      ? 'No hay usuarios para mostrar.'
                      : 'Ningún usuario coincide con la búsqueda/filtros.'}
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
