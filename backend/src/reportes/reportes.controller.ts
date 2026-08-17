import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ReportesService } from './reportes.service';

@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('resumen')
  resumen(@CurrentUser() user: JwtPayload) {
    return this.reportes.resumen(user);
  }

  @Get('tendencia')
  tendencia(@Query('meses') meses: string | undefined, @CurrentUser() user: JwtPayload) {
    const n = meses ? Number(meses) : 6;
    return this.reportes.tendencia(user, Number.isFinite(n) && n > 0 ? n : 6);
  }
}
