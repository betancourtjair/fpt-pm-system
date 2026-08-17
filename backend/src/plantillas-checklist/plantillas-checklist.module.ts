import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlantillaChecklist } from '../entities/plantilla-checklist.entity';
import { PlantillaChecklistItem } from '../entities/plantilla-checklist-item.entity';
import { SubtareaChecklist } from '../entities/subtarea-checklist.entity';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { PlantillasChecklistController } from './plantillas-checklist.controller';
import { PlantillasChecklistService } from './plantillas-checklist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlantillaChecklist, PlantillaChecklistItem, SubtareaChecklist, Tarea]),
    ProyectosModule,
  ],
  controllers: [PlantillasChecklistController],
  providers: [PlantillasChecklistService],
})
export class PlantillasChecklistModule {}
