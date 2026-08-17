import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { usuariosApi, CargaTrabajoUsuario } from '../lib/api';

// Vista de carga de trabajo por persona (tercera ronda de mejoras, ver
// README sección 4): responde "¿quién anda saturado y quién puede tomar
// más?" de un vistazo, sin tener que entrar proyecto por proyecto contando
// tareas a mano. Mismo alcance de roles que /usuarios — admin ve a todos,
// director su Dirección, gerente_area su Área.
export default function CargaTrabajo() {
  const [filas, setFilas] = useState<CargaTrabajoUsuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usuariosApi
      .cargaTrabajo()
      .then(setFilas)
      .catch(() => setError('No se pudo cargar la información de carga de trabajo.'))
      .finally(() => setCargando(false));
  }, []);

  const maxActivas = Math.max(1, ...filas.map((f) => f.tareasActivas));

  return (
    <Layout activo="carga-trabajo">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-primary-900">Carga de trabajo</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tareas activas y vencidas por persona, dentro de tu alcance de visibilidad.
        </p>
      </div>

      {cargando ? (
        <p className="text-gray-500 text-sm">Cargando…</p>
      ) : error ? (
        <p className="text-danger-500 text-sm">{error}</p>
      ) : filas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center text-gray-400">
          No hay personas dentro de tu alcance todavía.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-primary-50 text-primary-800 text-left">
              <tr>
                <th className="px-5 py-3 font-bold">Persona</th>
                <th className="px-5 py-3 font-bold">Rol / Área</th>
                <th className="px-5 py-3 font-bold">Tareas activas</th>
                <th className="px-5 py-3 font-bold">Vencidas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 align-top">
                  <td className="px-5 py-3 font-semibold text-primary-800">{f.nombre}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {f.rol ?? '—'}
                    {f.area && <span className="text-gray-400"> · {f.area}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary-800 w-6 text-right">{f.tareasActivas}</span>
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-1.5 bg-primary-500 rounded-full"
                          style={{ width: `${(f.tareasActivas / maxActivas) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {f.tareasVencidas > 0 ? (
                      <span className="text-xs font-bold uppercase text-danger-500 bg-danger-500/10 px-2 py-0.5 rounded-full">
                        {f.tareasVencidas} vencida{f.tareasVencidas === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
