import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getUsuario } from '../lib/api';

type ItemActivo = 'inicio' | 'proyectos' | 'gantt' | 'usuarios';

// Shell compartido (header + nav lateral) — extraído del Dashboard original
// para que Proyectos/Gantt (Fase 1) usen la misma cáscara visual sin
// duplicar el marcado. Paleta e identidad: PID sección 3.6.
export default function Layout({ activo, children }: { activo: ItemActivo; children: ReactNode }) {
  const usuario = getUsuario();
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate('/login');
  }

  const itemClase = (clave: ItemActivo) =>
    `px-6 py-3 block ${
      activo === clave
        ? 'border-l-4 border-accent-500 text-white font-bold bg-white/5'
        : 'text-primary-200 hover:bg-white/5'
    }`;

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

      <nav className="bg-primary-950 py-5">
        <Link to="/dashboard" className={itemClase('inicio')}>
          Inicio
        </Link>
        <Link to="/proyectos" className={itemClase('proyectos')}>
          Proyectos
        </Link>
        <Link to="/gantt" className={itemClase('gantt')}>
          Diagrama de Gantt
        </Link>
        {Boolean(usuario?.permisos?.manage_users) && (
          <Link to="/usuarios" className={itemClase('usuarios')}>
            Usuarios
          </Link>
        )}
        <div className="px-6 py-3 text-primary-200 opacity-60">Notificaciones (Fase 2)</div>
      </nav>

      <main className="p-8 bg-[#F4F2F8] overflow-auto">{children}</main>
    </div>
  );
}
