import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';

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
}
