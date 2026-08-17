import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { SubtareasService } from './subtareas.service';
import { CreateSubtareaDto } from './dto/create-subtarea.dto';
import { UpdateSubtareaDto } from './dto/update-subtarea.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class SubtareasController {
  constructor(private readonly subtareas: SubtareasService) {}

  @Get('tareas/:tareaId/subtareas')
  listar(@Param('tareaId', ParseIntPipe) tareaId: number, @CurrentUser() user: JwtPayload) {
    return this.subtareas.listar(tareaId, user);
  }

  @Post('tareas/:tareaId/subtareas')
  crear(
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Body() dto: CreateSubtareaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subtareas.crear(tareaId, dto, user);
  }

  @Patch('subtareas/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubtareaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.subtareas.actualizar(id, dto, user);
  }

  @Delete('subtareas/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.subtareas.eliminar(id, user);
  }
}
