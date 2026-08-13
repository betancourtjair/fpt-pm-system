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
import { TareasService } from './tareas.service';
import { CreateTareaDto } from './dto/create-tarea.dto';
import { UpdateTareaDto, ActualizarAvanceDto } from './dto/update-tarea.dto';

// Sin prefijo de clase: las tareas se listan/crean anidadas bajo su
// proyecto (/proyectos/:proyectoId/tareas) pero se leen/editan/eliminan por
// su propio id (/tareas/:id) — ver diseño en ProyectosService/TareasService.
@UseGuards(JwtAuthGuard)
@Controller()
export class TareasController {
  constructor(private readonly tareas: TareasService) {}

  @Get('proyectos/:proyectoId/tareas')
  listar(@Param('proyectoId', ParseIntPipe) proyectoId: number, @CurrentUser() user: JwtPayload) {
    return this.tareas.listar(proyectoId, user);
  }

  @Post('proyectos/:proyectoId/tareas')
  crear(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Body() dto: CreateTareaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tareas.crear(proyectoId, dto, user);
  }

  @Get('tareas/:id')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.tareas.obtener(id, user);
  }

  @Patch('tareas/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTareaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tareas.actualizar(id, dto, user);
  }

  @Patch('tareas/:id/avance')
  actualizarAvance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAvanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tareas.actualizarAvance(id, dto, user);
  }

  @Delete('tareas/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.tareas.eliminar(id, user);
  }
}
