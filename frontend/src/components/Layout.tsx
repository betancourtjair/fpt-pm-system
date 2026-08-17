import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getUsuario } from '../lib/api';
import { cerrarSocket } from '../lib/socket';
import NotificacionesBell from './NotificacionesBell';

type ItemActivo = 'inicio' | 'proyectos' | 'gantt' | 'usuarios' | 'metodologia';

// Shell compartido (header + nav lateral) — extraído del Dashboard original
// para que Proyectos/Gantt (Fase 1) usen la misma cáscara visual sin
// duplicar el marcado. Paleta e identidad: PID sección 3.6.
export default function Layout({ activo, children }: { activo: ItemActivo; children: ReactNode }) {
  const usuario = getUsuario();
  const navigate = useNavigate();

  function logout() {
    cerrarSocket();
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
          <NotificacionesBell />
          <span>
            {usuario?.nombre} · <span className="text-primary-300">{usuario?.rol}</span>
          </span>
          <button onClick={logout} className="text-accent-500 font-semibold hover:underline">
            Salir
          </button>
        </div>
      </header>

      <nav className="bg-primary-950 py-5 flex flex-col h-[calc(100vh-64px)]">
        <div className="flex-1">
          <Link to="/dashboard" className={itemClase('inicio')}>
            Inicio
          </Link>
          <Link to="/proyectos" className={itemClase('proyectos')}>
            Proyectos
          </Link>
          <Link to="/gantt" className={itemClase('gantt')}>
            Diagrama de Gantt
          </Link>
          <Link to="/metodologia" className={itemClase('metodologia')}>
            Metodología
          </Link>
          {Boolean(usuario?.permisos?.manage_users) && (
            <Link to="/usuarios" className={itemClase('usuarios')}>
              Usuarios
            </Link>
          )}
        </div>
        <a
          href="mailto:soporte@fpt.com.mx"
          className="px-6 py-3 block text-primary-200 hover:bg-white/5 border-t border-white/10"
        >
          ¿Necesitas ayuda? Escríbenos
        </a>
      </nav>

      <main className="p-8 bg-[#F4F2F8] overflow-auto">{children}</main>
    </div>
  );
}
