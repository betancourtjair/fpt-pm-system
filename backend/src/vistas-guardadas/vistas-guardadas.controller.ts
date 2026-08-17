import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { VistasGuardadasService } from './vistas-guardadas.service';
import { CreateVistaDto } from './dto/create-vista.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class VistasGuardadasController {
  constructor(private readonly vistas: VistasGuardadasService) {}

  @Get('vistas-guardadas')
  listar(@Query('pantalla') pantalla: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.vistas.listar(pantalla, user);
  }

  @Post('vistas-guardadas')
  crear(@Body() dto: CreateVistaDto, @CurrentUser() user: JwtPayload) {
    return this.vistas.crear(dto, user);
  }

  @Delete('vistas-guardadas/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.vistas.eliminar(id, user);
  }
}
