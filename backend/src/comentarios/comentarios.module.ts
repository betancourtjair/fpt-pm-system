import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComentariosController } from './comentarios.controller';
import { ComentariosService } from './comentarios.service';
import { ComentarioTarea } from '../entities/comentario-tarea.entity';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComentarioTarea, Tarea, Usuario, NotificacionPersonalizada]),
    ProyectosModule,
  ],
  controllers: [ComentariosController],
  providers: [ComentariosService],
  // ActividadModule combina comentarios + bitácora en una sola pestaña
  // "Actividad" (tercera ronda de mejoras) — reutiliza tareaEnAlcance() vía
  // listar(), no duplica la validación de alcance.
  exports: [ComentariosService],
})
export class ComentariosModule {}
