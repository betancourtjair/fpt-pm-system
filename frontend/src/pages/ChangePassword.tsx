import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Pantalla obligatoria cuando mustChangePassword = true (cuentas admin/admin
// y las cargadas desde el Excel de usuarios — ver PID sección 8, riesgo de
// credenciales por defecto).
export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      setOk(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo cambiar la contraseña.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-950">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card p-8">
        <h1 className="font-display font-extrabold text-lg text-primary-900 mb-2">
          Cambia tu contraseña
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Es tu primer inicio de sesión: debes establecer una contraseña nueva antes de continuar.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            required
            placeholder="Contraseña temporal actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            required
            placeholder="Confirma la nueva contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {error && <p className="text-danger-500 text-sm font-medium">{error}</p>}
          {ok && <p className="text-primary-700 text-sm font-medium">¡Contraseña actualizada!</p>}
          <button
            type="submit"
            className="w-full bg-accent-500 hover:bg-accent-600 text-gray-900 font-bold rounded-lg py-2.5 transition"
          >
            Guardar y continuar
          </button>
        </form>
      </div>
    </div>
  );
}
