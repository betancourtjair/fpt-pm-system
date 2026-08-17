import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';

// Notificaciones dentro de la app (Fase 2 completa, PID sección 7):
// reutiliza alertas_enviadas — cada fila (asignación/48h/24h) YA es, por
// definición, algo que le tocaba avisarle a este usuario. A diferencia de
// /alertas (solo admin, para auditar el envío de correos), aquí cada quien
// ve únicamente sus propias notificaciones — sin @Roles, cualquier rol
// autenticado puede consultar y marcar como leídas las suyas.
//
// Desde la migración 011, además de alertas_enviadas (asignación/48h/24h/
// vencida/bloqueada — UNIQUE por tarea+usuario+tipo, un solo aviso por
// combinación) hay una segunda fuente sin esa restricción de unicidad:
// notificaciones_personalizadas (menciones en comentarios,
// automatizaciones de usuario), que sí pueden repetirse varias veces para
// la misma tarea+usuario. Aquí las combinamos en una sola lista ordenada
// por fecha. Para no chocar los ids numéricos de ambas tablas se expone un
// id de texto con prefijo — 'a-<id>' para alertas_enviadas, 'p-<id>' para
// notificaciones_personalizadas — el mismo esquema que ya usan los eventos
// de WebSocket 'notificacion.creada' (ver AlertasService, ComentariosService
// y AutomatizacionesService).
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    @InjectRepository(AlertaEnviada) private readonly alertas: Repository<AlertaEnviada>,
    @InjectRepository(NotificacionPersonalizada)
    private readonly personalizadas: Repository<NotificacionPersonalizada>,
  ) {}

  @Get()
  async listar(@CurrentUser() user: JwtPayload) {
    const [registrosAlertas, registrosPersonalizadas] = await Promise.all([
      this.alertas.find({
        where: { usuarioId: user.sub },
        relations: { tarea: true },
        order: { id: 'DESC' },
        take: 100,
      }),
      this.personalizadas.find({
        where: { usuarioId: user.sub },
        relations: { tarea: true },
        order: { creadoEn: 'DESC' },
        take: 100,
      }),
    ]);

    const deAlertas = registrosAlertas.map((a) => ({
      id: `a-${a.id}`,
      tipo: a.tipo as string,
      tarea: a.tarea ? { id: a.tarea.id, nombre: a.tarea.nombre } : null,
      mensaje: null as string | null,
      fechaProgramada: a.fechaProgramada,
      leido: a.leido,
    }));
    const dePersonalizadas = registrosPersonalizadas.map((n) => ({
      id: `p-${n.id}`,
      tipo: n.tipo as string,
      // notificaciones_personalizadas solo guarda tareaId — el nombre de la
      // tarea sale de la misma relación que ya trae el find() de arriba
      // (igual que AlertaEnviada.tarea), no requiere una consulta aparte.
      tarea: n.tarea ? { id: n.tarea.id, nombre: n.tarea.nombre } : null,
      mensaje: n.mensaje,
      fechaProgramada: n.creadoEn,
      leido: n.leido,
    }));

    const notificaciones = [...deAlertas, ...dePersonalizadas]
      .sort((a, b) => new Date(b.fechaProgramada).getTime() - new Date(a.fechaProgramada).getTime())
      .slice(0, 100);

    return {
      notificaciones,
      noLeidas: notificaciones.filter((n) => !n.leido).length,
    };
  }

  // El id que llega aquí es el mismo id de texto ('a-<n>' / 'p-<n>') que
  // devuelve GET /notificaciones (y que emite el WebSocket) — hay que
  // separar el prefijo para saber en qué tabla vive antes de tocar nada.
  private parsearId(id: string): { fuente: 'alerta' | 'personalizada'; numerico: number } {
    const prefijo = id.slice(0, 2);
    const resto = id.slice(2);
    const numerico = Number(resto);
    if ((prefijo !== 'a-' && prefijo !== 'p-') || !Number.isInteger(numerico)) {
      throw new BadRequestException('Id de notificación inválido.');
    }
    return { fuente: prefijo === 'a-' ? 'alerta' : 'personalizada', numerico };
  }

  @Patch(':id/leido')
  async marcarLeida(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const { fuente, numerico } = this.parsearId(id);

    if (fuente === 'alerta') {
      const registro = await this.alertas.findOne({ where: { id: numerico } });
      if (!registro) throw new NotFoundException('Notificación no encontrada.');
      // Nunca confiar en el id solo: debe ser una notificación de este
      // mismo usuario, o cualquiera podría marcar como leídas las de otra
      // persona.
      if (registro.usuarioId !== user.sub) {
        throw new ForbiddenException('Esta notificación no te pertenece.');
      }
      if (!registro.leido) {
        await this.alertas.update(numerico, { leido: true });
      }
      return { ok: true };
    }

    const registro = await this.personalizadas.findOne({ where: { id: numerico } });
    if (!registro) throw new NotFoundException('Notificación no encontrada.');
    if (registro.usuarioId !== user.sub) {
      throw new ForbiddenException('Esta notificación no te pertenece.');
    }
    if (!registro.leido) {
      await this.personalizadas.update(numerico, { leido: true });
    }
    return { ok: true };
  }

  @Patch('leer-todas')
  async marcarTodasLeidas(@CurrentUser() user: JwtPayload) {
    const [resultadoAlertas, resultadoPersonalizadas] = await Promise.all([
      this.alertas.update({ usuarioId: user.sub, leido: false }, { leido: true }),
      this.personalizadas.update({ usuarioId: user.sub, leido: false }, { leido: true }),
    ]);
    return {
      ok: true,
      actualizadas: (resultadoAlertas.affected ?? 0) + (resultadoPersonalizadas.affected ?? 0),
    };
  }
}
