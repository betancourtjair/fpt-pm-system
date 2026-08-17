import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ComentariosService } from './comentarios.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ComentariosController {
  constructor(private readonly comentarios: ComentariosService) {}

  @Get('tareas/:tareaId/comentarios')
  listar(@Param('tareaId', ParseIntPipe) tareaId: number, @CurrentUser() user: JwtPayload) {
    return this.comentarios.listar(tareaId, user);
  }

  @Post('tareas/:tareaId/comentarios')
  crear(
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Body() dto: CreateComentarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.comentarios.crear(tareaId, dto, user);
  }

  @Delete('comentarios/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.comentarios.eliminar(id, user);
  }
}
