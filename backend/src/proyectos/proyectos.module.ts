import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { Proyecto } from '../entities/proyecto.entity';
import { Area } from '../entities/area.entity';
import { Usuario } from '../entities/usuario.entity';
import { Direccion } from '../entities/direccion.entity';
import { GastoProyecto } from '../entities/gasto-proyecto.entity';
import { Tarea } from '../entities/tarea.entity';

@Module({
  // Tarea se registra también aquí (además de en TareasModule) para que
  // ProyectosService.clonar() pueda copiar las tareas del proyecto origen
  // sin crear una dependencia circular entre los dos módulos.
  imports: [TypeOrmModule.forFeature([Proyecto, Area, Usuario, Direccion, GastoProyecto, Tarea])],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  // TareasModule reutiliza puedeVer/verificarPuedeGestionar para no duplicar
  // la lógica de alcance por rol (PID sección 9.2).
  exports: [ProyectosService],
})
export class ProyectosModule {}
