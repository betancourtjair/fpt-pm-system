import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComentarioTarea } from '../entities/comentario-tarea.entity';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';

// Normaliza un nombre a un "handle" comparable contra el texto después de
// "@": minúsculas, sin acentos, sin espacios — así "@juanperez" encuentra a
// "Juan Pérez" sin que el usuario tenga que escribir el nombre exacto.
function handleDe(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos ya separados por NFD
    .replace(/[^a-z0-9]/g, ''); // quita espacios y cualquier otro símbolo
}

// Extrae los tokens "@algo" de un texto de comentario (letras/números,
// termina en espacio o puntuación) — no exige que existan de verdad, eso
// se resuelve después contra el equipo del proyecto.
function extraerMenciones(texto: string): string[] {
  const matches = texto.match(/@[a-zA-Z0-9À-ÿ]+/g) ?? [];
  return [...new Set(matches.map((m) => handleDe(m.slice(1))))];
}

// Comentarios por tarea (mejora sugerida, ver README sección 4): mismo
// alcance que ArchivosService — ver/comentar exige poder VER el proyecto
// (cualquier colaborador dentro del alcance), borrar exige ser quien lo
// escribió o poder administrar el proyecto.
@Injectable()
export class ComentariosService {
  private readonly logger = new Logger(ComentariosService.name);

  constructor(
    @InjectRepository(ComentarioTarea) private readonly comentarios: Repository<ComentarioTarea>,
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(NotificacionPersonalizada) private readonly notificaciones: Repository<NotificacionPersonalizada>,
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
    await this.notificarMencionesSinRomper(tareaId, tarea.proyectoId, tarea.nombre, dto.texto, user);
    return this.listar(tareaId, user);
  }

  // Menciones (@usuario) en comentarios (tercera ronda de mejoras, ver
  // README sección 4): un aviso in-app nunca debe tronar la publicación del
  // comentario en sí — mismo criterio que los "...SinRomper" de
  // TareasService/AlertasService.
  private async notificarMencionesSinRomper(
    tareaId: number,
    proyectoId: number,
    tareaNombre: string,
    texto: string,
    autor: JwtPayload,
  ) {
    try {
      const handles = extraerMenciones(texto);
      if (handles.length === 0) return;

      const equipo = await this.proyectosService.equipo(proyectoId, autor);
      const mencionados = equipo.filter((u) => u.id !== autor.sub && handles.includes(handleDe(u.nombre)));
      for (const usuario of mencionados) {
        const guardada = await this.notificaciones.save(
          this.notificaciones.create({
            usuarioId: usuario.id,
            tipo: 'mencion',
            tareaId,
            mensaje: `Te mencionaron en un comentario de la tarea "${tareaNombre}".`,
          }),
        );
        this.eventos.emit('notificacion.creada', {
          usuarioId: usuario.id,
          notificacion: {
            id: `p-${guardada.id}`,
            tipo: 'mencion',
            tareaId,
            tareaNombre,
            fechaProgramada: guardada.creadoEn,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`No se pudieron procesar menciones del comentario en la tarea ${tareaId}: ${error}`);
    }
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
