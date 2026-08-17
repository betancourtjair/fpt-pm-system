import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { ArchivosService } from './archivos.service';

const LIMITE_TAMANO_BYTES = 15 * 1024 * 1024; // 15 MB — mismo límite que ArchivosService.

// Sin prefijo de clase: adjuntos se listan/suben anidados bajo su dueño
// (/proyectos/:id/archivos o /tareas/:id/archivos, sin colisión con las
// rutas ya existentes de esos controladores — mismo criterio que
// TareasController) pero se descargan/eliminan por su propio id
// (/archivos/:id/...). Todo el control de acceso vive en ArchivosService,
// reutilizando puedeVer/verificarPuedeGestionar de ProyectosService.
@UseGuards(JwtAuthGuard)
@Controller()
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  @Get('proyectos/:proyectoId/archivos')
  listarDeProyecto(@Param('proyectoId', ParseIntPipe) proyectoId: number, @CurrentUser() user: JwtPayload) {
    return this.archivos.listarDeProyecto(proyectoId, user);
  }

  @Post('proyectos/:proyectoId/archivos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_TAMANO_BYTES } }))
  subirAProyecto(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Sube un archivo.');
    return this.archivos.subirAProyecto(proyectoId, user, file);
  }

  @Get('tareas/:tareaId/archivos')
  listarDeTarea(@Param('tareaId', ParseIntPipe) tareaId: number, @CurrentUser() user: JwtPayload) {
    return this.archivos.listarDeTarea(tareaId, user);
  }

  @Post('tareas/:tareaId/archivos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_TAMANO_BYTES } }))
  subirATarea(
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Sube un archivo.');
    return this.archivos.subirATarea(tareaId, user, file);
  }

  @Get('archivos/:id/descargar')
  async descargar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload, @Res() res: Response) {
    const { buffer, nombreArchivo, tipoMime } = await this.archivos.descargar(id, user);
    res.set({
      'Content-Type': tipoMime,
      // encodeURIComponent: nombreArchivo es el nombre ORIGINAL (no el
      // saneado), puede traer acentos/espacios/etc.
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombreArchivo)}"`,
    });
    res.send(buffer);
  }

  @Delete('archivos/:id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.archivos.eliminar(id, user);
  }
}
