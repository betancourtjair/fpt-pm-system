import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AutorizarPresupuestoDto } from './dto/autorizar-presupuesto.dto';

// RBAC (PID sección 9.2): admin ve el directorio completo; director ve
// solo su Dirección; gerente_area ve solo su Área (para poder elegir
// responsables/asignados al crear proyectos y tareas en su alcance).
// Crear/editar usuarios es exclusivo de admin (permiso manage_users en el
// catálogo de roles — ni director ni gerente_area lo tienen).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  // "colaborador" se agregó aquí (mejora reportada por el usuario: ya puede
  // crear proyectos y necesita elegir un Responsable) — el propio
  // UsuariosService.listar() lo acota a su misma Área, igual que
  // gerente_area, así que no gana visibilidad sobre el directorio completo.
  @Roles('admin', 'director', 'gerente_area', 'colaborador')
  @Get()
  listar(@CurrentUser() user: JwtPayload) {
    return this.usuarios.listar(user);
  }

  // IMPORTANTE: estas dos rutas van ANTES de "@Get(':id')" — Nest resuelve
  // las rutas de un controlador en el orden en que se declaran, así que si
  // ":id" quedara primero, una petición a "/usuarios/plantilla-excel"
  // haría match ahí (con "plantilla-excel" como si fuera el id) en vez de
  // llegar a este método.
  // Vista de carga de trabajo (tercera ronda de mejoras) — va ANTES de
  // "@Get(':id')" por el mismo motivo que "plantilla-excel"; mismos roles
  // que ya pueden ver /usuarios (es su misma lista, con conteos encima).
  @Roles('admin', 'director', 'gerente_area')
  @Get('carga-trabajo')
  cargaTrabajo(@CurrentUser() user: JwtPayload) {
    return this.usuarios.cargaTrabajo(user);
  }

  @Roles('admin')
  @Get('plantilla-excel')
  async plantillaExcel(@Res() res: Response) {
    const buffer = await this.usuarios.generarPlantillaExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Plantilla_Usuarios_FPT.xlsx"',
    });
    res.send(buffer);
  }

  @Roles('admin')
  @Post('importar-excel')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importarExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Sube un archivo .xlsx (usa la plantilla descargada desde el sistema).');
    return this.usuarios.importarExcel(file.buffer);
  }

  @Roles('admin')
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.usuarios.obtener(id);
  }

  @Roles('admin')
  @Post()
  crear(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  @Roles('admin')
  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuarios.actualizar(id, dto);
  }

  @Roles('admin', 'director')
  @Patch(':id/autorizar-presupuesto')
  autorizarPresupuesto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AutorizarPresupuestoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usuarios.autorizarPresupuesto(id, dto, user);
  }
}
