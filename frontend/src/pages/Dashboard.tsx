import { useEffect, useState } from 'react';
import { getUsuario, catalogoApi, proyectosApi, AreaConColor, Direccion, Proyecto } from '../lib/api';
import Layout from '../components/Layout';

// Pantalla de inicio: confirma que login + JWT + catálogo funcionan contra
// el backend real, y agrega el resumen "Proyectos por Área" (PID: "agregar
// un dashboard donde pueda ver la cantidad de proyectos por áreas"). Cada
// Área tiene un color — por defecto uno de una paleta fija asignada por id
// (ver backend paleta-colores.ts), y un admin puede personalizarlo aquí
// mismo con un selector de color.
export default function Dashboard() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [areas, setAreas] = useState<AreaConColor[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoColorId, setGuardandoColorId] = useState<number | null>(null);
  const usuario = getUsuario();
  const esAdmin = usuario?.rol === 'admin';

  function cargarTodo() {
    setLoading(true);
    Promise.all([catalogoApi.direcciones(), catalogoApi.areas(), proyectosApi.listar()])
      .then(([dirs, areasCat, proyectosLista]) => {
        setDirecciones(dirs);
        setAreas(areasCat);
        setProyectos(proyectosLista);
      })
      .catch(() => setError('No se pudo cargar el catálogo desde el backend.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  // Un proyecto puede tener varias áreas — cada una suma 1 a su conteo.
  const conteoPorArea = new Map<number, number>();
  for (const p of proyectos) {
    for (const a of p.areas) {
      conteoPorArea.set(a.id, (conteoPorArea.get(a.id) ?? 0) + 1);
    }
  }
  const maxConteo = Math.max(1, ...Array.from(conteoPorArea.values()));

  async function cambiarColor(areaId: number, color: string) {
    setGuardandoColorId(areaId);
    try {
      await catalogoApi.actualizarColorArea(areaId, color);
      setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, color } : a)));
    } catch {
      setError('No se pudo guardar el color del área.');
    } finally {
      setGuardandoColorId(null);
    }
  }

  return (
    <Layout activo="inicio">
      <h1 className="font-display font-extrabold text-2xl text-primary-900 mb-1">
        Bienvenido, {usuario?.nombre}
      </h1>
      <p className="text-gray-500 mb-6">
        {usuario?.direccion} · {usuario?.area}
        {usuario?.rol === 'gerente_area' && usuario?.verPresupuestoAutorizado && (
          <span className="ml-2 text-xs font-bold uppercase text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
            Presupuesto autorizado
          </span>
        )}
      </p>

      {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
      {error && <p className="text-danger-500 text-sm mb-4">{error}</p>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-base mb-1">Proyectos por Área</h2>
            <p className="text-xs text-gray-400 mb-4">
              {esAdmin
                ? 'Solo tú (admin) puedes cambiar el color de cada área.'
                : 'El color de cada área lo define un administrador.'}
            </p>
            <div className="space-y-3">
              {areas.map((a) => {
                const conteo = conteoPorArea.get(a.id) ?? 0;
                const anchoPct = Math.max(4, Math.round((conteo / maxConteo) * 100));
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm text-gray-700 truncate" title={a.nombre}>
                      {a.nombre}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-5 rounded-full flex items-center justify-end px-2 transition-all"
                        style={{ width: `${anchoPct}%`, backgroundColor: a.color }}
                      >
                        {conteo > 0 && (
                          <span className="text-xs font-bold text-white">{conteo}</span>
                        )}
                      </div>
                    </div>
                    {conteo === 0 && <span className="text-xs text-gray-400 w-4 text-center">0</span>}
                    {esAdmin && (
                      <input
                        type="color"
                        value={a.color}
                        disabled={guardandoColorId === a.id}
                        onChange={(e) => cambiarColor(a.id, e.target.value)}
                        title={`Color de ${a.nombre}`}
                        className="w-7 h-7 rounded border border-gray-200 cursor-pointer disabled:opacity-50"
                      />
                    )}
                  </div>
                );
              })}
              {areas.length === 0 && <p className="text-sm text-gray-400">Sin áreas registradas.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-base mb-4">Direcciones y Áreas</h2>
            <div className="grid grid-cols-1 gap-3">
              {direcciones.map((d) => (
                <div key={d.id} className="border border-gray-200 rounded-xl p-4">
                  <p className="font-bold text-primary-800 mb-2">{d.nombre}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {d.areas.map((a) => (
                      <span
                        key={a.id}
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: a.color }}
                      >
                        {a.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
