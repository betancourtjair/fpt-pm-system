import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { BusquedaService } from './busqueda.service';

@UseGuards(JwtAuthGuard)
@Controller('buscar')
export class BusquedaController {
  constructor(private readonly busqueda: BusquedaService) {}

  @Get()
  buscar(@Query('q') q: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.busqueda.buscar(q ?? '', user);
  }
}
