import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

// Se llega aquí desde el enlace del correo de recuperación
// (/restablecer-password?token=...). El token viaja solo en la URL —
// nunca se guarda en localStorage ni se manda a ningún otro lado.
export default function RestablecerPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/restablecer-password', { token, nuevaPassword });
      setListo(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-950">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo-fpt.png" alt="Fitness Para Todos" className="w-12 h-12 rounded-xl" />
          <h1 className="font-display font-extrabold text-lg text-primary-900">
            FPT · Gestión de Proyectos
          </h1>
        </div>

        {!token ? (
          <div className="space-y-4">
            <p className="text-sm text-danger-500 font-medium">
              Este enlace no es válido — le falta el token de recuperación. Solicita uno nuevo.
            </p>
            <Link
              to="/olvide-password"
              className="block text-center text-sm text-primary-600 font-semibold hover:underline"
            >
              Pedir un nuevo enlace
            </Link>
          </div>
        ) : listo ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con ella.
            </p>
            <Link
              to="/login"
              className="block text-center bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg py-2.5 transition"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">Elige tu nueva contraseña.</p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {error && <p className="text-danger-500 text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg py-2.5 transition disabled:opacity-60"
            >
              {loading ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
