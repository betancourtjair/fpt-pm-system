import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReglaAutomatizacion } from '../entities/regla-automatizacion.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { Usuario } from '../entities/usuario.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreateReglaDto } from './dto/create-regla.dto';
import { UpdateReglaDto } from './dto/update-regla.dto';

// Estado relevante de una tarea al momento de evaluar reglas — solo lo que
// las condiciones pueden mirar (prioridad/estatus/vencida).
export interface EstadoTarea {
  estatus: string;
  prioridad: string;
  fechaFin: string;
}

// Automatizaciones configurables por el usuario (tercera ronda de mejoras,
// ver README sección 4): "si esto → entonces esto", sin un motor de reglas
// complejo. Cada regla vive dentro de un proyecto y solo dispara en la
// TRANSICIÓN hacia cumplir su condición (no en cada guardado subsecuente
// mientras la tarea siga cumpliéndola) — mismo criterio que ya usan las 2
// automatizaciones fijas de TareasService.
@Injectable()
export class AutomatizacionesService {
  constructor(
    @InjectRepository(ReglaAutomatizacion) private readonly reglas: Repository<ReglaAutomatizacion>,
    @InjectRepository(NotificacionPersonalizada) private readonly notificaciones: Repository<NotificacionPersonalizada>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly proyectosService: ProyectosService,
    private readonly eventos: EventEmitter2,
  ) {}

  private serializar(r: ReglaAutomatizacion) {
    return {
      id: r.id,
      proyectoId: r.proyectoId,
      nombre: r.nombre,
      condicionPrioridad: r.condicionPrioridad,
      condicionEstatus: r.condicionEstatus,
      condicionVencida: r.condicionVencida,
      accionTipo: r.accionTipo,
      accionUsuario: r.accionUsuario ? { id: r.accionUsuario.id, nombre: r.accionUsuario.nombre } : null,
      activa: r.activa,
      creadoEn: r.creadoEn,
    };
  }

  private validarCondiciones(dto: { condicionPrioridad?: string; condicionEstatus?: string; condicionVencida?: boolean }) {
    if (!dto.condicionPrioridad && !dto.condicionEstatus && !dto.condicionVencida) {
      throw new BadRequestException('La regla necesita al menos una condición (prioridad, estatus o vencida).');
    }
  }

  private async validarAccion(dto: { accionTipo: string; accionUsuarioId?: number }) {
    if (dto.accionTipo === 'notificar_usuario') {
      if (!dto.accionUsuarioId) {
        throw new BadRequestException('Indica a qué usuario notificar.');
      }
      const usuario = await this.usuarios.findOne({ where: { id: dto.accionUsuarioId } });
      if (!usuario) throw new NotFoundException('El usuario indicado no existe.');
    }
  }

  private async obtenerConProyecto(id: number): Promise<ReglaAutomatizacion> {
    const regla = await this.reglas.findOne({
      where: { id },
      relations: { proyecto: { areas: true }, accionUsuario: true },
    });
    if (!regla) throw new NotFoundException('Regla de automatización no encontrada.');
    return regla;
  }

  async listar(proyectoId: number, user: JwtPayload) {
    const proyecto = await this.proyectosService.obtenerEntidad(proyectoId);
    this.proyectosService.verificarPuedeGestionar(proyecto, user);
    const filas = await this.reglas.find({
      where: { proyectoId },
      relations: { accionUsuario: true },
      order: { id: 'ASC' },
    });
    return filas.map((r) => this.serializar(r));
  }

  async crear(proyectoId: number, dto: CreateReglaDto, user: JwtPayload) {
    const proyecto = await this.proyectosService.obtenerEntidad(proyectoId);
    this.proyectosService.verificarPuedeGestionar(proyecto, user);
    this.validarCondiciones(dto);
    await this.validarAccion(dto);

    const regla = this.reglas.create({
      proyectoId,
      nombre: dto.nombre,
      condicionPrioridad: dto.condicionPrioridad ?? null,
      condicionEstatus: dto.condicionEstatus ?? null,
      condicionVencida: dto.condicionVencida ?? false,
      accionTipo: dto.accionTipo,
      accionUsuarioId: dto.accionTipo === 'notificar_usuario' ? dto.accionUsuarioId! : null,
      activa: true,
      creadoPor: user.sub,
    });
    const guardada = await this.reglas.save(regla);
    return this.serializar(await this.obtenerConProyecto(guardada.id));
  }

