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
import { ReasignarMasivoDto } from './dto/reasignar-masivo.dto';
import { puedeVerPresupuesto } from '../common/permisos.util';
import { AlertasService } from '../alertas/alertas.service';
import { generarExcelTareas } from '../common/excel-export.util';
import { AutomatizacionesService } from '../automatizaciones/automatizaciones.service';
import { ActividadService } from '../actividad/actividad.service';

const RELACIONES = {
  proyecto: true,
  responsable: true,
  dependencias: true,
  usuariosAsignados: true,
} as const;

// Duración en días de cada tipo de recurrencia (cuarta ronda de mejoras) —
// "mensual" se resuelve aparte porque sumar días fijos no respeta meses de
// distinta longitud (ver generarSiguienteOcurrencia).
const DIAS_POR_TIPO_RECURRENCIA: Record<string, number> = {
  diaria: 1,
  semanal: 7,
};

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
    // Automatizaciones configurables por el usuario (tercera ronda de
    // mejoras, ver README sección 4) — se evalúan además de las 2 reglas
    // fijas de aplicarAutomatizaciones() más abajo.
    private readonly automatizaciones: AutomatizacionesService,
    // Bitácora de actividad (tercera ronda de mejoras) — registra cada
    // cambio de estatus/responsable/prioridad para la pestaña "Actividad".
    private readonly actividad: ActividadService,
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

  // Automatización simple #2 (mejora sugerida, ver README sección 4): igual
  // blindaje que notificarAsignacionSinRomper — un correo caído nunca debe
  // tronar la actualización de la tarea en sí.
  private async notificarBloqueoSinRomper(tareaId: number) {
    try {
      await this.alertas.notificarTareaBloqueada(tareaId);
    } catch {
      // Ya se registró en el log de AlertasService/EmailService.
    }
  }

  // Automatizaciones configurables (tercera ronda de mejoras): igual
  // blindaje que las notificaciones fijas — una regla mal configurada o un
  // error de red nunca debe tronar el guardado de la tarea en sí.
  private async evaluarAutomatizacionesSinRomper(
    proyectoId: number,
    tareaId: number,
    tareaNombre: string,
    responsableIdFinal: number | null,
    antes: { estatus: string; prioridad: string; fechaFin: string },
    despues: { estatus: string; prioridad: string; fechaFin: string },
  ) {
    try {
      await this.automatizaciones.evaluarTransicion(proyectoId, tareaId, tareaNombre, responsableIdFinal, antes, despues);
    } catch {
      // Sin log adicional aquí a propósito: AutomatizacionesService no
      // lanza en condiciones normales (todas sus validaciones viven en
      // crear/actualizar, no en evaluarTransicion) — esto es solo blindaje.
    }
  }

  private emitirCambio(proyectoId: number, tareaId: number, accion: 'creada' | 'actualizada' | 'eliminada') {
    this.eventos.emit('tarea.cambio', { proyectoId, tareaId, accion });
  }

  // Tareas recurrentes (cuarta ronda de mejoras, ver README sección 4) —
  // corregido a partir de un caso reportado por el usuario: antes, la
  // siguiente ocurrencia solo se generaba hasta que la actual se marcaba
  // "completada" (así que una tarea recurrente recién creada no se veía
  // "calendarizada" en el Gantt/calendario, solo existía la primera fecha).
  // Ahora, al crear una tarea con recurrencia activa, se generan de una vez
  // TODAS las ocurrencias futuras (mensual/semanal/diaria según el tipo),
  // desde la fecha de la tarea base hasta la fecha de fin del proyecto
  // padre — así queda calendarizada por completo desde el día uno, sin
  // depender de que alguien vaya completando una por una. Nunca debe tronar
  // el guardado de la tarea base — mismo criterio que el resto de los
  // "...SinRomper" de este servicio.
  private async generarSerieRecurrenteSinRomper(tareaBase: Tarea, proyectoFechaFin: string) {
    if (!tareaBase.recurrenciaTipo || tareaBase.recurrenciaActiva === false) return;
    try {
      // Blindaje: nunca generar una serie descontrolada (ej. recurrencia
      // diaria sobre un proyecto de varios años) — 200 ocurrencias futuras
      // alcanzan de sobra para cualquier caso real y evitan un aluvión de
      // filas de un solo request.
      const TOPE_OCURRENCIAS = 200;
      const intervalo = tareaBase.recurrenciaIntervalo || 1;

      const asignados: { usuario_id: number }[] = await this.tareas.query(
        `SELECT usuario_id FROM tarea_usuarios WHERE tarea_id = $1`,
        [tareaBase.id],
      );

      let fechaInicioActual = tareaBase.fechaInicio;
      let fechaFinActual = tareaBase.fechaFin;
      for (let i = 0; i < TOPE_OCURRENCIAS; i++) {
        const fechaInicioNueva = this.desplazarPorRecurrencia(
          fechaInicioActual,
          tareaBase.recurrenciaTipo,
          intervalo,
        );
        const fechaFinNueva = this.desplazarPorRecurrencia(fechaFinActual, tareaBase.recurrenciaTipo, intervalo);
        // Tope real de la serie: no seguir generando ocurrencias más allá
        // de la fecha de fin del proyecto que las contiene.
        if (fechaInicioNueva > proyectoFechaFin) break;

        // Las dependencias NO se copian a propósito: cada ocurrencia arranca
        // libre — copiarlas dejaría a todas las ocurrencias futuras
        // esperando a la misma tarea predecesora original.
        const nueva = this.tareas.create({
          proyectoId: tareaBase.proyectoId,
          nombre: tareaBase.nombre,
          fechaInicio: fechaInicioNueva,
          fechaFin: fechaFinNueva,
          presupuesto: tareaBase.presupuesto,
          responsableId: tareaBase.responsableId,
          prioridad: tareaBase.prioridad,
          etiquetas: tareaBase.etiquetas ?? [],
          recurrenciaTipo: tareaBase.recurrenciaTipo,
          recurrenciaIntervalo: intervalo,
          recurrenciaActiva: true,
          recordarDiaProgramado: tareaBase.recordarDiaProgramado ?? false,
          creadoEn: new Date(),
        });
        const guardada = await this.tareas.save(nueva);

        for (const a of asignados) {
          await this.tareas.query(
            `INSERT INTO tarea_usuarios (tarea_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [guardada.id, a.usuario_id],
          );
        }

        this.emitirCambio(tareaBase.proyectoId, guardada.id, 'creada');
        fechaInicioActual = fechaInicioNueva;
        fechaFinActual = fechaFinNueva;
      }
    } catch {
      // Blindaje: una recurrencia mal configurada nunca debe impedir que la
      // tarea base se cree con éxito.
    }
  }

  // "mensual" no se puede resolver sumando días fijos (los meses no todos
  // duran lo mismo) — Date.UTC normaliza solo el desbordamiento de mes/año;
  // el desbordamiento de día (ej. 31 de enero + 1 mes) queda a su criterio
  // nativo, comportamiento conocido y documentado en el README.
  private desplazarPorRecurrencia(fechaISO: string, tipo: string, intervalo: number): string {
    const [anio, mes, dia] = fechaISO.split('-').map((v) => parseInt(v, 10));
    if (tipo === 'mensual') {
      const fecha = new Date(Date.UTC(anio, mes - 1 + intervalo, dia));
      return fecha.toISOString().slice(0, 10);
    }
    const dias = (DIAS_POR_TIPO_RECURRENCIA[tipo] ?? 1) * intervalo;
    const fecha = new Date(Date.UTC(anio, mes - 1, dia) + dias * 86400000);
    return fecha.toISOString().slice(0, 10);
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
      prioridad: tarea.prioridad,
      etiquetas: tarea.etiquetas ?? [],
      responsable: tarea.responsable
        ? { id: tarea.responsable.id, nombre: tarea.responsable.nombre }
        : null,
      // Dependencias múltiples (cuarta ronda de mejoras) — reemplaza el
      // dependenciaId/dependencia singular original.
      dependencias: (tarea.dependencias ?? []).map((d) => ({ id: d.id, nombre: d.nombre })),
      // Tareas recurrentes (cuarta ronda de mejoras).
      recurrenciaTipo: tarea.recurrenciaTipo,
      recurrenciaIntervalo: tarea.recurrenciaIntervalo,
      recurrenciaActiva: tarea.recurrenciaActiva,
      // Recordatorio "día programado" (mejora reportada por el usuario).
      recordarDiaProgramado: tarea.recordarDiaProgramado,
      creadoEn: tarea.creadoEn,
      completadaEn: tarea.completadaEn,
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

  // Exportar a Excel (prioridad 9) — reutiliza listar(), mismo alcance y
  // misma regla de visibilidad de presupuesto que la pantalla de detalle
  // del proyecto.
  async exportarExcel(proyectoId: number, user: JwtPayload): Promise<Buffer> {
    const proyecto = await this.proyectos.obtenerEntidad(proyectoId);
    if (!(await this.proyectos.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
    }
    const tareas = await this.listar(proyectoId, user);
    const filas = tareas.map((t: any) => ({
      nombre: t.nombre,
      fechaInicio: t.fechaInicio,
      fechaFin: t.fechaFin,
      responsable: t.responsable?.nombre ?? '—',
      asignados: (t.usuariosAsignados ?? []).map((u: any) => u.nombre).join(', ') || '—',
      dependeDe: (t.dependencias ?? []).map((d: any) => d.nombre).join(', ') || '—',
      estatus: t.estatus,
      porcentajeAvance: t.porcentajeAvance,
      presupuesto: t.presupuesto,
    }));
    return generarExcelTareas(proyecto.nombre, filas);
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

  // Dependencias múltiples (cuarta ronda de mejoras, ver README sección 4):
  // esta tarea espera a que TODAS las de `dependeDeIds` terminen antes de
  // poder iniciar. Reemplaza la validación de dependencia simple original,
  // que solo revisaba una cadena lineal — ahora el grafo puede tener varios
  // padres por tarea, así que el chequeo de ciclos necesita recorrer todo
  // el subgrafo de "quién depende de esta tarea" (ver CTE recursivo abajo).
  private async validarDependencias(
    proyectoId: number,
    dependeDeIds: number[],
    fechaInicioTarea: string,
    tareaId?: number,
  ) {
    const idsUnicos = [...new Set(dependeDeIds)];
    if (idsUnicos.includes(tareaId as number)) {
      throw new BadRequestException('Una tarea no puede depender de sí misma.');
    }
    if (idsUnicos.length === 0) return;

    const predecesoras = await this.tareas.find({ where: { id: In(idsUnicos) } });
    if (predecesoras.length !== idsUnicos.length || predecesoras.some((p) => p.proyectoId !== proyectoId)) {
      throw new BadRequestException('Todas las tareas predecesoras deben existir y pertenecer al mismo proyecto.');
    }

    // Consistencia de fechas: ninguna predecesora puede terminar después de
    // que esta tarea empiece (comparación lexicográfica válida: son
    // columnas DATE en formato 'YYYY-MM-DD').
    const tardia = predecesoras.find((p) => p.fechaFin > fechaInicioTarea);
    if (tardia) {
      throw new BadRequestException(
        `Esta tarea no puede iniciar antes de que termine su predecesora "${tardia.nombre}".`,
      );
    }

    // Ciclo de dependencias (directo o en cadena, con varios padres
    // posibles por tarea): si alguna de las nuevas predecesoras ya depende
    // — directa o transitivamente — de `tareaId`, agregar esta dependencia
    // dejaría dos tareas esperándose mutuamente. Solo aplica al editar; una
    // tarea recién creada no puede aparecer todavía en ningún ciclo.
    if (tareaId !== undefined) {
      const descendientes: { tarea_id: number }[] = await this.tareas.query(
        `WITH RECURSIVE descendientes AS (
           SELECT tarea_id FROM tarea_dependencias WHERE depende_de_id = $1
           UNION
           SELECT td.tarea_id FROM tarea_dependencias td
           JOIN descendientes d ON td.depende_de_id = d.tarea_id
         )
         SELECT tarea_id FROM descendientes`,
        [tareaId],
      );
      const idsDescendientes = new Set(descendientes.map((d) => d.tarea_id));
      const enCiclo = predecesoras.find((p) => idsDescendientes.has(p.id));
      if (enCiclo) {
        throw new BadRequestException(
          `Esta dependencia crearía un ciclo entre tareas (dependencia circular) con "${enCiclo.nombre}".`,
        );
      }
    }
  }

  // Reemplaza por completo el conjunto de predecesoras de una tarea —
  // usado tanto al crear (fila vacía de por medio) como al editar.
  private async reemplazarDependencias(tareaId: number, dependeDeIds: number[]) {
    await this.tareas.query(`DELETE FROM tarea_dependencias WHERE tarea_id = $1`, [tareaId]);
    for (const dependeDeId of new Set(dependeDeIds)) {
      await this.tareas.query(
        `INSERT INTO tarea_dependencias (tarea_id, depende_de_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [tareaId, dependeDeId],
      );
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
    if (dto.dependeDeIds?.length) {
      await this.validarDependencias(proyectoId, dto.dependeDeIds, dto.fechaInicio);
    }

    const tarea = this.tareas.create({
      proyectoId,
      nombre: dto.nombre,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      presupuesto: dto.presupuesto !== undefined ? String(dto.presupuesto) : null,
      responsableId: dto.responsableId,
      prioridad: dto.prioridad ?? 'media',
      etiquetas: dto.etiquetas ?? [],
      recurrenciaTipo: dto.recurrenciaTipo ?? null,
      recurrenciaIntervalo: dto.recurrenciaIntervalo ?? 1,
      recordarDiaProgramado: dto.recordarDiaProgramado ?? false,
      creadoEn: new Date(),
    });
    const guardada = await this.tareas.save(tarea);
    if (dto.usuarioIds?.length) await this.asignarUsuarios(guardada.id, dto.usuarioIds);
    if (dto.dependeDeIds?.length) await this.reemplazarDependencias(guardada.id, dto.dependeDeIds);

    // Tareas recurrentes (corrección reportada por el usuario): calendariza
    // de una vez toda la serie de ocurrencias futuras, hasta la fecha de fin
    // del proyecto padre — ver generarSerieRecurrenteSinRomper.
    if (dto.recurrenciaTipo) {
      await this.generarSerieRecurrenteSinRomper(guardada, proyecto.fechaFin);
    }

    // Alerta "asignacion" (Fase 2): todos los que quedan asignados desde
    // el arranque (responsable + usuariosAsignados) reciben el correo.
    const asignadosIniciales = [dto.responsableId, ...(dto.usuarioIds ?? [])].filter(
      (id): id is number => Boolean(id),
    );
    await this.notificarAsignacionSinRomper(guardada.id, asignadosIniciales);
    await this.actividad.registrar(guardada.id, user.sub, 'creacion', 'Creó la tarea.');
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
    // Si cambian las dependencias, o solo cambia fechaInicio pero la tarea
    // ya tenía predecesoras, hay que re-checar contra ellas (podría quedar
    // iniciando antes de que terminen, aunque las dependencias en sí no
    // hayan cambiado).
    const dependeDeIdsFinal =
      dto.dependeDeIds !== undefined ? dto.dependeDeIds : (tarea.dependencias ?? []).map((d) => d.id);
    if (dependeDeIdsFinal.length > 0 && (dto.dependeDeIds !== undefined || dto.fechaInicio !== undefined)) {
      await this.validarDependencias(tarea.proyectoId, dependeDeIdsFinal, fechaInicioFinal, id);
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
    if (dto.prioridad !== undefined) cambios.prioridad = dto.prioridad;
    if (dto.etiquetas !== undefined) cambios.etiquetas = dto.etiquetas;
    if (dto.recurrenciaTipo !== undefined) cambios.recurrenciaTipo = dto.recurrenciaTipo;
    if (dto.recurrenciaIntervalo !== undefined) cambios.recurrenciaIntervalo = dto.recurrenciaIntervalo;
    if (dto.recurrenciaActiva !== undefined) cambios.recurrenciaActiva = dto.recurrenciaActiva;
    if (dto.recordarDiaProgramado !== undefined) cambios.recordarDiaProgramado = dto.recordarDiaProgramado;
    // Automatizaciones simples (ver aplicarAutomatizaciones más abajo) —
    // aquí se aplican sobre el objeto `cambios` porque este flujo hace un
    // UPDATE dirigido en vez de tarea.save() (ver comentario arriba).
    if (dto.porcentajeAvance === 100 && dto.estatus === undefined && tarea.estatus !== 'completada') {
      cambios.estatus = 'completada';
    } else if (dto.estatus === 'completada' && dto.porcentajeAvance === undefined) {
      cambios.porcentajeAvance = 100;
    }
    // Automatización simple #2: se checa ANTES del update, contra el
    // estatus original de `tarea` (todavía no mutado en este flujo) — así
    // solo dispara en la transición hacia "bloqueada", nunca en cada
    // guardado subsecuente mientras la tarea sigue bloqueada.
    const pasaABloqueada = cambios.estatus === 'bloqueada' && tarea.estatus !== 'bloqueada';
    // Estado final (tercera ronda de mejoras): tanto las automatizaciones
    // configurables como la bitácora de actividad necesitan comparar el
    // "antes" contra el "después" de estatus/prioridad/fechaFin/responsable.
    const estatusFinal = (cambios.estatus as string | undefined) ?? tarea.estatus;
    const prioridadFinal = (cambios.prioridad as string | undefined) ?? tarea.prioridad;
    const responsableFinal = dto.responsableId !== undefined ? dto.responsableId : tarea.responsableId;
    // Métricas para reportes ejecutivos (cuarta ronda de mejoras): se marca
    // completadaEn justo al entrar a "completada" y se limpia si se vuelve
    // a abrir la tarea — así el reporte nunca cuenta como "completada a
    // tiempo" una tarea que se reabrió después.
    const entraACompletada = estatusFinal === 'completada' && tarea.estatus !== 'completada';
    const saleDeCompletada = estatusFinal !== 'completada' && tarea.estatus === 'completada';
    if (entraACompletada) cambios.completadaEn = new Date();
    else if (saleDeCompletada) cambios.completadaEn = null;
    if (Object.keys(cambios).length > 0) {
      await this.tareas.update(id, cambios);
    }
    if (dto.dependeDeIds !== undefined) {
      await this.reemplazarDependencias(id, dto.dependeDeIds);
    }
    if (pasaABloqueada) {
      await this.notificarBloqueoSinRomper(id);
    }
    // Nota: ya no se genera una nueva ocurrencia al completar la tarea —
    // desde la corrección reportada por el usuario, toda la serie de
    // ocurrencias futuras se calendariza de una vez al CREAR la tarea
    // recurrente (ver generarSerieRecurrenteSinRomper), así que completar
    // una ocurrencia ya no necesita generar la siguiente.
    await this.evaluarAutomatizacionesSinRomper(
      tarea.proyectoId,
      id,
      dto.nombre ?? tarea.nombre,
      responsableFinal,
      { estatus: tarea.estatus, prioridad: tarea.prioridad, fechaFin: tarea.fechaFin },
      { estatus: estatusFinal, prioridad: prioridadFinal, fechaFin: fechaFinFinal },
    );
    if (estatusFinal !== tarea.estatus) {
      await this.actividad.registrar(id, user.sub, 'cambio_estatus', `Cambió el estatus de "${tarea.estatus}" a "${estatusFinal}".`);
    }
    if (dto.responsableId !== undefined && dto.responsableId !== tarea.responsableId) {
      await this.actividad.registrar(id, user.sub, 'cambio_responsable', 'Reasignó el responsable de la tarea.');
    }
    if (prioridadFinal !== tarea.prioridad) {
      await this.actividad.registrar(id, user.sub, 'cambio_prioridad', `Cambió la prioridad de "${tarea.prioridad}" a "${prioridadFinal}".`);
    }

    // Alerta "asignacion": responsable final (si cambió) + usuarios
    // asignados finales (si dto.usuarioIds vino, o los mismos de antes si
    // no), menos quien ya estaba en asignadosAntes.
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
    const estatusOriginal = tarea.estatus;
    const prioridadOriginal = tarea.prioridad;
    const fechaFinOriginal = tarea.fechaFin;
    if (dto.estatus !== undefined) tarea.estatus = dto.estatus;
    if (dto.porcentajeAvance !== undefined) tarea.porcentajeAvance = dto.porcentajeAvance;
    this.aplicarAutomatizaciones(tarea, dto);
    // Métricas para reportes ejecutivos — mismo criterio que en actualizar().
    if (tarea.estatus === 'completada' && estatusOriginal !== 'completada') {
      tarea.completadaEn = new Date();
    } else if (tarea.estatus !== 'completada' && estatusOriginal === 'completada') {
      tarea.completadaEn = null;
    }
    await this.tareas.save(tarea);
    if (tarea.estatus === 'bloqueada' && estatusOriginal !== 'bloqueada') {
      await this.notificarBloqueoSinRomper(id);
    }
    // Nota: ver comentario equivalente en actualizar() — la serie completa
    // de ocurrencias futuras ya se generó al crear la tarea recurrente.
    await this.evaluarAutomatizacionesSinRomper(
      tarea.proyectoId,
      id,
      tarea.nombre,
      tarea.responsableId,
      { estatus: estatusOriginal, prioridad: prioridadOriginal, fechaFin: fechaFinOriginal },
      { estatus: tarea.estatus, prioridad: tarea.prioridad, fechaFin: tarea.fechaFin },
    );
    if (tarea.estatus !== estatusOriginal) {
      await this.actividad.registrar(id, user.sub, 'cambio_estatus', `Cambió el estatus de "${estatusOriginal}" a "${tarea.estatus}".`);
    }
    this.emitirCambio(tarea.proyectoId, id, 'actualizada');
    return this.obtener(id, user);
  }

  // Automatizaciones simples (mejora sugerida, ver README sección 4): reglas
  // fijas, sin motor de configuración — cubren el caso más común sin que
  // nadie tenga que acordarse de sincronizar estatus y % a mano.
  // 1) Si el avance llega a 100 y no se tocó el estatus explícitamente en
  //    este mismo request, la tarea pasa a "completada" sola.
  // 2) Si se marca "completada" a mano, el avance se redondea a 100 para
  //    que la barra de progreso nunca contradiga al estatus.
  private aplicarAutomatizaciones(tarea: Tarea, dto: { estatus?: string; porcentajeAvance?: number }) {
    if (dto.porcentajeAvance === 100 && dto.estatus === undefined && tarea.estatus !== 'completada') {
      tarea.estatus = 'completada';
    } else if (dto.estatus === 'completada' && dto.porcentajeAvance === undefined) {
      tarea.porcentajeAvance = 100;
    }
  }

  // Reasignación masiva de responsable (prioridad 11, segunda mitad): la
  // pantalla ofrece esto sobre un solo proyecto a la vez, así que se exige
  // que TODAS las tareaIds pertenezcan a `proyectoId` — evita que alguien
  // cuele el id de una tarea de otro proyecto fuera de su alcance en el
  // mismo request. Reutiliza `actualizar()` tarea por tarea para no duplicar
  // ninguna de sus validaciones (existencia del responsable, permisos,
  // notificación de asignación, evento de tiempo real).
  async reasignarMasivo(proyectoId: number, dto: ReasignarMasivoDto, user: JwtPayload) {
    const proyecto = await this.proyectos.obtenerEntidad(proyectoId);
    this.proyectos.verificarPuedeGestionar(proyecto, user);

    const responsable = await this.usuarios.findOne({ where: { id: dto.responsableId } });
    if (!responsable) throw new NotFoundException('El responsable indicado no existe.');

    const idsUnicos = [...new Set(dto.tareaIds)];
    const tareas = await this.tareas.find({ where: { id: In(idsUnicos) } });
    if (tareas.length !== idsUnicos.length) {
      throw new NotFoundException('Una o más tareas seleccionadas no existen.');
    }
    const fueraDeProyecto = tareas.some((t) => t.proyectoId !== proyectoId);
    if (fueraDeProyecto) {
      throw new BadRequestException('Todas las tareas seleccionadas deben pertenecer a este proyecto.');
    }

    for (const id of idsUnicos) {
      await this.actualizar(id, { responsableId: dto.responsableId }, user);
    }
    return this.listar(proyectoId, user);
  }

  // "Mis tareas" (mejora sugerida, ver README sección 4): todo lo asignado
  // al usuario actual a través de TODOS sus proyectos, sin importar el
  // alcance por Área/Dirección — si ya está asignado, ya tiene visibilidad
  // sobre esa tarea puntual aunque el proyecto completo esté fuera de su
  // alcance normal. Ordenado por fecha de fin (lo más urgente primero).
  async listarMisTareas(user: JwtPayload) {
    const tareas = await this.tareas
      .createQueryBuilder('tarea')
      .leftJoinAndSelect('tarea.proyecto', 'proyecto')
      .leftJoinAndSelect('tarea.responsable', 'responsable')
      .leftJoinAndSelect('tarea.dependencias', 'dependencias')
      .leftJoinAndSelect('tarea.usuariosAsignados', 'usuariosAsignados')
      .where('tarea.responsable_id = :uid', { uid: user.sub })
      .orWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('tu.tarea_id')
          .from('tarea_usuarios', 'tu')
          .where('tu.usuario_id = :uid')
          .getQuery();
        return 'tarea.id IN ' + sub;
      })
      .setParameter('uid', user.sub)
      .orderBy('tarea.fecha_fin', 'ASC')
      .getMany();

    const autorizado = await this.proyectos.autorizacionPresupuesto(user);
    return tareas.map((t) => ({
      ...this.serializar(t, user, autorizado),
      proyecto: { id: t.proyecto.id, nombre: t.proyecto.nombre },
    }));
  }

  async eliminar(id: number, user: JwtPayload) {
    const tarea = await this.obtenerEntidad(id);
    const proyecto = await this.proyectos.obtenerEntidad(tarea.proyectoId);
    this.proyectos.verificarPuedeGestionar(proyecto, user);

    // Ninguna otra tarea debe quedar esperando a una dependencia eliminada
    // — ON DELETE CASCADE en tarea_dependencias ya limpia ambas direcciones
    // (como predecesora de otras Y como dependiente), no hace falta un
    // UPDATE manual como en la versión de dependencia simple original.
    await this.tareas.query(`DELETE FROM tarea_usuarios WHERE tarea_id = $1`, [id]);
    await this.tareas.remove(tarea);
    this.emitirCambio(tarea.proyectoId, id, 'eliminada');
    return { ok: true };
  }
}
