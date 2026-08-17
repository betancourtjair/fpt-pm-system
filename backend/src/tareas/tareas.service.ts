import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreateTareaDto } from './dto/create-tarea.dto';
import { UpdateTareaDto, ActualizarAvanceDto } from './dto/update-tarea.dto';
import { puedeVerPresupuesto } from '../common/permisos.util';
import { AlertasService } from '../alertas/alertas.service';

const RELACIONES = {
  proyecto: true,
  responsable: true,
  dependencia: true,
  usuariosAsignados: true,
} as const;

@Injectable()
export class TareasService {
  constructor(
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    // Reutilizamos las reglas de alcance/permiso de Proyectos (PID 9.2): si
    // puedes ver o administrar un proyecto, esa misma regla aplica a sus
    // tareas — evita duplicar la lógica de alcance por rol.
    private readonly proyectos: ProyectosService,
    // Alerta "asignacion" (Fase 2, PID sección 7) — se dispara solo para
    // quien se agrega de nuevo, nunca para quien ya estaba asignado.
    private readonly alertas: AlertasService,
    // Tiempo real del Gantt (Fase 2 completa): cada creación/edición/borrado
    // de tarea emite 'tarea.cambio' y RealtimeGateway lo retransmite por
    // WebSocket a quienes estén viendo ese proyecto — desacoplado a
    // propósito, este servicio no conoce el gateway.
    private readonly eventos: EventEmitter2,
  ) {}

  // Nunca debe tronar la creación/actualización de una tarea por un
  // problema de correo (Resend caído, red, etc.) — de por sí EmailService
  // ya atrapa sus propios errores, esto es un blindaje adicional.
  private async notificarAsignacionSinRomper(tareaId: number, usuarioIds: number[]) {
    try {
      await this.alertas.notificarAsignacion(tareaId, usuarioIds);
    } catch {
      // Ya se registró en el log de AlertasService/EmailService; aquí no
      // hay nada más que hacer.
    }
  }

  private emitirCambio(proyectoId: number, tareaId: number, accion: 'creada' | 'actualizada' | 'eliminada') {
    this.eventos.emit('tarea.cambio', { proyectoId, tareaId, accion });
  }

  private serializar(tarea: Tarea, user: JwtPayload, autorizado: boolean) {
    const base: Record<string, unknown> = {
      id: tarea.id,
      proyectoId: tarea.proyectoId,
      nombre: tarea.nombre,
      fechaInicio: tarea.fechaInicio,
      fechaFin: tarea.fechaFin,
      estatus: tarea.estatus,
      porcentajeAvance: tarea.porcentajeAvance,
      responsable: tarea.responsable
        ? { id: tarea.responsable.id, nombre: tarea.responsable.nombre }
        : null,
      dependenciaId: tarea.dependenciaId,
      dependencia: tarea.dependencia
        ? { id: tarea.dependencia.id, nombre: tarea.dependencia.nombre }
        : null,
      usuariosAsignados: (tarea.usuariosAsignados ?? []).map((u) => ({
        id: u.id,
        nombre: u.nombre,
      })),
    };
    if (tarea.presupuesto !== null && puedeVerPresupuesto(user, autorizado)) {
      base.presupuesto = Number(tarea.presupuesto);
    }
    return base;
  }

  async obtenerEntidad(id: number): Promise<Tarea> {
    const tarea = await this.tareas.findOne({ where: { id }, relations: RELACIONES });
    if (!tarea) throw new NotFoundException('Tarea no encontrada.');
    return tarea;
  }

