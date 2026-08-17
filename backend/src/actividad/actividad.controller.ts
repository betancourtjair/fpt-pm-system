import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ActividadService } from './actividad.service';
import { ComentariosService } from '../comentarios/comentarios.service';

// Bitácora de actividad (tercera ronda de mejoras, ver README sección 4):
// combina la bitácora de cambios (estatus/responsable/prioridad) con los
// comentarios existentes en una sola línea de tiempo por tarea. El alcance
// (¿puede ver esta tarea?) lo verifica ComentariosService.listar() — misma
// regla para las dos fuentes, así que no hace falta repetirla aquí.
@UseGuards(JwtAuthGuard)
@Controller()
export class ActividadController {
  constructor(
    private readonly actividad: ActividadService,
    private readonly comentarios: ComentariosService,
  ) {}

  @Get('tareas/:tareaId/actividad')
  async combinada(@Param('tareaId', ParseIntPipe) tareaId: number, @CurrentUser() user: JwtPayload) {
    const [comentarios, cambios] = await Promise.all([
      this.comentarios.listar(tareaId, user),
      this.actividad.listar(tareaId),
    ]);
    const eventos = [
      ...comentarios.map((c) => ({
        id: `com-${c.id}`,
        tipo: 'comentario' as const,
        detalle: c.texto,
        usuario: c.usuario,
        creadoEn: c.creadoEn,
        comentarioId: c.id,
      })),
      ...cambios.map((c) => ({
        id: `act-${c.id}`,
        tipo: c.tipo,
        detalle: c.detalle,
        usuario: c.usuario,
        creadoEn: c.creadoEn,
        comentarioId: null as number | null,
      })),
    ];
    eventos.sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
    return eventos;
  }
}
