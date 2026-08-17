import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubtareaChecklist } from '../entities/subtarea-checklist.entity';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { SubtareasController } from './subtareas.controller';
import { SubtareasService } from './subtareas.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubtareaChecklist, Tarea]), ProyectosModule],
  controllers: [SubtareasController],
  providers: [SubtareasService],
})
export class SubtareasModule {}
