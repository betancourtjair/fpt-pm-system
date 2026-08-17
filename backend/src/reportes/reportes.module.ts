import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tarea]), ProyectosModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
