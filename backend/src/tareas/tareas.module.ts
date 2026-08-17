import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { AlertasModule } from '../alertas/alertas.module';
import { AutomatizacionesModule } from '../automatizaciones/automatizaciones.module';
import { ActividadModule } from '../actividad/actividad.module';

@Module({
  // ProyectosModule exporta ProyectosService: reutilizamos puedeVer /
  // verificarPuedeGestionar / autorizacionPresupuesto (no hay ciclo, solo
  // TareasModule depende de ProyectosModule, no al revés). AlertasModule
  // exporta AlertasService: se usa para la alerta "asignacion" (Fase 2).
  // AutomatizacionesModule (tercera ronda de mejoras): evaluarTransicion()
  // después de cada cambio. ActividadModule: registra cada cambio relevante
  // en la bitácora de la tarea.
  imports: [
    TypeOrmModule.forFeature([Tarea, Usuario]),
    ProyectosModule,
    AlertasModule,
    AutomatizacionesModule,
    ActividadModule,
  ],
  controllers: [TareasController],
  providers: [TareasService],
})
export class TareasModule {}
