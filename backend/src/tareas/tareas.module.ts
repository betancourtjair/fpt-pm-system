import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';

@Module({
  // ProyectosModule exporta ProyectosService: reutilizamos puedeVer /
  // verificarPuedeGestionar / autorizacionPresupuesto (no hay ciclo, solo
  // TareasModule depende de ProyectosModule, no al revés).
  imports: [TypeOrmModule.forFeature([Tarea, Usuario]), ProyectosModule],
  controllers: [TareasController],
  providers: [TareasService],
})
export class TareasModule {}
