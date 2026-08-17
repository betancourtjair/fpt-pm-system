import { useEffect, useState } from 'react';
import { getUsuario, catalogoApi, proyectosApi, Direccion, Proyecto } from '../lib/api';
import Layout from '../components/Layout';

// Pantalla de inicio: confirma que login + JWT + catálogo funcionan contra
// el backend real, y muestra "Proyectos por Dirección" (PID: "agregar un
// dashboard donde pueda ver la cantidad de proyectos"). Por default solo
// se ve el resumen por Dirección — al hacer click se despliega el detalle
// por Área debajo (PID: "que la lista de inicio sea desplegable"). El
// color de cada Dirección se administra desde "Admin" (ver Usuarios.tsx);
// aquí es de solo lectura.
export default function Dashboard() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());
  const usuario = getUsuario();

  useEffect(() => {
    Promise.all([catalogoApi.direcciones(), proyectosApi.listar()])
      .then(([dirs, proyectosLista]) => {
        setDirecciones(dirs);
        setProyectos(proyectosLista);
      })
      .catch(() => setError('No se pudo cargar el catálogo desde el backend.'))
      .finally(() => setLoading(false));
  }, []);

  function alternarExpandida(direccionId: number) {
    setExpandidas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(direccionId)) siguiente.delete(direccionId);
      else siguiente.add(direccionId);
      return siguiente;
    });
  }

  // Un proyecto puede tener varias áreas — cada una suma 1 a su conteo, y
  // cada proyecto suma 1 (sin duplicar) al conteo de su(s) Dirección(es).
  const conteoPorArea = new Map<number, number>();
  const proyectosPorDireccion = new Map<number, Set<number>>();
  for (const p of proyectos) {
    for (const a of p.areas) {
      conteoPorArea.set(a.id, (conteoPorArea.get(a.id) ?? 0) + 1);
      if (a.direccionId !== undefined) {
        if (!proyectosPorDireccion.has(a.direccionId)) {
          proyectosPorDireccion.set(a.direccionId, new Set());
        }
        proyectosPorDireccion.get(a.direccionId)!.add(p.id);
      }
    }
  }
  const maxConteoDireccion = Math.max(
    1,
    ...direcciones.map((d) => proyectosPorDireccion.get(d.id)?.size ?? 0),
  );

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
        <div className="bg-white rounded-2xl shadow-card p-6 max-w-3xl">
          <h2 className="font-display font-bold text-base mb-1">Proyectos por Dirección</h2>
          <p className="text-xs text-gray-400 mb-4">
            Da click en una Dirección para ver el detalle por Área.
          </p>
          <div className="space-y-2">
            {direcciones.map((d) => {
              const total = proyectosPorDireccion.get(d.id)?.size ?? 0;
              const anchoPct = Math.max(4, Math.round((total / maxConteoDireccion) * 100));
              const abierta = expandidas.has(d.id);
              const maxConteoArea = Math.max(1, ...d.areas.map((a) => conteoPorArea.get(a.id) ?? 0));
              return (
                <div key={d.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div
                    onClick={() => alternarExpandida(d.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <span className="text-gray-400 text-xs w-3 shrink-0">{abierta ? '▾' : '▸'}</span>
                    <span className="w-36 shrink-0 text-sm font-semibold text-gray-700 truncate" title={d.nombre}>
                      {d.nombre}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-5 rounded-full flex items-center justify-end px-2 transition-all"
                        style={{ width: `${anchoPct}%`, backgroundColor: d.color }}
                      >
                        {total > 0 && <span className="text-xs font-bold text-white">{total}</span>}
                      </div>
                    </div>
                    {total === 0 && <span className="text-xs text-gray-400 w-4 text-center">0</span>}
                  </div>
                  {abierta && (
                    <div className="bg-gray-50/60 border-t border-gray-100 px-3 py-2.5 pl-10 space-y-1.5">
                      {d.areas.map((a) => {
                        const conteo = conteoPorArea.get(a.id) ?? 0;
                        const anchoArea = Math.max(4, Math.round((conteo / maxConteoArea) * 100));
                        return (
                          <div key={a.id} className="flex items-center gap-2">
                            <span className="w-32 shrink-0 text-xs text-gray-600 truncate" title={a.nombre}>
                              {a.nombre}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
                              <div
                                className="h-3.5 rounded-full"
                                style={{ width: `${anchoArea}%`, backgroundColor: a.color }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-4 text-right">{conteo}</span>
                          </div>
                        );
                      })}
                      {d.areas.length === 0 && (
                        <p className="text-xs text-gray-400">Esta Dirección no tiene Áreas.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {direcciones.length === 0 && <p className="text-sm text-gray-400">Sin Direcciones registradas.</p>}
          </div>
        </div>
      )}
    </Layout>
  );
}
