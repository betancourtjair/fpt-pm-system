import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComentariosController } from './comentarios.controller';
import { ComentariosService } from './comentarios.service';
import { ComentarioTarea } from '../entities/comentario-tarea.entity';
import { Tarea } from '../entities/tarea.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';

@Module({
  imports: [TypeOrmModule.forFeature([ComentarioTarea, Tarea]), ProyectosModule],
  controllers: [ComentariosController],
  providers: [ComentariosService],
})
export class ComentariosModule {}
