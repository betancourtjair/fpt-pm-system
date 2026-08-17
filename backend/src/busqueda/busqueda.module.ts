import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { BusquedaController } from './busqueda.controller';
import { BusquedaService } from './busqueda.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tarea]), ProyectosModule],
  controllers: [BusquedaController],
  providers: [BusquedaService],
})
export class BusquedaModule {}
