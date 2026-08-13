import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession, getUsuario } from '../lib/api';

type Direccion = { id: number; nombre: string; areas: { id: number; nombre: string }[] };

// Shell mínimo para probar, de punta a punta, que login + JWT + catálogo
// funcionan contra el backend real. Los módulos de Proyectos/Gantt llegan
// en la Fase 1 del roadmap (PID sección 7) — esto es solo el primer montado.
export default function Dashboard() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const usuario = getUsuario();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/direcciones')
      .then((res) => setDirecciones(res.data))
      .catch(() => setError('No se pudo cargar el catálogo desde el backend.'))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] grid-rows-[64px_1fr]">
      <header className="col-span-2 bg-primary-950 text-white flex items-center justify-between px-6">
        <div className="flex items-center gap-2 font-display font-extrabold">
          <span className="w-3 h-3 rounded-full bg-accent-500" /> FPT · Gestión de Proyectos
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {usuario?.nombre} · <span className="text-primary-300">{usuario?.rol}</span>
          </span>
          <button onClick={logout} className="text-accent-500 font-semibold hover:underline">
            Salir
          </button>
        </div>
      </header>

      <nav className="bg-primary-950 text-primary-200 py-5">
        <div className="px-6 py-3 border-l-4 border-accent-500 text-white font-bold bg-white/5">
          Inicio
        </div>
        <div className="px-6 py-3 opacity-60">Proyectos (Fase 1)</div>
        <div className="px-6 py-3 opacity-60">Diagrama de Gantt (Fase 1)</div>
        <div className="px-6 py-3 opacity-60">Notificaciones (Fase 2)</div>
      </nav>

      <main className="p-8 bg-[#F4F2F8]">
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
      </main>
    </div>
  );
}
