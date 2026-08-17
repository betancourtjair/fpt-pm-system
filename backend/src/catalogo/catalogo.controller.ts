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
import { ActualizarColorAreaDto } from './dto/actualizar-color-area.dto';

// Lectura del catálogo (Direcciones/Áreas/Roles) para poblar selects en el frontend.
// Cualquier usuario autenticado puede leer el catálogo; editar (por ahora
// solo el color por Área) es exclusivo de admin.
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
    // Cada área siempre trae un color resuelto (el propio o el default por
    // paleta) para que el frontend nunca tenga que duplicar esa lógica.
    return filas.map((d) => ({
      ...d,
      areas: (d.areas ?? [])
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((a) => ({ ...a, color: colorEfectivo(a) })),
    }));
  }

  @Get('areas')
  async listarAreas() {
    const filas = await this.areas.find({
      order: { id: 'ASC' },
      relations: { direccion: true },
    });
    return filas.map((a) => ({ ...a, color: colorEfectivo(a) }));
  }

  @Get('roles')
  listarRoles() {
    return this.roles.find({ order: { id: 'ASC' } });
  }

  // Personalización de color por Área — PID: "que el modo admin te permita
  // elegir el color por área". Solo admin; el resto del catálogo es de
  // solo lectura para cualquier usuario autenticado.
  @Roles('admin')
  @Patch('areas/:id/color')
  async actualizarColor(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarColorAreaDto) {
    const area = await this.areas.findOne({ where: { id } });
    if (!area) throw new NotFoundException('Área no encontrada.');
    area.color = dto.color;
    await this.areas.save(area);
    return { ...area, color: colorEfectivo(area) };
  }
}
