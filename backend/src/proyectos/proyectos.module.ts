import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { Proyecto } from '../entities/proyecto.entity';
import { Area } from '../entities/area.entity';
import { Usuario } from '../entities/usuario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Proyecto, Area, Usuario])],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  // TareasModule reutiliza puedeVer/verificarPuedeGestionar para no duplicar
  // la lógica de alcance por rol (PID sección 9.2).
  exports: [ProyectosService],
})
export class ProyectosModule {}
