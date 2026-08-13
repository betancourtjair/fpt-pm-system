import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';

// Lectura del catálogo (Direcciones/Áreas/Roles) para poblar selects en el frontend.
// Cualquier usuario autenticado puede leer el catálogo; solo admin puede editarlo
// (la edición del catálogo se agrega en una fase posterior — no es parte del primer montado).
@UseGuards(JwtAuthGuard)
@Controller()
export class CatalogoController {
  constructor(
    @InjectRepository(Direccion) private readonly direcciones: Repository<Direccion>,
    @InjectRepository(Area) private readonly areas: Repository<Area>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
  ) {}

  @Get('direcciones')
  listarDirecciones() {
    return this.direcciones.find({
      order: { id: 'ASC' },
      relations: { areas: true },
    });
  }

  @Get('areas')
  listarAreas() {
    return this.areas.find({
      order: { id: 'ASC' },
      relations: { direccion: true },
    });
  }

  @Get('roles')
  listarRoles() {
    return this.roles.find({ order: { id: 'ASC' } });
  }
}
