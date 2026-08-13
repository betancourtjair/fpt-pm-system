import { useEffect, useState } from 'react';
import { getUsuario } from '../lib/api';
import { api } from '../lib/api';
import Layout from '../components/Layout';

type Direccion = { id: number; nombre: string; areas: { id: number; nombre: string }[] };

// Pantalla de inicio: confirma que login + JWT + catálogo funcionan contra
// el backend real. Los módulos de Proyectos/Gantt (Fase 1, PID sección 7)
// viven ahora en sus propias páginas — ver Proyectos.tsx y Gantt.tsx.
export default function Dashboard() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usuario = getUsuario();

  useEffect(() => {
    api
      .get('/direcciones')
      .then((res) => setDirecciones(res.data))
      .catch(() => setError('No se pudo cargar el catálogo desde el backend.'))
      .finally(() => setLoading(false));
  }, []);

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

      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="font-display font-bold text-base mb-4">
          Catálogo de Direcciones y Áreas (desde la base de datos)
        </h2>
        {loading && <p className="text-gray-500 text-sm">Cargando…</p>}
        {error && <p className="text-danger-500 text-sm">{error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4">
            {direcciones.map((d) => (
              <div key={d.id} className="border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-primary-800">{d.nombre}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {d.areas.map((a) => a.nombre).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
