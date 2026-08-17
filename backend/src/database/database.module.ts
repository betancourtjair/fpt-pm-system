import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';
import { Usuario } from '../entities/usuario.entity';
import { Proyecto } from '../entities/proyecto.entity';
import { Tarea } from '../entities/tarea.entity';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';
import { GastoProyecto } from '../entities/gasto-proyecto.entity';
import { Adjunto } from '../entities/adjunto.entity';
import { ComentarioTarea } from '../entities/comentario-tarea.entity';
import { ReglaAutomatizacion } from '../entities/regla-automatizacion.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { SubtareaChecklist } from '../entities/subtarea-checklist.entity';
import { ActividadTarea } from '../entities/actividad-tarea.entity';
import { VistaGuardada } from '../entities/vista-guardada.entity';
import { PlantillaChecklist } from '../entities/plantilla-checklist.entity';
import { PlantillaChecklistItem } from '../entities/plantilla-checklist-item.entity';

// Las tablas las crea db/schema.sql (DDL ya probado contra PostgreSQL — ver
// PID sección 5.2), por eso synchronize siempre va en false: TypeORM solo
// lee/escribe sobre un esquema que ya existe, nunca lo genera él mismo.
const ENTIDADES = [
  Direccion,
  Area,
  Rol,
  Usuario,
  Proyecto,
  Tarea,
  AlertaEnviada,
  GastoProyecto,
  Adjunto,
  ComentarioTarea,
  ReglaAutomatizacion,
  NotificacionPersonalizada,
  SubtareaChecklist,
  ActividadTarea,
  VistaGuardada,
  PlantillaChecklist,
  PlantillaChecklistItem,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ENTIDADES,
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature(ENTIDADES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
