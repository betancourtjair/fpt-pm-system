import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';

// Notificaciones dentro de la app (Fase 2 completa, PID sección 7):
// reutiliza alertas_enviadas — cada fila (asignación/48h/24h) YA es, por
// definición, algo que le tocaba avisarle a este usuario. A diferencia de
// /alertas (solo admin, para auditar el envío de correos), aquí cada quien
// ve únicamente sus propias notificaciones — sin @Roles, cualquier rol
// autenticado puede consultar y marcar como leídas las suyas.
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    @InjectRepository(AlertaEnviada) private readonly alertas: Repository<AlertaEnviada>,
  ) {}

  @Get()
  async listar(@CurrentUser() user: JwtPayload) {
    const registros = await this.alertas.find({
      where: { usuarioId: user.sub },
      relations: { tarea: true },
      order: { id: 'DESC' },
      take: 100,
    });
    const notificaciones = registros.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      tarea: a.tarea ? { id: a.tarea.id, nombre: a.tarea.nombre } : null,
      fechaProgramada: a.fechaProgramada,
      leido: a.leido,
    }));
    return {
      notificaciones,
      noLeidas: notificaciones.filter((n) => !n.leido).length,
    };
  }

  @Patch(':id/leido')
  async marcarLeida(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    const registro = await this.alertas.findOne({ where: { id } });
    if (!registro) throw new NotFoundException('Notificación no encontrada.');
    // Nunca confiar en el id solo: debe ser una notificación de este mismo
    // usuario, o cualquiera podría marcar como leídas las de otra persona.
    if (registro.usuarioId !== user.sub) {
      throw new ForbiddenException('Esta notificación no te pertenece.');
    }
    if (!registro.leido) {
      await this.alertas.update(id, { leido: true });
    }
    return { ok: true };
  }

  @Patch('leer-todas')
  async marcarTodasLeidas(@CurrentUser() user: JwtPayload) {
    const resultado = await this.alertas.update(
      { usuarioId: user.sub, leido: false },
      { leido: true },
    );
    return { ok: true, actualizadas: resultado.affected ?? 0 };
  }
}
