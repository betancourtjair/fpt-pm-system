import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setSession } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data.accessToken, data.usuario);
      navigate(data.usuario.mustChangePassword ? '/cambiar-password' : '/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo iniciar sesión.');
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="nombre@fpt.com.mx"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-danger-500 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg py-2.5 transition disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>

          <div className="text-center">
            <Link to="/olvide-password" className="text-sm text-primary-600 font-semibold hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        {/* Si no tienes cuenta todavía, no hay autoservicio para crearla
            (las altas las hace TI vía Admin o carga masiva por Excel) — de
            ahí que el único camino de ayuda aquí sea contactar a TI. */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 mb-2">Si no tienes usuario, contacta a TI</p>
          <a
            href="mailto:soporte@fpt.com.mx"
            className="inline-block text-sm font-bold text-primary-600 hover:text-primary-800 border border-primary-200 rounded-lg px-4 py-1.5 hover:bg-primary-50"
          >
            Escribir a soporte@fpt.com.mx
          </a>
        </div>
      </div>
    </div>
  );
}