  async listar(proyectoId: number, user: JwtPayload) {
    const proyecto = await this.proyectos.obtenerEntidad(proyectoId);
    if (!(await this.proyectos.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
    }
    const tareas = await this.tareas.find({
      where: { proyectoId },
      relations: RELACIONES,
      order: { id: 'ASC' },
    });
    const autorizado = await this.proyectos.autorizacionPresupuesto(user);
    return tareas.map((t) => this.serializar(t, user, autorizado));
  }

  async obtener(id: number, user: JwtPayload) {
    const tarea = await this.obtenerEntidad(id);
    const proyecto = await this.proyectos.obtenerEntidad(tarea.proyectoId);
    if (!(await this.proyectos.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Esta tarea está fuera de tu alcance.');
    }
    const autorizado = await this.proyectos.autorizacionPresupuesto(user);
    return this.serializar(tarea, user, autorizado);
  }

  private async validarUsuarios(usuarioIds: number[]) {
    const usuarios = await this.usuarios.find({ where: { id: In(usuarioIds) } });
    if (usuarios.length !== usuarioIds.length) {
      throw new NotFoundException('Uno o más usuarios asignados no existen.');
    }
  }

  // Mejora funcional (PID: validación de fechas y dependencias): antes solo
  // se checaba auto-referencia y mismo proyecto — ni la fecha propia de la
  // tarea ni una dependencia circular indirecta (A depende de B, B depende
  // de A, directa o a través de una cadena) quedaban cubiertas.
  private validarFechas(fechaInicio: string, fechaFin: string) {
    if (fechaInicio > fechaFin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
  }

  private async validarDependencia(
    proyectoId: number,
    dependenciaId: number,
    fechaInicioTarea: string,
    tareaId?: number,
  ) {
    if (dependenciaId === tareaId) {
      throw new BadRequestException('Una tarea no puede depender de sí misma.');
    }
    const predecesora = await this.tareas.findOne({ where: { id: dependenciaId } });
    if (!predecesora || predecesora.proyectoId !== proyectoId) {
      throw new BadRequestException('La tarea predecesora debe pertenecer al mismo proyecto.');
    }
    // Consistencia de fechas (comentario original del entity ya lo decía:
    // "esta tarea no puede iniciar hasta que termine su predecesora" — pero
    // nunca se validaba). Comparación lexicográfica válida: ambas son
    // columnas DATE en formato 'YYYY-MM-DD'.
    if (predecesora.fechaFin > fechaInicioTarea) {
      throw new BadRequestException(
        'Esta tarea no puede iniciar antes de que termine su tarea predecesora.',
      );
    }

    // Ciclo de dependencias (directo o en cadena): si al recorrer la cadena
    // de predecesoras desde `predecesora` llegamos de nuevo a `tareaId`,
    // asignar esta dependencia dejaría dos tareas esperándose mutuamente.
    // Solo aplica al editar — una tarea recién creada no puede aparecer
    // todavía en ninguna cadena existente.
    if (tareaId !== undefined) {
      let actual: Tarea | null = predecesora;
      const visitadas = new Set<number>();
      while (actual && !visitadas.has(actual.id)) {
        if (actual.id === tareaId) {
          throw new BadRequestException(
            'Esta dependencia crearía un ciclo entre tareas (dependencia circular).',
          );
        }
        visitadas.add(actual.id);
        actual = actual.dependenciaId
          ? await this.tareas.findOne({ where: { id: actual.dependenciaId } })
          : null;
      }
    }
  }

  private async asignarUsuarios(tareaId: number, usuarioIds: number[]) {
    await this.tareas.query(`DELETE FROM tarea_usuarios WHERE tarea_id = $1`, [tareaId]);
    for (const usuarioId of usuarioIds) {
      await this.tareas.query(
        `INSERT INTO tarea_usuarios (tarea_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [tareaId, usuarioId],
      );
    }
  }

  async crear(proyectoId: number, dto: CreateTareaDto, user: JwtPayload) {
    const proyecto = await this.proyectos.obtenerEntidad(proyectoId);
    // Crear/administrar tareas completas requiere manage_projects sobre el
    // proyecto padre (mismo control que administrar el proyecto) — el
    // permiso manage_tasks de un colaborador solo habilita su propio avance,
    // ver TareasService.actualizarAvance.
    this.proyectos.verificarPuedeGestionar(proyecto, user);

    const responsable = await this.usuarios.findOne({ where: { id: dto.responsableId } });
    if (!responsable) throw new NotFoundException('El responsable indicado no existe.');
    if (dto.usuarioIds?.length) await this.validarUsuarios(dto.usuarioIds);
    this.validarFechas(dto.fechaInicio, dto.fechaFin);
    if (dto.dependenciaId !== undefined) {
      await this.validarDependencia(proyectoId, dto.dependenciaId, dto.fechaInicio);
    }

    const tarea = this.tareas.create({
      proyectoId,
      nombre: dto.nombre,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      presupuesto: dto.presupuesto !== undefined ? String(dto.presupuesto) : null,
      responsableId: dto.responsableId,
      dependenciaId: dto.dependenciaId ?? null,
    });
    const guardada = await this.tareas.save(tarea);
    if (dto.usuarioIds?.length) await this.asignarUsuarios(guardada.id, dto.usuarioIds);

    // Alerta "asignacion" (Fase 2): todos los que quedan asignados desde
    // el arranque (responsable + usuariosAsignados) reciben el correo.
    const asignadosIniciales = [dto.responsableId, ...(dto.usuarioIds ?? [])].filter(
      (id): id is number => Boolean(id),
    );
    await this.notificarAsignacionSinRomper(guardada.id, asignadosIniciales);
    this.emitirCambio(proyectoId, guardada.id, 'creada');

    return this.obtener(guardada.id, user);
  }

  async actualizar(id: number, dto: UpdateTareaDto, user: JwtPayload) {
    const tarea = await this.obtenerEntidad(id);
    const proyecto = await this.proyectos.obtenerEntidad(tarea.proyectoId);
    this.proyectos.verificarPuedeGestionar(proyecto, user);

    // Alerta "asignacion" (Fase 2): se calcula quién estaba asignado ANTES
    // de tocar nada, para más abajo poder avisarle solo a quien se agrega
    // de nuevo (nunca a quien ya estaba, ver AlertasService).
    const asignadosAntes = new Set<number>(
      [tarea.responsableId, ...(tarea.usuariosAsignados ?? []).map((u) => u.id)].filter(
        (v): v is number => Boolean(v),
      ),
    );

    if (dto.responsableId) {
      const responsable = await this.usuarios.findOne({ where: { id: dto.responsableId } });
      if (!responsable) throw new NotFoundException('El responsable indicado no existe.');
    }
    if (dto.usuarioIds) {
      await this.validarUsuarios(dto.usuarioIds);
      await this.asignarUsuarios(id, dto.usuarioIds);
    }

    // Fechas finales resultantes (propia si no cambia, o la nueva del dto)
    // — se validan si se toca cualquiera de las dos fechas o la dependencia,
    // para nunca dejar la tarea en un estado inconsistente.
    const fechaInicioFinal = dto.fechaInicio ?? tarea.fechaInicio;
    const fechaFinFinal = dto.fechaFin ?? tarea.fechaFin;
    if (dto.fechaInicio !== undefined || dto.fechaFin !== undefined) {
      this.validarFechas(fechaInicioFinal, fechaFinFinal);
    }
    // Si cambia la dependencia, o solo cambia fechaInicio pero la tarea ya
    // tenía una predecesora, hay que re-checar contra ella (podría quedar
    // iniciando antes de que termine, aunque la dependencia en sí no haya
    // cambiado).
    const dependenciaIdFinal = dto.dependenciaId !== undefined ? dto.dependenciaId : tarea.dependenciaId;
    if (dependenciaIdFinal !== null && (dto.dependenciaId !== undefined || dto.fechaInicio !== undefined)) {
      await this.validarDependencia(tarea.proyectoId, dependenciaIdFinal, fechaInicioFinal, id);
    }

    // IMPORTANTE: UPDATE dirigido, no tarea.save() — `tarea` se cargó con
    // las relaciones responsable/dependencia ya resueltas; si se reasigna
    // solo la columna escalar y se guarda la entidad completa, TypeORM
    // puede preferir el objeto de relación viejo que sigue en memoria y el
    // cambio se pierde en silencio (mismo caso que ProyectosService).
    const cambios: Record<string, unknown> = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.fechaInicio !== undefined) cambios.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin !== undefined) cambios.fechaFin = dto.fechaFin;
    if (dto.presupuesto !== undefined) cambios.presupuesto = String(dto.presupuesto);
    if (dto.estatus !== undefined) cambios.estatus = dto.estatus;
    if (dto.porcentajeAvance !== undefined) cambios.porcentajeAvance = dto.porcentajeAvance;
    if (dto.responsableId !== undefined) cambios.responsableId = dto.responsableId;
    if (dto.dependenciaId !== undefined) cambios.dependenciaId = dto.dependenciaId;
    if (Object.keys(cambios).length > 0) {
      await this.tareas.update(id, cambios);
    }

    // Alerta "asignacion": responsable final (si cambió) + usuarios
    // asignados finales (si dto.usuarioIds vino, o los mismos de antes si
    // no), menos quien ya estaba en asignadosAntes.
    const responsableFinal = dto.responsableId !== undefined ? dto.responsableId : tarea.responsableId;
    const usuariosFinales = dto.usuarioIds ?? (tarea.usuariosAsignados ?? []).map((u) => u.id);
    const asignadosDespues = [responsableFinal, ...usuariosFinales].filter(
      (v): v is number => Boolean(v),
    );
    const nuevosAsignados = [...new Set(asignadosDespues)].filter((v) => !asignadosAntes.has(v));
    if (nuevosAsignados.length > 0) {
      await this.notificarAsignacionSinRomper(id, nuevosAsignados);
    }
    this.emitirCambio(tarea.proyectoId, id, 'actualizada');

    return this.obtener(id, user);
  }

  // Ruta restringida de autoservicio (PID 9.2): un colaborador asignado a la
  // tarea puede actualizar su propio avance sin necesitar manage_projects.
  async actualizarAvance(id: number, dto: ActualizarAvanceDto, user: JwtPayload) {
    const tarea = await this.obtenerEntidad(id);
    const esAsignado =
      tarea.responsableId === user.sub ||
      (tarea.usuariosAsignados ?? []).some((u) => u.id === user.sub);
    if (!esAsignado) {
      throw new ForbiddenException('Solo puedes actualizar el avance de tareas asignadas a ti.');
    }
    if (dto.estatus !== undefined) tarea.estatus = dto.estatus;
    if (dto.porcentajeAvance !== undefined) tarea.porcentajeAvance = dto.porcentajeAvance;
    await this.tareas.save(tarea);
    this.emitirCambio(tarea.proyectoId, id, 'actualizada');
    return this.obtener(id, user);
  }

  async eliminar(id: number, user: JwtPayload) {
    const tarea = await this.obtenerEntidad(id);
    const proyecto = await this.proyectos.obtenerEntidad(tarea.proyectoId);
    this.proyectos.verificarPuedeGestionar(proyecto, user);

    // Ninguna otra tarea debe quedar apuntando a una dependencia eliminada.
    await this.tareas.query(`UPDATE tareas SET dependencia_id = NULL WHERE dependencia_id = $1`, [id]);
    await this.tareas.query(`DELETE FROM tarea_usuarios WHERE tarea_id = $1`, [id]);
    await this.tareas.remove(tarea);
    this.emitirCambio(tarea.proyectoId, id, 'eliminada');
    return { ok: true };
  }
}
