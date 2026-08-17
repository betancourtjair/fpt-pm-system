import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubtareaChecklist } from '../entities/subtarea-checklist.entity';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreateSubtareaDto } from './dto/create-subtarea.dto';
import { UpdateSubtareaDto } from './dto/update-subtarea.dto';

// Subtareas / checklist (tercera ronda de mejoras, ver README sección 4):
// pasos chicos dentro de una tarea. Ver el checklist exige poder ver la
// tarea (cualquier colaborador dentro del alcance, igual que Comentarios);
// agregar/editar el texto o borrar exige poder administrar el proyecto —
// marcar/desmarcar "completada" también lo puede hacer quien esté asignado
// a la tarea (mismo criterio de autoservicio que actualizarAvance).
@Injectable()
export class SubtareasService {
  constructor(
    @InjectRepository(SubtareaChecklist) private readonly subtareas: Repository<SubtareaChecklist>,
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
  ) {}

  private async tareaEnAlcance(tareaId: number, user: JwtPayload) {
    const tarea = await this.tareas.findOne({ where: { id: tareaId }, relations: { usuariosAsignados: true } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada.');
    const proyecto = await this.proyectosService.obtenerEntidad(tarea.proyectoId);
    if (!(await this.proyectosService.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Esta tarea está fuera de tu alcance.');
    }
    return { tarea, proyecto };
  }

  private esAsignado(tarea: Tarea, user: JwtPayload): boolean {
    return tarea.responsableId === user.sub || (tarea.usuariosAsignados ?? []).some((u) => u.id === user.sub);
  }

  private serializar(s: SubtareaChecklist) {
    return { id: s.id, tareaId: s.tareaId, texto: s.texto, completada: s.completada, orden: s.orden };
  }

  async listar(tareaId: number, user: JwtPayload) {
    await this.tareaEnAlcance(tareaId, user);
    const filas = await this.subtareas.find({ where: { tareaId }, order: { orden: 'ASC', id: 'ASC' } });
    return filas.map((f) => this.serializar(f));
  }

  async crear(tareaId: number, dto: CreateSubtareaDto, user: JwtPayload) {
    const { tarea, proyecto } = await this.tareaEnAlcance(tareaId, user);
    this.proyectosService.verificarPuedeGestionar(proyecto, user);
    const total = await this.subtareas.count({ where: { tareaId } });
    const guardada = await this.subtareas.save(
      this.subtareas.create({ tareaId, texto: dto.texto, completada: false, orden: total }),
    );
    void tarea;
    return this.listar(tareaId, user);
  }

  async actualizar(id: number, dto: UpdateSubtareaDto, user: JwtPayload) {
    const subtarea = await this.subtareas.findOne({ where: { id } });
    if (!subtarea) throw new NotFoundException('Subtarea no encontrada.');
    const { tarea, proyecto } = await this.tareaEnAlcance(subtarea.tareaId, user);

    if (dto.texto !== undefined) {
      this.proyectosService.verificarPuedeGestionar(proyecto, user);
    }
    if (dto.completada !== undefined) {
      const puedeMarcar = this.esAsignado(tarea, user) || (await this.puedeGestionarSinLanzar(proyecto, user));
      if (!puedeMarcar) {
        throw new ForbiddenException('Solo quien está asignado a esta tarea (o puede administrar el proyecto) puede marcar este paso.');
      }
    }

    const cambios: Record<string, unknown> = {};
    if (dto.texto !== undefined) cambios.texto = dto.texto;
    if (dto.completada !== undefined) cambios.completada = dto.completada;
    if (Object.keys(cambios).length > 0) {
      await this.subtareas.update(id, cambios);
    }
    return this.listar(subtarea.tareaId, user);
  }

  private async puedeGestionarSinLanzar(proyecto: Awaited<ReturnType<ProyectosService['obtenerEntidad']>>, user: JwtPayload): Promise<boolean> {
    try {
      this.proyectosService.verificarPuedeGestionar(proyecto, user);
      return true;
    } catch {
      return false;
    }
  }

  async eliminar(id: number, user: JwtPayload) {
    const subtarea = await this.subtareas.findOne({ where: { id } });
    if (!subtarea) throw new NotFoundException('Subtarea no encontrada.');
    const { proyecto } = await this.tareaEnAlcance(subtarea.tareaId, user);
    this.proyectosService.verificarPuedeGestionar(proyecto, user);
    await this.subtareas.remove(subtarea);
    return this.listar(subtarea.tareaId, user);
  }
}
