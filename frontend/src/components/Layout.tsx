import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getUsuario, msRestantesDeSesion } from '../lib/api';
import { cerrarSocket } from '../lib/socket';
import NotificacionesBell from './NotificacionesBell';
import BusquedaGlobal from './BusquedaGlobal';

type ItemActivo =
  | 'inicio'
  | 'proyectos'
  | 'mis-tareas'
  | 'gantt'
  | 'portafolio'
  | 'usuarios'
  | 'metodologia'
  | 'carga-trabajo'
  | 'reportes';

// Shell compartido (header + nav lateral) — extraído del Dashboard original
// para que Proyectos/Gantt (Fase 1) usen la misma cáscara visual sin
// duplicar el marcado. Paleta e identidad: PID sección 3.6.
export default function Layout({ activo, children }: { activo: ItemActivo; children: ReactNode }) {
  const usuario = getUsuario();
  const navigate = useNavigate();
  // Auditoría de vista móvil (prioridad 12): abajo de md, el menú lateral
  // pasa de columna fija a cajón (drawer) que se abre con el botón ☰ del
  // header — en escritorio (md+) sigue siempre visible como antes.
  const [menuAbierto, setMenuAbierto] = useState(false);

  function logout() {
    cerrarSocket();
    clearSession();
    navigate('/login');
  }

  // Cierre de sesión automático cada 3 horas (respaldado del lado del
  // servidor por JWT_EXPIRES_IN — ver auth.module.ts). Se revisa al montar
  // cada pantalla protegida: si ya se cumplió la ventana, se cierra sesión
  // de inmediato; si no, se programa el cierre para cuando falte.
  useEffect(() => {
    const restante = msRestantesDeSesion();
    if (restante <= 0) {
      logout();
      return;
    }
    const temporizador = setTimeout(logout, restante);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemClase = (clave: ItemActivo) =>
    `px-6 py-3 block ${
      activo === clave
        ? 'border-l-4 border-accent-500 text-white font-bold bg-white/5'
        : 'text-primary-200 hover:bg-white/5'
    }`;

  // Cierra el cajón al navegar — si no, en móvil el menú se queda abierto
  // tapando la pantalla nueva después de dar click a un link.
  function cerrarMenu() {
    setMenuAbierto(false);
  }

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[240px_1fr] md:grid-rows-[64px_1fr]">
      <header className="relative z-30 md:col-span-2 bg-primary-950 text-white flex items-center justify-between px-4 sm:px-6 h-16 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 font-display font-extrabold min-w-0">
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className="md:hidden text-white text-2xl leading-none px-1 -ml-1"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuAbierto ? '✕' : '☰'}
          </button>
          <img src="/logo-fpt.png" alt="Fitness Para Todos" className="w-9 h-9 rounded-lg shrink-0" />
          <span className="truncate hidden sm:inline">Gestión de Proyectos</span>
        </div>
        {/* Búsqueda global (tercera ronda de mejoras) — oculta en pantallas muy
            angostas para no saturar el header junto al menú/campanita. */}
        <div className="hidden md:block flex-1 mx-4 max-w-xs">
          <BusquedaGlobal />
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm shrink-0">
          <NotificacionesBell />
          <span className="hidden sm:inline">
            {usuario?.nombre} · <span className="text-primary-300">{usuario?.rol}</span>
          </span>
          <button onClick={logout} className="text-accent-500 font-semibold hover:underline">
            Salir
          </button>
        </div>
      </header>

      {/* Fondo oscuro detrás del cajón — clic afuera lo cierra (solo móvil,
          el cajón nunca se abre en md+ así que este overlay tampoco). */}
      {menuAbierto && (
        <div
          className="fixed inset-0 top-16 bg-black/40 z-20 md:hidden"
          onClick={cerrarMenu}
          aria-hidden="true"
        />
      )}

      <nav
        className={`bg-primary-950 py-5 flex flex-col fixed md:static top-16 md:top-auto left-0 w-64 md:w-auto h-[calc(100vh-64px)] z-20 transition-transform duration-200 md:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          <Link to="/dashboard" className={itemClase('inicio')} onClick={cerrarMenu}>
            Inicio
          </Link>
          <Link to="/proyectos" className={itemClase('proyectos')} onClick={cerrarMenu}>
            Proyectos
          </Link>
          <Link to="/mis-tareas" className={itemClase('mis-tareas')} onClick={cerrarMenu}>
            Mis tareas
          </Link>
          <Link to="/gantt" className={itemClase('gantt')} onClick={cerrarMenu}>
            Diagrama de Gantt
          </Link>
          {/* Portafolio (vista de conjunto por Dirección) — visible a
              cualquiera que pueda ver al menos un proyecto, sin importar el
              rol: el backend ya filtra /proyectos por alcance, así que no
              hace falta repetir ningún gate de rol aquí. */}
          <Link to="/portafolio" className={itemClase('portafolio')} onClick={cerrarMenu}>
            Portafolio
          </Link>
          {/* Carga de trabajo por persona (tercera ronda de mejoras) — mismo
              alcance de roles que ya protege el endpoint en el backend
              (admin/director/gerente_area); un colaborador no lo ve. */}
          {['admin', 'director', 'gerente_area'].includes(usuario?.rol) && (
            <Link to="/carga-trabajo" className={itemClase('carga-trabajo')} onClick={cerrarMenu}>
              Carga de trabajo
            </Link>
          )}
          {/* Reportes / dashboard ejecutivo con tendencias (cuarta ronda de
              mejoras) — vista de gestión, mismo gate de rol que Carga de
              trabajo (un colaborador no lo ve). */}
          {['admin', 'director', 'gerente_area'].includes(usuario?.rol) && (
            <Link to="/reportes" className={itemClase('reportes')} onClick={cerrarMenu}>
              Reportes
            </Link>
          )}
          <Link to="/metodologia" className={itemClase('metodologia')} onClick={cerrarMenu}>
            Metodología
          </Link>
          {Boolean(usuario?.permisos?.manage_users) && (
            <Link to="/usuarios" className={itemClase('usuarios')} onClick={cerrarMenu}>
              Admin
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

      <main className="flex-1 min-w-0 p-4 sm:p-8 bg-[#F4F2F8] overflow-auto md:h-[calc(100vh-64px)]">
        {children}
      </main>
    </div>
  );
}
