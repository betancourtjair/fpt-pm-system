import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { PlantillasChecklistService } from './plantillas-checklist.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';

@UseGuards(JwtAuthGuard)
@Controller('plantillas-checklist')
export class PlantillasChecklistController {
  constructor(private readonly plantillas: PlantillasChecklistService) {}

  @Get()
  listar() {
    return this.plantillas.listar();
  }

  @Post()
  crear(@Body() dto: CreatePlantillaDto, @CurrentUser() user: JwtPayload) {
    return this.plantillas.crear(dto, user);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.plantillas.eliminar(id, user);
  }

  @Post(':id/aplicar-a-tarea/:tareaId')
  aplicarATarea(
    @Param('id', ParseIntPipe) id: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.plantillas.aplicarATarea(id, tareaId, user);
  }
}
