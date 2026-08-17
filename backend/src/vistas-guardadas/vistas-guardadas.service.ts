import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VistaGuardada } from '../entities/vista-guardada.entity';
import { JwtPayload } from '../auth/auth.service';
import { CreateVistaDto } from './dto/create-vista.dto';

// Vistas/filtros guardados por usuario (tercera ronda de mejoras, ver
// README sección 4): a diferencia de Subtareas/Comentarios, esto es
// estrictamente personal — no hay proyecto ni alcance que verificar, solo
// el dueño del registro puede verlo o borrarlo.
@Injectable()
export class VistasGuardadasService {
  constructor(@InjectRepository(VistaGuardada) private readonly vistas: Repository<VistaGuardada>) {}

  private serializar(v: VistaGuardada) {
    return { id: v.id, pantalla: v.pantalla, nombre: v.nombre, filtros: v.filtros, creadoEn: v.creadoEn };
  }

  async listar(pantalla: string | undefined, user: JwtPayload) {
    const where = pantalla ? { usuarioId: user.sub, pantalla } : { usuarioId: user.sub };
    const filas = await this.vistas.find({ where, order: { creadoEn: 'ASC' } });
    return filas.map((v) => this.serializar(v));
  }

  async crear(dto: CreateVistaDto, user: JwtPayload) {
    const guardada = await this.vistas.save(
      this.vistas.create({ usuarioId: user.sub, pantalla: dto.pantalla, nombre: dto.nombre, filtros: dto.filtros }),
    );
    return this.serializar(guardada);
  }

  async eliminar(id: number, user: JwtPayload) {
    const vista = await this.vistas.findOne({ where: { id } });
    if (!vista) throw new NotFoundException('Vista guardada no encontrada.');
    if (vista.usuarioId !== user.sub) {
      throw new ForbiddenException('Solo puedes borrar tus propias vistas guardadas.');
    }
    await this.vistas.remove(vista);
    return { ok: true };
  }
}
