import { useEffect, useRef, useState } from 'react';
import { notificacionesApi, Notificacion } from '../lib/api';
import { getSocket } from '../lib/socket';

const ETIQUETA_TIPO: Record<Notificacion['tipo'], string> = {
  asignacion: 'Nueva asignación',
  '48h': 'Vence en 48 horas',
  '24h': 'Vence en 24 horas',
  vencida: 'Tarea vencida',
  bloqueada: 'Tarea bloqueada',
  mencion: 'Te mencionaron',
  automatizacion: 'Automatización',
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Campanita de notificaciones in-app (Fase 2 completa, PID sección 7):
// reemplaza el placeholder "Notificaciones (Fase 2)" del sidebar. Combina
// la carga inicial por REST con eventos en vivo por WebSocket
// ('notificacion:nueva', emitido por RealtimeGateway) — así llega al
// instante aunque el correo haya fallado ese día (tope de Resend, etc.).
export default function NotificacionesBell() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificacionesApi
      .listar()
      .then((d) => {
        setNotificaciones(d.notificaciones);
        setNoLeidas(d.noLeidas);
      })
      .catch(() => {
        // Silencioso a propósito: la campanita no debe romper el resto de
        // la interfaz si /notificaciones falla momentáneamente.
      });

    const socket = getSocket();
    const alRecibir = (nueva: {
      id: string;
      tipo: Notificacion['tipo'];
      tareaId: number;
      tareaNombre: string;
      fechaProgramada: string;
      mensaje?: string | null;
    }) => {
      setNotificaciones((prev) => [
        {
          id: nueva.id,
          tipo: nueva.tipo,
          tarea: { id: nueva.tareaId, nombre: nueva.tareaNombre },
          mensaje: nueva.mensaje ?? null,
          fechaProgramada: nueva.fechaProgramada,
          leido: false,
        },
        ...prev,
      ]);
      setNoLeidas((n) => n + 1);
    };
    socket.on('notificacion:nueva', alRecibir);
    return () => {
      socket.off('notificacion:nueva', alRecibir);
    };
  }, []);

  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alClickFuera);
    return () => document.removeEventListener('mousedown', alClickFuera);
  }, []);

  function marcarLeida(id: string) {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)));
    setNoLeidas((n) => Math.max(0, n - 1));
    notificacionesApi.marcarLeida(id).catch(() => {});
  }

  function marcarTodas() {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
    setNoLeidas(0);
    notificacionesApi.marcarTodasLeidas().catch(() => {});
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative flex items-center gap-1.5 text-sm text-primary-200 hover:text-white"
        aria-label="Notificaciones"
      >
        <span className="text-base">🔔</span>
        {noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-accent-500 text-gray-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-card text-gray-900 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-display font-bold text-sm text-primary-900">Notificaciones</span>
            {noLeidas > 0 && (
              <button onClick={marcarTodas} className="text-xs text-primary-500 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {notificaciones.length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No tienes notificaciones todavía.</p>
            )}
            {notificaciones.map((n) => (
              <button
                key={n.id}
                onClick={() => marcarLeida(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-primary-50/50 ${
                  n.leido ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.leido && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 flex-shrink-0" />}
                  <span className="text-xs font-semibold text-primary-700">{ETIQUETA_TIPO[n.tipo]}</span>
                </div>
                <p className="text-sm text-gray-800 truncate mt-0.5">
                  {n.mensaje ?? n.tarea?.nombre ?? 'Tarea'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{formatearFecha(n.fechaProgramada)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
