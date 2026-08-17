import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlantillaChecklist } from '../entities/plantilla-checklist.entity';
import { PlantillaChecklistItem } from '../entities/plantilla-checklist-item.entity';
import { SubtareaChecklist } from '../entities/subtarea-checklist.entity';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';

// Plantillas de checklist reutilizables (cuarta ronda de mejoras, ver
// README sección 4): compartidas en toda la organización — cualquier
// usuario autenticado puede crear una y aplicarla a cualquier tarea sobre
// la que pueda administrar (misma regla que crear un ítem de checklist a
// mano en SubtareasService). Borrar una plantilla es solo de quien la creó
// o de un admin, para no dejar que cualquiera borre plantillas de otros.
@Injectable()
export class PlantillasChecklistService {
  constructor(
    @InjectRepository(PlantillaChecklist) private readonly plantillas: Repository<PlantillaChecklist>,
    @InjectRepository(PlantillaChecklistItem) private readonly items: Repository<PlantillaChecklistItem>,
    @InjectRepository(SubtareaChecklist) private readonly subtareas: Repository<SubtareaChecklist>,
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
  ) {}

  private async serializar(p: PlantillaChecklist) {
    const items = await this.items.find({ where: { plantillaId: p.id }, order: { orden: 'ASC', id: 'ASC' } });
    return {
      id: p.id,
      nombre: p.nombre,
      creador: p.creador ? { id: p.creador.id, nombre: p.creador.nombre } : null,
      creadoEn: p.creadoEn,
      items: items.map((i) => ({ id: i.id, texto: i.texto })),
    };
  }

  async listar() {
    const filas = await this.plantillas.find({ relations: { creador: true }, order: { nombre: 'ASC' } });
    return Promise.all(filas.map((p) => this.serializar(p)));
  }

  async crear(dto: CreatePlantillaDto, user: JwtPayload) {
    const guardada = await this.plantillas.save(
      this.plantillas.create({ nombre: dto.nombre, creadoPor: user.sub }),
    );
    let orden = 0;
    for (const texto of dto.items) {
      await this.items.save(this.items.create({ plantillaId: guardada.id, texto, orden: orden++ }));
    }
    return this.listar();
  }

  async eliminar(id: number, user: JwtPayload) {
    const plantilla = await this.plantillas.findOne({ where: { id } });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada.');
    if (plantilla.creadoPor !== user.sub && user.rol !== 'admin') {
      throw new ForbiddenException('Solo quien creó esta plantilla (o un admin) puede eliminarla.');
    }
    await this.plantillas.remove(plantilla);
    return this.listar();
  }

  // Convierte cada ítem de la plantilla en una fila nueva de
  // subtareas_checklist para `tareaId` — mismo criterio de permiso que
  // agregar un ítem a mano (SubtareasService.crear: puede administrar el
  // proyecto de esa tarea).
  async aplicarATarea(plantillaId: number, tareaId: number, user: JwtPayload) {
    const plantilla = await this.plantillas.findOne({ where: { id: plantillaId } });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada.');
    const tarea = await this.tareas.findOne({ where: { id: tareaId } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada.');
    const proyecto = await this.proyectosService.obtenerEntidad(tarea.proyectoId);
    this.proyectosService.verificarPuedeGestionar(proyecto, user);

    const items = await this.items.find({ where: { plantillaId }, order: { orden: 'ASC', id: 'ASC' } });
    let orden = await this.subtareas.count({ where: { tareaId } });
    for (const item of items) {
      await this.subtareas.save(
        this.subtareas.create({ tareaId, texto: item.texto, completada: false, orden: orden++ }),
      );
    }
    const filas = await this.subtareas.find({ where: { tareaId }, order: { orden: 'ASC', id: 'ASC' } });
    return filas.map((s) => ({ id: s.id, tareaId: s.tareaId, texto: s.texto, completada: s.completada, orden: s.orden }));
  }
}
