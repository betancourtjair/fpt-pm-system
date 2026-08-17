import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';
import { colorEfectivo } from './paleta-colores';
import { ActualizarColorDireccionDto } from './dto/actualizar-color-direccion.dto';

// Lectura del catálogo (Direcciones/Áreas/Roles) para poblar selects en el frontend.
// Cualquier usuario autenticado puede leer el catálogo; editar (el color)
// es exclusivo de admin. El color se administra por Dirección nada más
// (más simple que por Área) — cada Área hereda el color de su Dirección.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CatalogoController {
  constructor(
    @InjectRepository(Direccion) private readonly direcciones: Repository<Direccion>,
    @InjectRepository(Area) private readonly areas: Repository<Area>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
  ) {}

  @Get('direcciones')
  async listarDirecciones() {
    const filas = await this.direcciones.find({
      order: { id: 'ASC' },
      relations: { areas: true },
    });
    return filas.map((d) => {
      const color = colorEfectivo(d);
      return {
        ...d,
        color,
        // Cada área hereda el color de su Dirección — ya no se administra
        // color por Área de forma independiente.
        areas: (d.areas ?? [])
          .slice()
          .sort((a, b) => a.id - b.id)
          .map((a) => ({ ...a, color })),
      };
    });
  }

  @Get('areas')
  async listarAreas() {
    const filas = await this.areas.find({
      order: { id: 'ASC' },
      relations: { direccion: true },
    });
    return filas.map((a) => ({ ...a, color: colorEfectivo(a.direccion) }));
  }

  @Get('roles')
  listarRoles() {
    return this.roles.find({ order: { id: 'ASC' } });
  }

  // Personalización de color por Dirección — PID: "agrega la opción para
  // hacer el cambio de color de las direcciones". Solo admin; el resto del
  // catálogo es de solo lectura para cualquier usuario autenticado.
  @Roles('admin')
  @Patch('direcciones/:id/color')
  async actualizarColor(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarColorDireccionDto) {
    const direccion = await this.direcciones.findOne({ where: { id } });
    if (!direccion) throw new NotFoundException('Dirección no encontrada.');
    direccion.color = dto.color;
    await this.direcciones.save(direccion);
    return { ...direccion, color: colorEfectivo(direccion) };
  }
}
