import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';

// Fase 2 completa (PID sección 7): tiempo real del Gantt vía WebSockets +
// notificaciones in-app. Un solo gateway para las dos cosas porque
// comparten la misma autenticación de socket — no hace falta un namespace
// separado por cada una.
//
// Rooms usadas:
//   proyecto:<id>  — todos los que están viendo el Gantt de ese proyecto;
//                    se unen/salen a mano desde el frontend (evento
//                    "unirse-proyecto"/"salir-proyecto") y el backend
//                    valida el mismo alcance por rol que ya usa la API REST
//                    (ProyectosService.puedeVer) antes de dejarlos entrar.
//   usuario:<id>   — se une automático al conectar (una sola persona, su
//                    propia bandeja) para poder empujarle notificaciones
//                    nuevas sin que tenga que estar viendo ningún proyecto.
//
// La conexión en vivo es un plus, no un reemplazo: el frontend conserva su
// refetch de respaldo cada 2 minutos (ver Gantt.tsx) por si el socket se
// cae o el navegador lo bloquea.
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || '*') === '*' ? true : (process.env.CORS_ORIGIN as string).split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly proyectos: ProyectosService,
  ) {}

  // Autenticación del handshake: el cliente manda el JWT que ya usa para la
  // API REST en `auth.token` (ver frontend/src/lib/socket.ts) — nunca se
  // acepta una conexión sin token válido, mismo criterio que JwtAuthGuard.
  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, ''));
      if (!token) throw new UnauthorizedException('Falta el token.');

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      socket.data.user = payload;
      // Bandeja personal: se une solo, sin que el frontend tenga que pedirlo.
      await socket.join(`usuario:${payload.sub}`);
    } catch {
      this.logger.warn(`Conexión de socket rechazada (token inválido o ausente): ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    // Socket.IO limpia las rooms de este socket automáticamente al
    // desconectar — no hay nada que hacer a mano aquí.
    void socket;
  }

  @SubscribeMessage('unirse-proyecto')
  async unirseProyecto(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { proyectoId: number },
  ) {
    const user = socket.data.user as JwtPayload | undefined;
    if (!user) return { ok: false, error: 'No autenticado.' };

    try {
      const proyecto = await this.proyectos.obtenerEntidad(Number(data?.proyectoId));
      const puede = await this.proyectos.puedeVer(proyecto, user);
      if (!puede) return { ok: false, error: 'Este proyecto está fuera de tu alcance.' };
      await socket.join(`proyecto:${proyecto.id}`);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Proyecto no encontrado.' };
    }
  }

  @SubscribeMessage('salir-proyecto')
  async salirProyecto(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { proyectoId: number },
  ) {
    await socket.leave(`proyecto:${Number(data?.proyectoId)}`);
    return { ok: true };
  }

  // Emitidos por TareasService (ver tareas.service.ts) cada vez que se
  // crea/edita/borra una tarea o se actualiza su avance — así el Gantt de
  // todos los que estén viendo ese proyecto se refresca al instante.
  @OnEvent('tarea.cambio')
  emitirCambioTarea(payload: { proyectoId: number; tareaId: number; accion: string }) {
    this.server.to(`proyecto:${payload.proyectoId}`).emit('tarea:cambio', payload);
  }

  // Emitido por AlertasService justo después de registrar una alerta nueva
  // (asignación/48h/24h) en alertas_enviadas — independiente de si el
  // correo se pudo enviar o no, así la campanita avisa aunque Resend falle.
  @OnEvent('notificacion.creada')
  emitirNotificacionNueva(payload: {
    usuarioId: number;
    // id llega como texto con prefijo ('a-<n>' de alertas_enviadas, 'p-<n>'
    // de notificaciones_personalizadas — ver AlertasService/ComentariosService/
    // AutomatizacionesService y NotificacionesController), no como número.
    notificacion: { id: string; tipo: string; tareaId: number; tareaNombre: string; fechaProgramada: Date };
  }) {
    this.server.to(`usuario:${payload.usuarioId}`).emit('notificacion:nueva', payload.notificacion);
  }
}
