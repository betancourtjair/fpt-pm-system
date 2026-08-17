import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Proyecto } from '../entities/proyecto.entity';
import { Area } from '../entities/area.entity';
import { Direccion } from '../entities/direccion.entity';
import { Usuario } from '../entities/usuario.entity';
import { GastoProyecto } from '../entities/gasto-proyecto.entity';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { ClonarProyectoDto } from './dto/clonar-proyecto.dto';
import {
  esAdmin,
  esDirector,
  esGerenteArea,
  puedeGestionarProyectos,
  puedeVerPresupuesto,
} from '../common/permisos.util';
import { colorEfectivo } from '../catalogo/paleta-colores';
import { generarExcelProyectos } from '../common/excel-export.util';

const RELACIONES = { areas: true, responsable: true, creador: true } as const;

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Area) private readonly areas: Repository<Area>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Direccion) private readonly direcciones: Repository<Direccion>,
    @InjectRepository(GastoProyecto) private readonly gastos: Repository<GastoProyecto>,
    @InjectRepository(Tarea) private readonly tareasRepo: Repository<Tarea>,
  ) {}

  // El color se administra por Dirección (no por Área — más simple de
  // mantener); cada Área "hereda" el color de su Dirección para pintar
  // filas/chips en Proyectos. Se resuelve una sola vez por request.
  private async mapaColoresPorDireccion(): Promise<Map<number, string>> {
    const filas = await this.direcciones.find();
    return new Map(filas.map((d) => [d.id, colorEfectivo(d)]));
  }

  // Presupuesto real vs. plan (prioridad 8): suma de gastos_proyecto por
  // proyecto, calculada una sola vez por request igual que los colores. Solo
  // se consulta para los proyectos que ya se van a serializar (ids === 'all'
  // consulta todos, si no, solo los del alcance del usuario).
  private async mapaGastosPorProyecto(ids: number[] | 'all'): Promise<Map<number, number>> {
    if (ids !== 'all' && ids.length === 0) return new Map();
    const filas: { proyecto_id: number; total: string }[] = await this.gastos.query(
      ids === 'all'
        ? `SELECT proyecto_id, SUM(monto)::text AS total FROM gastos_proyecto GROUP BY proyecto_id`
        : `SELECT proyecto_id, SUM(monto)::text AS total FROM gastos_proyecto WHERE proyecto_id = ANY($1) GROUP BY proyecto_id`,
      ids === 'all' ? [] : [ids],
    );
    return new Map(filas.map((f) => [f.proyecto_id, Number(f.total)]));
  }

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

  private serializar(
    proyecto: Proyecto,
    user: JwtPayload,
    autorizado: boolean,
    coloresPorDireccion: Map<number, string>,
    gastosPorProyecto: Map<number, number>,
  ) {
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
        color: coloresPorDireccion.get(a.direccionId) ?? '#94a3b8',
      })),
    };
    // gastoTotal viaja con la misma regla de visibilidad que presupuesto —
    // es información financiera del proyecto, tiene el mismo candado.
    if (puedeVerPresupuesto(user, autorizado)) {
      base.presupuesto = Number(proyecto.presupuesto);
      base.gastoTotal = gastosPorProyecto.get(proyecto.id) ?? 0;
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
    const [autorizado, coloresPorDireccion, gastosPorProyecto] = await Promise.all([
      this.autorizacionPresupuesto(user),
      this.mapaColoresPorDireccion(),
      this.mapaGastosPorProyecto(ids),
    ]);
    return proyectos.map((p) => this.serializar(p, user, autorizado, coloresPorDireccion, gastosPorProyecto));
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
    const [autorizado, coloresPorDireccion, gastosPorProyecto] = await Promise.all([
      this.autorizacionPresupuesto(user),
      this.mapaColoresPorDireccion(),
      this.mapaGastosPorProyecto([id]),
    ]);
    return this.serializar(proyecto, user, autorizado, coloresPorDireccion, gastosPorProyecto);
  }

  // Exportar a Excel (prioridad 9) — reutiliza listar(), así que respeta el
  // mismo alcance por rol y la misma regla de visibilidad de presupuesto
  // que la pantalla de Proyectos (nunca exporta un dato que el usuario no
  // vería ya en la app).
  async exportarExcel(user: JwtPayload): Promise<Buffer> {
    const proyectos = await this.listar(user);
    const filas = proyectos.map((p: any) => ({
      nombre: p.nombre,
      areas: (p.areas ?? []).map((a: any) => a.nombre).join(', '),
      responsable: p.responsable?.nombre ?? '—',
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      estatus: p.estatus,
      presupuesto: p.presupuesto,
      gastoTotal: p.gastoTotal,
    }));
    return generarExcelProyectos(filas);
  }

  // ------------------------------------------------------------------
  // Gastos reales (prioridad 8: presupuesto real vs. plan). Ver el gasto
  // desglosado exige la misma autorización que ver el presupuesto —
  // registrar/borrar un gasto exige poder administrar el proyecto (mismo
  // control que crear/editar tareas).
  // ------------------------------------------------------------------
  private async verificarPuedeVerPresupuesto(proyecto: Proyecto, user: JwtPayload): Promise<void> {
    if (!(await this.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
    }
    const autorizado = await this.autorizacionPresupuesto(user);
    if (!puedeVerPresupuesto(user, autorizado)) {
      throw new ForbiddenException('Tu rol no tiene autorizado ver el presupuesto de este proyecto.');
    }
  }

  async listarGastos(proyectoId: number, user: JwtPayload) {
    const proyecto = await this.obtenerEntidad(proyectoId);
    await this.verificarPuedeVerPresupuesto(proyecto, user);
    const filas = await this.gastos.find({
      where: { proyectoId },
      relations: { creador: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });
    return filas.map((g) => ({
      id: g.id,
      concepto: g.concepto,
      monto: Number(g.monto),
      fecha: g.fecha,
      creador: g.creador ? { id: g.creador.id, nombre: g.creador.nombre } : null,
    }));
  }

  async crearGasto(proyectoId: number, dto: CreateGastoDto, user: JwtPayload) {
    const proyecto = await this.obtenerEntidad(proyectoId);
    this.verificarPuedeGestionar(proyecto, user);
    const gasto = this.gastos.create({
      proyectoId,
      concepto: dto.concepto,
      monto: String(dto.monto),
      fecha: dto.fecha,
      creadoPor: user.sub,
    });
    await this.gastos.save(gasto);
    return this.listarGastos(proyectoId, user);
  }

  async eliminarGasto(proyectoId: number, gastoId: number, user: JwtPayload) {
    const proyecto = await this.obtenerEntidad(proyectoId);
    this.verificarPuedeGestionar(proyecto, user);
    const gasto = await this.gastos.findOne({ where: { id: gastoId, proyectoId } });
    if (!gasto) throw new NotFoundException('Gasto no encontrado.');
    await this.gastos.remove(gasto);
    return this.listarGastos(proyectoId, user);
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

    // IMPORTANTE: se actualiza con un UPDATE dirigido (no proyecto.save())
    // porque `proyecto` se cargó con la relación `responsable` ya resuelta;
    // si solo se reasigna la columna escalar responsableId y se guarda la
    // entidad completa, TypeORM puede preferir el objeto de relación viejo
    // que sigue en memoria y el cambio se pierde silenciosamente.
    const cambios: Record<string, unknown> = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre;
    if (dto.fechaInicio !== undefined) cambios.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin !== undefined) cambios.fechaFin = dto.fechaFin;
    if (dto.presupuesto !== undefined) cambios.presupuesto = String(dto.presupuesto);
    if (dto.estatus !== undefined) cambios.estatus = dto.estatus;
    if (dto.responsableId !== undefined) cambios.responsableId = dto.responsableId;
    if (Object.keys(cambios).length > 0) {
      await this.proyectos.update(id, cambios);
    }
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

  // Plantillas de proyecto (mejora sugerida, ver README sección 4): clona
  // un proyecto existente —áreas, presupuesto y TODAS sus tareas (con sus
  // dependencias y usuarios asignados)— sobre una nueva fecha de inicio.
  // Cada tarea se recorre con el mismo desfase de días entre la fecha de
  // inicio original del proyecto y la nueva, así que la duración relativa
  // de cada tarea (y del proyecto completo) se conserva intacta.
  // Deliberadamente reinicia estatus/avance (nada de "completada" fantasma
  // en un proyecto que apenas va a empezar) y exige el mismo permiso que
  // administrar el proyecto origen — clonar es, en el fondo, crear uno nuevo.
  async clonar(id: number, dto: ClonarProyectoDto, user: JwtPayload) {
    const original = await this.obtenerEntidad(id);
    this.verificarPuedeGestionar(original, user);

    // Todo en milisegundos UTC vía Date.parse sobre columnas DATE
    // ('YYYY-MM-DD') — nunca se lee año/mes/día en hora local, así que no
    // hay riesgo de que el desfase se corra un día por zona horaria.
    const desfaseMs = Date.parse(dto.fechaInicio) - Date.parse(original.fechaInicio);
    const duracionMs = Date.parse(original.fechaFin) - Date.parse(original.fechaInicio);
    const nuevaFechaFin = new Date(Date.parse(dto.fechaInicio) + duracionMs).toISOString().slice(0, 10);
    const desplazar = (fechaISO: string) =>
      new Date(Date.parse(fechaISO) + desfaseMs).toISOString().slice(0, 10);

    const nuevo = this.proyectos.create({
      nombre: dto.nombre,
      fechaInicio: dto.fechaInicio,
      fechaFin: nuevaFechaFin,
      presupuesto: original.presupuesto,
      estatus: 'no_iniciado',
      responsableId: original.responsableId,
      creadoPor: user.sub,
    });
    const guardado = await this.proyectos.save(nuevo);
    await this.asignarAreas(guardado.id, original.areas.map((a) => a.id));

    const tareasOriginales = await this.tareasRepo.find({ where: { proyectoId: id }, order: { id: 'ASC' } });
    const idsViejoANuevo = new Map<number, number>();
    for (const t of tareasOriginales) {
      const nueva = this.tareasRepo.create({
        proyectoId: guardado.id,
        nombre: t.nombre,
        fechaInicio: desplazar(t.fechaInicio),
        fechaFin: desplazar(t.fechaFin),
        presupuesto: t.presupuesto,
        estatus: 'no_iniciada',
        porcentajeAvance: 0,
        prioridad: t.prioridad,
        responsableId: t.responsableId,
        dependenciaId: null, // se remapea abajo, una vez que todas ya tienen id nuevo
      });
      const guardada = await this.tareasRepo.save(nueva);
      idsViejoANuevo.set(t.id, guardada.id);
    }
    // Segunda pasada: dependencias (remapeadas al id clonado) y usuarios
    // asignados (los mismos, el gerente del nuevo proyecto los reasigna si
    // no aplica para esta repetición).
    for (const t of tareasOriginales) {
      const nuevoId = idsViejoANuevo.get(t.id)!;
      if (t.dependenciaId && idsViejoANuevo.has(t.dependenciaId)) {
        await this.tareasRepo.update(nuevoId, { dependenciaId: idsViejoANuevo.get(t.dependenciaId) });
      }
      const asignados: { usuario_id: number }[] = await this.tareasRepo.query(
        `SELECT usuario_id FROM tarea_usuarios WHERE tarea_id = $1`,
        [t.id],
      );
      for (const a of asignados) {
        await this.tareasRepo.query(
          `INSERT INTO tarea_usuarios (tarea_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [nuevoId, a.usuario_id],
        );
      }
    }

    return this.obtener(guardado.id, user);
  }
}
