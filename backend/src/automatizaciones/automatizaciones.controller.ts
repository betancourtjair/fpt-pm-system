import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AutomatizacionesService } from './automatizaciones.service';
import { CreateReglaDto } from './dto/create-regla.dto';
import { UpdateReglaDto } from './dto/update-regla.dto';

// Automatizaciones configurables (tercera ronda de mejoras, ver README
// sección 4) — anidadas bajo su proyecto para listar/crear, sueltas por su
// propio id para editar/borrar (mismo patrón que Gastos/Comentarios).
@UseGuards(JwtAuthGuard)
@Controller()
export class AutomatizacionesController {
  constructor(private readonly automatizaciones: AutomatizacionesService) {}

  @Get('proyectos/:proyectoId/automatizaciones')
  listar(@Param('proyectoId', ParseIntPipe) proyectoId: number, @CurrentUser() user: JwtPayload) {
    return this.automatizaciones.listar(proyectoId, user);
  }

  @Post('proyectos/:proyectoId/automatizaciones')
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CreateReglaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.automatizaciones.crear(proyectoId, dto, user);
  }

  @Patch('automatizaciones/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReglaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.automatizaciones.actualizar(id, dto, user);
  }

  @Delete('automatizaciones/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.automatizaciones.eliminar(id, user);
  }
}
