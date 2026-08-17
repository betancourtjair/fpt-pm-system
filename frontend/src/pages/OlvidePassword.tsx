import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// Pide el correo y siempre muestra el mismo mensaje genérico al enviar —
// el backend decide en silencio si la cuenta existe o no (AuthService.
// olvidePassword) para no filtrar qué correos están registrados.
export default function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/olvide-password', { email });
      setEnviado(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo procesar la solicitud.');
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

        {enviado ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              Si <strong>{email}</strong> existe en el sistema, te enviamos un correo con un enlace
              para restablecer tu contraseña. El enlace es válido por 1 hora.
            </p>
            <Link to="/login" className="block text-center text-sm text-primary-600 font-semibold hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">
              Escribe tu correo y, si tienes una cuenta, te mandamos un enlace para elegir una
              nueva contraseña.
            </p>
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

            {error && <p className="text-danger-500 text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg py-2.5 transition disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-gray-500 hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
