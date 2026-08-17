import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { CreateGastoDto } from './dto/create-gasto.dto';

// Toda la lógica de alcance/permisos por rol vive en ProyectosService — el
// controlador solo enruta y valida el body (PID sección 9.2).
@UseGuards(JwtAuthGuard)
@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectos: ProyectosService) {}

  @Get()
  listar(@CurrentUser() user: JwtPayload) {
    return this.proyectos.listar(user);
  }

  // IMPORTANTE: esta ruta va ANTES de "@Get(':id')" — si no, Nest la
  // resolvería como si "exportar-excel" fuera un :id (mismo motivo que en
  // UsuariosController con "plantilla-excel").
  @Get('exportar-excel')
  async exportarExcel(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const buffer = await this.proyectos.exportarExcel(user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Proyectos_FPT.xlsx"',
    });
    res.send(buffer);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.proyectos.obtener(id, user);
  }

  @Post()
  crear(@Body() dto: CreateProyectoDto, @CurrentUser() user: JwtPayload) {
    return this.proyectos.crear(dto, user);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.proyectos.actualizar(id, dto, user);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.proyectos.eliminar(id, user);
  }

  // Presupuesto real vs. plan (prioridad 8) — anidado bajo el proyecto para
  // reutilizar exactamente las mismas reglas de alcance/permiso que ya
  // tiene ProyectosService, sin duplicar lógica en un módulo aparte.
  @Get(':id/gastos')
  listarGastos(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.proyectos.listarGastos(id, user);
  }

  @Post(':id/gastos')
  crearGasto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateGastoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.proyectos.crearGasto(id, dto, user);
  }

  @Delete(':id/gastos/:gastoId')
  eliminarGasto(
    @Param('id', ParseIntPipe) id: number,
    @Param('gastoId', ParseIntPipe) gastoId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.proyectos.eliminarGasto(id, gastoId, user);
  }
}
