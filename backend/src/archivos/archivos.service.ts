import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adjunto } from '../entities/adjunto.entity';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';
import { ArchivosStorageService } from './archivos-storage.service';

const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15 MB — moderado a propósito: el
// plan gratuito de Supabase Storage da 1 GB total (ver README sección 6),
// así que no conviene un límite más generoso hasta que haya un plan pagado.

// Quita cualquier caracter que no sea seguro para una ruta de Storage —
// evita tanto problemas de codificación como un intento de path traversal
// (p. ej. "../../otra-cosa") desde un nombre de archivo malicioso.
function sanearNombreArchivo(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
}

@Injectable()
export class ArchivosService {
  constructor(
    @InjectRepository(Adjunto) private readonly adjuntos: Repository<Adjunto>,
    @InjectRepository(Tarea) private readonly tareasRepo: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
    private readonly storage: ArchivosStorageService,
  ) {}

  // Ver adjuntos de un proyecto/tarea exige el mismo alcance que ya exige
  // ver el proyecto/tarea en sí (puedeVer) — no es información más
  // sensible que el resto del proyecto. Subir exige lo mismo: cualquiera
  // que pueda VER el proyecto puede aportar un archivo (p. ej. un
  // colaborador entregando un documento), no hace falta manage_projects
  // para eso. Borrar es más estricto: solo quien subió el archivo o quien
  // puede administrar el proyecto (verificarPuedeGestionar).
  private async proyectoEnAlcance(proyectoId: number, user: JwtPayload) {
    const proyecto = await this.proyectosService.obtenerEntidad(proyectoId);
    if (!(await this.proyectosService.puedeVer(proyecto, user))) {
      throw new ForbiddenException('Este proyecto está fuera de tu alcance.');
    }
    return proyecto;
  }

  private async tareaEnAlcance(tareaId: number, user: JwtPayload) {
    const tarea = await this.tareasRepo.findOne({ where: { id: tareaId } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada.');
    const proyecto = await this.proyectoEnAlcance(tarea.proyectoId, user);
    return { tarea, proyecto };
  }

  private serializar(a: Adjunto) {
    return {
      id: a.id,
      nombreArchivo: a.nombreArchivo,
      tipoMime: a.tipoMime,
      tamanoBytes: Number(a.tamanoBytes),
      subidoEn: a.subidoEn,
      subidoPor: a.subidoPorUsuario ? { id: a.subidoPorUsuario.id, nombre: a.subidoPorUsuario.nombre } : null,
    };
  }

  private async listar(where: { proyectoId: number } | { tareaId: number }) {
    const filas = await this.adjuntos.find({
      where,
      relations: { subidoPorUsuario: true },
      order: { subidoEn: 'DESC' },
    });
    return filas.map((f) => this.serializar(f));
  }

  async listarDeProyecto(proyectoId: number, user: JwtPayload) {
    await this.proyectoEnAlcance(proyectoId, user);
    return this.listar({ proyectoId });
  }

  async listarDeTarea(tareaId: number, user: JwtPayload) {
    await this.tareaEnAlcance(tareaId, user);
    return this.listar({ tareaId });
  }

  private validarArchivo(archivo?: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Sube un archivo.');
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 15 MB.');
    }
  }

  private async subir(
    duenio: { proyectoId: number; tareaId?: undefined } | { tareaId: number; proyectoId?: undefined },
    user: JwtPayload,
    archivo: Express.Multer.File,
  ) {
    this.validarArchivo(archivo);
    const carpeta = duenio.proyectoId ? `proyectos/${duenio.proyectoId}` : `tareas/${duenio.tareaId}`;
    // Prefijo de timestamp: evita colisiones si dos personas suben un
    // archivo con el mismo nombre al mismo proyecto/tarea.
    const ruta = `${carpeta}/${Date.now()}-${sanearNombreArchivo(archivo.originalname)}`;
    await this.storage.subir(ruta, archivo.buffer, archivo.mimetype);

    const registro = this.adjuntos.create({
      proyectoId: duenio.proyectoId ?? null,
      tareaId: duenio.tareaId ?? null,
      nombreArchivo: archivo.originalname,
      rutaStorage: ruta,
      tipoMime: archivo.mimetype || null,
      tamanoBytes: String(archivo.size),
      subidoPor: user.sub,
    });
    await this.adjuntos.save(registro);

    return duenio.proyectoId
      ? this.listarDeProyecto(duenio.proyectoId, user)
      : this.listarDeTarea(duenio.tareaId!, user);
  }

  async subirAProyecto(proyectoId: number, user: JwtPayload, archivo: Express.Multer.File) {
    await this.proyectoEnAlcance(proyectoId, user);
    return this.subir({ proyectoId }, user, archivo);
  }

  async subirATarea(tareaId: number, user: JwtPayload, archivo: Express.Multer.File) {
    await this.tareaEnAlcance(tareaId, user);
    return this.subir({ tareaId }, user, archivo);
  }

  private async obtenerConAlcance(archivoId: number, user: JwtPayload) {
    const adjunto = await this.adjuntos.findOne({ where: { id: archivoId }, relations: { subidoPorUsuario: true } });
    if (!adjunto) throw new NotFoundException('Archivo no encontrado.');
    const proyecto = adjunto.proyectoId
      ? await this.proyectoEnAlcance(adjunto.proyectoId, user)
      : (await this.tareaEnAlcance(adjunto.tareaId!, user)).proyecto;
    return { adjunto, proyecto };
  }

  async descargar(archivoId: number, user: JwtPayload) {
    const { adjunto } = await this.obtenerConAlcance(archivoId, user);
    const buffer = await this.storage.descargar(adjunto.rutaStorage);
    return { buffer, nombreArchivo: adjunto.nombreArchivo, tipoMime: adjunto.tipoMime ?? 'application/octet-stream' };
  }

  async eliminar(archivoId: number, user: JwtPayload) {
    const { adjunto, proyecto } = await this.obtenerConAlcance(archivoId, user);
    const esQuienSubio = adjunto.subidoPor === user.sub;
    if (!esQuienSubio) {
      // Lanza ForbiddenException si el rol/alcance no alcanza — mismo
      // control que ya usan Tareas/Gastos para "administrar" el proyecto.
      this.proyectosService.verificarPuedeGestionar(proyecto, user);
    }
    await this.storage.eliminar(adjunto.rutaStorage);
    await this.adjuntos.remove(adjunto);
    return { ok: true };
  }
}
