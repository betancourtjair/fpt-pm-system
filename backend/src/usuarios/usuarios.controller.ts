import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AutorizarPresupuestoDto } from './dto/autorizar-presupuesto.dto';

// RBAC (PID sección 9.2): admin ve el directorio completo; director ve
// solo su Dirección; gerente_area ve solo su Área (para poder elegir
// responsables/asignados al crear proyectos y tareas en su alcance).
// Crear/editar usuarios es exclusivo de admin (permiso manage_users en el
// catálogo de roles — ni director ni gerente_area lo tienen).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Roles('admin', 'director', 'gerente_area')
  @Get()
  listar(@CurrentUser() user: JwtPayload) {
    return this.usuarios.listar(user);
  }

  @Roles('admin')
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.obtener(id);
  }

  @Roles('admin')
  @Post()
  crear(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  @Roles('admin')
  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuarios.actualizar(id, dto);
  }

  @Roles('admin', 'director')
  @Patch(':id/autorizar-presupuesto')
  autorizarPresupuesto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AutorizarPresupuestoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usuarios.autorizarPresupuesto(id, dto, user);
  }
}