  async actualizar(id: number, dto: UpdateReglaDto, user: JwtPayload) {
    const regla = await this.obtenerConProyecto(id);
    this.proyectosService.verificarPuedeGestionar(regla.proyecto, user);

    const condicionesFinal = {
      condicionPrioridad: dto.condicionPrioridad !== undefined ? dto.condicionPrioridad : regla.condicionPrioridad ?? undefined,
      condicionEstatus: dto.condicionEstatus !== undefined ? dto.condicionEstatus : regla.condicionEstatus ?? undefined,
      condicionVencida: dto.condicionVencida !== undefined ? dto.condicionVencida : regla.condicionVencida,
    };
    this.validarCondiciones(condicionesFinal);
    if (dto.accionTipo || dto.accionUsuarioId) {
      await this.validarAccion({
        accionTipo: dto.accionTipo ?? regla.accionTipo,
        accionUsuarioId: dto.accionUsuarioId,
      });
    }

    const cambios: Record<string, unknown> = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.condicionPrioridad !== undefined) cambios.condicionPrioridad = dto.condicionPrioridad || null;
    if (dto.condicionEstatus !== undefined) cambios.condicionEstatus = dto.condicionEstatus || null;
    if (dto.condicionVencida !== undefined) cambios.condicionVencida = dto.condicionVencida;
    if (dto.accionTipo !== undefined) cambios.accionTipo = dto.accionTipo;
    if (dto.accionTipo !== undefined || dto.accionUsuarioId !== undefined) {
      const accionTipoFinal = dto.accionTipo ?? regla.accionTipo;
      cambios.accionUsuarioId = accionTipoFinal === 'notificar_usuario' ? dto.accionUsuarioId ?? regla.accionUsuarioId : null;
    }
    if (dto.activa !== undefined) cambios.activa = dto.activa;
    if (Object.keys(cambios).length > 0) {
      await this.reglas.update(id, cambios);
    }
    return this.serializar(await this.obtenerConProyecto(id));
  }

  async eliminar(id: number, user: JwtPayload) {
    const regla = await this.obtenerConProyecto(id);
    this.proyectosService.verificarPuedeGestionar(regla.proyecto, user);
    await this.reglas.remove(regla);
    return { ok: true };
  }

  private coincide(estado: EstadoTarea, regla: ReglaAutomatizacion): boolean {
    if (regla.condicionPrioridad && estado.prioridad !== regla.condicionPrioridad) return false;
    if (regla.condicionEstatus && estado.estatus !== regla.condicionEstatus) return false;
    if (regla.condicionVencida) {
      const hoy = new Date().toISOString().slice(0, 10);
      const vencida = estado.estatus !== 'completada' && estado.fechaFin < hoy;
      if (!vencida) return false;
    }
    return true;
  }

  // Resuelve quién debe recibir el aviso de una regla — puede regresar un
  // arreglo vacío (p. ej. "notificar_director" sin ningún Director activo
  // en la Dirección dueña del proyecto).
  private async resolverDestinatarios(regla: ReglaAutomatizacion, responsableIdFinal: number | null): Promise<number[]> {
    if (regla.accionTipo === 'notificar_responsable') {
      return responsableIdFinal ? [responsableIdFinal] : [];
    }
    if (regla.accionTipo === 'notificar_usuario') {
      return regla.accionUsuarioId ? [regla.accionUsuarioId] : [];
    }
    // notificar_director — mismo criterio de resolución que
    // AlertasService.notificarTareaBloqueada: Director cuya Dirección
    // incluye alguna de las áreas del proyecto.
    const directores: { id: number; activo: boolean }[] = await this.usuarios.query(
      `SELECT DISTINCT u.id, u.activo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN areas a ON a.id = u.area_id
       WHERE r.nombre = 'director'
         AND a.direccion_id IN (
           SELECT DISTINCT a2.direccion_id FROM proyecto_areas pa
           JOIN areas a2 ON a2.id = pa.area_id
           WHERE pa.proyecto_id = $1
         )`,
      [regla.proyectoId],
    );
    return directores.filter((d) => d.activo).map((d) => d.id);
  }

  // Llamado desde TareasService después de aplicar un cambio (actualizar()
  // o actualizarAvance()) — nunca debe tronar el guardado de la tarea si
  // algo aquí falla, ver el envoltorio "SinRomper" en TareasService.
  async evaluarTransicion(
    proyectoId: number,
    tareaId: number,
    tareaNombre: string,
    responsableIdFinal: number | null,
    antes: EstadoTarea,
    despues: EstadoTarea,
  ): Promise<void> {
    const reglasActivas = await this.reglas.find({ where: { proyectoId, activa: true } });
    for (const regla of reglasActivas) {
      const coincidiaAntes = this.coincide(antes, regla);
      const coincideAhora = this.coincide(despues, regla);
      if (coincidiaAntes || !coincideAhora) continue;

      const destinatarios = await this.resolverDestinatarios(regla, responsableIdFinal);
      for (const usuarioId of destinatarios) {
        const guardada = await this.notificaciones.save(
          this.notificaciones.create({
            usuarioId,
            tipo: 'automatizacion',
            tareaId,
            mensaje: `Automatización "${regla.nombre}" se activó en la tarea "${tareaNombre}".`,
          }),
        );
        this.eventos.emit('notificacion.creada', {
          usuarioId,
          notificacion: {
            id: `p-${guardada.id}`,
            tipo: 'automatizacion',
            tareaId,
            tareaNombre,
            fechaProgramada: guardada.creadoEn,
          },
        });
      }
    }
  }
}
