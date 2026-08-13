import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { Usuario } from '../entities/usuario.entity';
import { esDirector } from '../common/permisos.util';
import { AutorizarPresupuestoDto } from './dto/autorizar-presupuesto.dto';

// RBAC (PID sección 9.2): admin ve el directorio completo; director ve
// solo su Dirección; gerente_area ve solo su Área (para poder elegir
// responsables/asignados al crear proyectos y tareas en su alcance).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>) {}

  @Roles('admin', 'director', 'gerente_area')
  @Get()
  async listar(@CurrentUser() user: JwtPayload) {
    const qb = this.usuarios
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.rol', 'rol')
      .leftJoinAndSelect('u.area', 'area')
      .leftJoinAndSelect('area.direccion', 'direccion')
      .orderBy('u.id', 'ASC');

    if (esDirector(user)) {
      qb.andWhere('direccion.id = :direccionId', { direccionId: user.direccionId });
    } else if (user.rol === 'gerente_area') {
      qb.andWhere('area.id = :areaId', { areaId: user.areaId });
    }

    const usuarios = await qb.getMany();
    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      activo: u.activo,
      mustChangePassword: u.mustChangePassword,
      verPresupuestoAutorizado: u.verPresupuestoAutorizado,
      rol: u.rol?.nombre ?? null,
      areaId: u.areaId,
      area: u.area?.nombre ?? null,
      direccion: u.area?.direccion?.nombre ?? null,
    }));
  }

  // Solo admin/director pueden mover este flag; un director además solo
  // sobre gerentes de área dentro de su propia Dirección (PID sección 8).
  @Roles('admin', 'director')
  @Patch(':id/autorizar-presupuesto')
  async autorizarPresupuesto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AutorizarPresupuestoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const objetivo = await this.usuarios.findOne({
      where: { id },
      relations: { rol: true, area: { direccion: true } },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado.');
    if (objetivo.rol.nombre !== 'gerente_area') {
      throw new BadRequestException(
        'Solo se puede autorizar la visibilidad de presupuesto a usuarios con rol gerente_area.',
      );
    }
    if (esDirector(user) && objetivo.area?.direccionId !== user.direccionId) {
      throw new ForbiddenException('Solo puedes autorizar usuarios de tu propia Dirección.');
    }

    objetivo.verPresupuestoAutorizado = dto.autorizar;
    objetivo.presupuestoAutorizadoPor = dto.autorizar ? user.sub : null;
    objetivo.presupuestoAutorizadoEn = dto.autorizar ? new Date() : null;
    await this.usuarios.save(objetivo);
    return { ok: true, verPresupuestoAutorizado: objetivo.verPresupuestoAutorizado };
  }
}
