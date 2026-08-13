import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Usuario } from '../entities/usuario.entity';

// Ejemplo de endpoint restringido por rol (RBAC) — ver PID sección 9.2.
// Solo admin/director pueden listar el directorio completo de usuarios;
// el filtro por Dirección de un "director" se agrega junto con el módulo
// de Proyectos en la Fase 1 (aquí solo se demuestra el guard de rol).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>) {}

  @Roles('admin', 'director')
  @Get()
  listar() {
    return this.usuarios.find({
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        mustChangePassword: true,
        verPresupuestoAutorizado: true,
      },
      relations: { rol: true, area: { direccion: true } },
      order: { id: 'ASC' },
    });
  }
}
