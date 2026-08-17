import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComentarioTarea } from '../entities/comentario-tarea.entity';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';

// Comentarios por tarea (mejora sugerida, ver README sección 4): mismo
// alcance que ArchivosService — ver/comentar exige poder VER el proyecto
// (cualquier colaborador dentro del alcance), borrar exige ser quien lo
// escribió o poder administrar el proyecto.
@Injectable()
export class ComentariosService {
  constructor(
    @InjectRepository(ComentarioTarea) private readonly comentarios: Repository<ComentarioTarea>,
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
    private readonly eventos: EventEmitter2,
  ) {}

  private async tareaEnAlcance(tareaId: number, user: JwtPayload) {
    const tarea = await this.tareas.findOne({ where: { id: tareaId } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada.');
    const proyecto = await this.proyectosService.obtenerEntidad(tarea.proyectoId);
    if (!(await this.proyectosService.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Esta tarea está fuera de tu alcance.');
    }
    return { tarea, proyecto };
  }

  private serializar(c: ComentarioTarea) {
    return {
      id: c.id,
      tareaId: c.tareaId,
      texto: c.texto,
      creadoEn: c.creadoEn,
      usuario: c.usuario ? { id: c.usuario.id, nombre: c.usuario.nombre } : null,
    };
  }

  async listar(tareaId: number, user: JwtPayload) {
    await this.tareaEnAlcance(tareaId, user);
    const filas = await this.comentarios.find({
      where: { tareaId },
      relations: { usuario: true },
      order: { creadoEn: 'ASC' },
    });
    return filas.map((f) => this.serializar(f));
  }

  async crear(tareaId: number, dto: CreateComentarioDto, user: JwtPayload) {
    const { tarea } = await this.tareaEnAlcance(tareaId, user);
    const registro = this.comentarios.create({
      tareaId,
      usuarioId: user.sub,
      texto: dto.texto,
      creadoEn: new Date(),
    });
    await this.comentarios.save(registro);
    // Reutiliza el mismo evento de tiempo real que ya escucha el Gantt —
    // así una nota nueva también refresca a quien tenga el proyecto abierto.
    this.eventos.emit('tarea.cambio', { proyectoId: tarea.proyectoId, tareaId, accion: 'comentada' });
    return this.listar(tareaId, user);
  }

  async eliminar(comentarioId: number, user: JwtPayload) {
    const comentario = await this.comentarios.findOne({ where: { id: comentarioId } });
    if (!comentario) throw new NotFoundException('Comentario no encontrado.');
    const { tarea, proyecto } = await this.tareaEnAlcance(comentario.tareaId, user);
    const esQuienEscribio = comentario.usuarioId === user.sub;
    if (!esQuienEscribio) {
      this.proyectosService.verificarPuedeGestionar(proyecto, user);
    }
    await this.comentarios.remove(comentario);
    this.eventos.emit('tarea.cambio', { proyectoId: tarea.proyectoId, tareaId: tarea.id, accion: 'comentada' });
    return { ok: true };
  }
}
