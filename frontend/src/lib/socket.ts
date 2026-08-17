import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fase 2 completa (PID sección 7): tiempo real del Gantt + notificaciones
// in-app, vía Socket.IO. Un solo socket compartido para toda la sesión —
// se conecta una vez (con el mismo JWT que ya usa la API REST, mandado en
// el handshake) y las páginas se suscriben/desuscriben a sus rooms según
// lo que estén viendo.
//
// IMPORTANTE: esta conexión es un plus, no un reemplazo. Si el socket se
// cae, se bloquea (proxy corporativo, red restrictiva) o Render lo tumba
// por inactividad del plan gratuito, el Gantt sigue funcionando igual
// gracias al refetch de respaldo cada 2 minutos (ver Gantt.tsx) — nunca se
// debe depender del socket como única fuente de verdad.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: true,
    auth: { token: getToken() },
    // Reconexión con backoff — valores por defecto de socket.io-client ya
    // son razonables (reintentos indefinidos, delay creciente).
    reconnection: true,
  });
  return socket;
}

// Se llama al hacer logout — evita que quede un socket autenticado con el
// token de la sesión anterior colgado en memoria.
export function cerrarSocket() {
  socket?.disconnect();
  socket = null;
}
