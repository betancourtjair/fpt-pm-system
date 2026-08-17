import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReglaAutomatizacion } from '../entities/regla-automatizacion.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { Usuario } from '../entities/usuario.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { AutomatizacionesController } from './automatizaciones.controller';
import { AutomatizacionesService } from './automatizaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReglaAutomatizacion, NotificacionPersonalizada, Usuario]),
    ProyectosModule,
  ],
  controllers: [AutomatizacionesController],
  providers: [AutomatizacionesService],
  // TareasModule llama evaluarTransicion() después de cada cambio de tarea.
  exports: [AutomatizacionesService],
})
export class AutomatizacionesModule {}
