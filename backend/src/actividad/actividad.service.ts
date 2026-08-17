import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActividadTarea, TipoActividad } from '../entities/actividad-tarea.entity';

// Bitácora de actividad por tarea (tercera ronda de mejoras, ver README
// sección 4): registra cambios de estatus/responsable/prioridad para
// combinarlos con los comentarios en una sola pestaña "Actividad" (ver
// ActividadController.combinada). registrar() nunca lanza — se llama desde
// varios puntos de TareasService y jamás debe tronar el guardado real de la
// tarea por un problema de bitácora.
@Injectable()
export class ActividadService {
  private readonly logger = new Logger(ActividadService.name);

  constructor(@InjectRepository(ActividadTarea) private readonly actividad: Repository<ActividadTarea>) {}

  async registrar(tareaId: number, usuarioId: number | null, tipo: TipoActividad, detalle: string): Promise<void> {
    try {
      await this.actividad.save(this.actividad.create({ tareaId, usuarioId, tipo, detalle }));
    } catch (error) {
      this.logger.warn(`No se pudo registrar actividad de la tarea ${tareaId}: ${error}`);
    }
  }

  private serializar(a: ActividadTarea) {
    return {
      id: a.id,
      tareaId: a.tareaId,
      tipo: a.tipo,
      detalle: a.detalle,
      creadoEn: a.creadoEn,
      usuario: a.usuario ? { id: a.usuario.id, nombre: a.usuario.nombre } : null,
    };
  }

  // El alcance (¿puede ver esta tarea?) ya lo valida ActividadController
  // antes de llamar aquí — mismo patrón que ComentariosService.
  async listar(tareaId: number) {
    const filas = await this.actividad.find({
      where: { tareaId },
      relations: { usuario: true },
      order: { creadoEn: 'ASC' },
    });
    return filas.map((f) => this.serializar(f));
  }
}
