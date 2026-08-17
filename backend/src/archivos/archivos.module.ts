import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';
import { ArchivosStorageService } from './archivos-storage.service';
import { Adjunto } from '../entities/adjunto.entity';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';

@Module({
  // ProyectosModule exporta ProyectosService: reutilizamos puedeVer /
  // verificarPuedeGestionar (mismo patrón que TareasModule) — la
  // dependencia va en un solo sentido, ni Proyectos ni Tareas necesitan
  // saber nada de adjuntos.
  imports: [TypeOrmModule.forFeature([Adjunto, Tarea]), ProyectosModule],
  controllers: [ArchivosController],
  providers: [ArchivosService, ArchivosStorageService],
})
export class ArchivosModule {}
