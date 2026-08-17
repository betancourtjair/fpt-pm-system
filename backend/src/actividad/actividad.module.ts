import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadTarea } from '../entities/actividad-tarea.entity';
import { ActividadService } from './actividad.service';
import { ActividadController } from './actividad.controller';
import { ComentariosModule } from '../comentarios/comentarios.module';

@Module({
  imports: [TypeOrmModule.forFeature([ActividadTarea]), ComentariosModule],
  controllers: [ActividadController],
  providers: [ActividadService],
  // TareasModule llama registrar() en cada cambio relevante.
  exports: [ActividadService],
})
export class ActividadModule {}
