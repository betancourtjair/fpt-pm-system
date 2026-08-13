import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Proyecto } from '../entities/proyecto.entity';
import { Area } from '../entities/area.entity';
import { Usuario } from '../entities/usuario.entity';
import { JwtPayload } from '../auth/auth.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import {
  esAdmin,
  esDirector,
  esGerenteArea,
  puedeGestionarProyectos,
  puedeVerPresupuesto,
} from '../common/permisos.util';

const RELACIONES = { areas: true, responsable: true, creador: true } as const;

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Area) private readonly areas: Repository<Area>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  // ------------------------------------------------------------------
  // Alcance por rol (PID sección 9.2): admin ve todo; director ve los
  // proyectos de su Dirección; gerente_area los de su Área; colaborador
  // solo los proyectos donde tiene una tarea asignada o es responsable.
  // ------------------------------------------------------------------
  private async idsEnAlcance(user: JwtPayload): Promise<number[] | 'all'> {
    if (esAdmin(user)) return 'all';

    if (esDirector(user)) {
      const rows: { proyecto_id: number }[] = await this.proyectos.query(
        `SELECT DISTINCT pa.proyecto_id FROM proyecto_areas pa
         JOIN areas a ON a.id = pa.area_id
         WHERE a.direccion_id = $1`,
        [user.direccionId],
      );
      return rows.map((r) => r.proyecto_id);
    }

    if (esGerenteArea(user)) {
      const rows: { proyecto_id: number }[] = await this.proyectos.query(
        `SELECT DISTINCT proyecto_id FROM proyecto_areas WHERE area_id = $1`,
        [user.areaId],
      );
      return rows.map((r) => r.proyecto_id);
    }

    // colaborador
    const rows: { proyecto_id: number }[] = await this.proyectos.query(
      `SELECT DISTINCT t.proyecto_id FROM tareas t
       LEFT JOIN tarea_usuarios tu ON tu.tarea_id = t.id
       WHERE tu.usuario_id = $1 OR t.responsable_id = $1`,
      [user.sub],
    );
    return rows.map((r) => r.proyecto_id);
  }

  async puedeVer(proyecto: Proyecto, user: JwtPayload): Promise<boolean> {
    if (esAdmin(user)) return true;
    if (esDirector(user)) return proyecto.areas.some((a) => a.direccionId === user.direccionId);
    if (esGerenteArea(user)) return proyecto.areas.some((a) => a.id === user.areaId);
    const ids = await this.idsEnAlcance(user);
    return ids !== 'all' && ids.includes(proyecto.id);
  }

  verificarPuedeGestionar(proyecto: Proyecto, user: JwtPayload): void {
    if (!puedeGestionarProyectos(user)) {
      throw new ForbiddenException('Tu rol no puede administrar proyectos.');
    }
    if (esAdmin(user)) return;
    if (esDirector(user) && proyecto.areas.some((a) => a.direccionId === user.direccionId)) return;
    if (esGerenteArea(user) && proyecto.areas.some((a) => a.id === user.areaId)) return;
    throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
  }

  // Público: TareasService lo reutiliza para no duplicar la consulta a BD
  // (el flag es mutable en cualquier momento, nunca se confía en el JWT).
  async autorizacionPresupuesto(user: JwtPayload): Promise<boolean> {
    if (!esGerenteArea(user)) return false;
    const yo = await this.usuarios.findOne({ where: { id: user.sub } });
    return yo?.verPresupuestoAutorizado ?? false;
  }

  private serializar(proyecto: Proyecto, user: JwtPayload, autorizado: boolean) {
    const base: Record<string, unknown> = {
      id: proyecto.id,
      nombre: proyecto.nombre,
      fechaInicio: proyecto.fechaInicio,
      fechaFin: proyecto.fechaFin,
      estatus: proyecto.estatus,
      responsable: proyecto.responsable
        ? { id: proyecto.responsable.id, nombre: proyecto.responsable.nombre }
        : null,
      creador: proyecto.creador
        ? { id: proyecto.creador.id, nombre: proyecto.creador.nombre }
        : null,
      areas: (proyecto.areas ?? []).map((a) => ({
        id: a.id,
        nombre: a.nombre,
        direccionId: a.direccionId,
      })),
    };
    if (puedeVerPresupuesto(user, autorizado)) {
      base.presupuesto = Number(proyecto.presupuesto);
    }
    return base;
  }

  async listar(user: JwtPayload) {
    const ids = await this.idsEnAlcance(user);
    if (ids !== 'all' && ids.length === 0) return [];

    const proyectos = await this.proyectos.find({
      where: ids === 'all' ? {} : { id: In(ids) },
      relations: RELACIONES,
      order: { id: 'ASC' },
    });
    const autorizado = await this.autorizacionPresupuesto(user);
    return proyectos.map((p) => this.serializar(p, user, autorizado));
  }

  async obtenerEntidad(id: number): Promise<Proyecto> {
    const proyecto = await this.proyectos.findOne({ where: { id }, relations: RELACIONES });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado.');
    return proyecto;
  }

  async obtener(id: number, user: JwtPayload) {
    const proyecto = await this.obtenerEntidad(id);
    if (!(await this.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
    }
    const autorizado = await this.autorizacionPresupuesto(user);
    return this.serializar(proyecto, user, autorizado);
  }

  private async validarAreasEnAlcance(areaIds: number[], user: JwtPayload) {
    const areas = await this.areas.find({ where: { id: In(areaIds) } });
    if (areas.length !== areaIds.length) {
      throw new NotFoundException('Una o más áreas no existen.');
    }
    if (esAdmin(user)) return;
    if (esDirector(user)) {
      const fuera = areas.some((a) => a.direccionId !== user.direccionId);
      if (fuera) throw new ForbiddenException('Solo puedes asignar áreas de tu propia Dirección.');
      return;
    }
    if (esGerenteArea(user)) {
      const soloSuArea = areaIds.length === 1 && areaIds[0] === user.areaId;
      if (!soloSuArea) throw new ForbiddenException('Solo puedes asignar tu propia Área.');
      return;
    }
    throw new ForbiddenException('Tu rol no puede administrar proyectos.');
  }

  private async asignarAreas(proyectoId: number, areaIds: number[]) {
    await this.proyectos.query(`DELETE FROM proyecto_areas WHERE proyecto_id = $1`, [proyectoId]);
    for (const areaId of areaIds) {
      await this.proyectos.query(
        `INSERT INTO proyecto_areas (proyecto_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [proyectoId, areaId],
      );
    }
  }

  async crear(dto: CreateProyectoDto, user: JwtPayload) {
    if (!puedeGestionarProyectos(user)) {
      throw new ForbiddenException('Tu rol no puede crear proyectos.');
    }
    await this.validarAreasEnAlcance(dto.areaIds, user);

    const responsable = await this.usuarios.findOne({ where: { id: dto.responsableId } });
    if (!responsable) throw new NotFoundException('El responsable indicado no existe.');

    const proyecto = this.proyectos.create({
      nombre: dto.nombre,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      presupuesto: String(dto.presupuesto),
      estatus: dto.estatus ?? 'no_iniciado',
      responsableId: dto.responsableId,
      creadoPor: user.sub,
    });
    const guardado = await this.proyectos.save(proyecto);
    await this.asignarAreas(guardado.id, dto.areaIds);
    return this.obtener(guardado.id, user);
  }

  async actualizar(id: number, dto: UpdateProyectoDto, user: JwtPayload) {
    const proyecto = await this.obtenerEntidad(id);
    this.verificarPuedeGestionar(proyecto, user);

    if (dto.areaIds) {
      await this.validarAreasEnAlcance(dto.areaIds, user);
      await this.asignarAreas(id, dto.areaIds);
    }
    if (dto.responsableId) {
      const responsable = await this.usuarios.findOne({ where: { id: dto.responsableId } });
      if (!responsable) throw new NotFoundException('El responsable indicado no existe.');
    }

    Object.assign(proyecto, {
      nombre: dto.nombre ?? proyecto.nombre,
      fechaInicio: dto.fechaInicio ?? proyecto.fechaInicio,
      fechaFin: dto.fechaFin ?? proyecto.fechaFin,
      presupuesto: dto.presupuesto !== undefined ? String(dto.presupuesto) : proyecto.presupuesto,
      estatus: dto.estatus ?? proyecto.estatus,
      responsableId: dto.responsableId ?? proyecto.responsableId,
    });
    await this.proyectos.save(proyecto);
    return this.obtener(id, user);
  }

  async eliminar(id: number, user: JwtPayload) {
    if (!esAdmin(user)) {
      throw new ForbiddenException('Solo un administrador puede eliminar proyectos.');
    }
    const proyecto = await this.obtenerEntidad(id);
    await this.proyectos.query(`DELETE FROM tarea_usuarios WHERE tarea_id IN (SELECT id FROM tareas WHERE proyecto_id = $1)`, [id]);
    await this.proyectos.query(`DELETE FROM tareas WHERE proyecto_id = $1`, [id]);
    await this.proyectos.query(`DELETE FROM proyecto_areas WHERE proyecto_id = $1`, [id]);
    await this.proyectos.remove(proyecto);
    return { ok: true };
  }
}
