import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';
import { Usuario } from '../entities/usuario.entity';
import { Proyecto } from '../entities/proyecto.entity';
import { Tarea } from '../entities/tarea.entity';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';

// Las tablas las crea db/schema.sql (DDL ya probado contra PostgreSQL — ver
// PID sección 5.2), por eso synchronize siempre va en false: TypeORM solo
// lee/escribe sobre un esquema que ya existe, nunca lo genera él mismo.
const ENTIDADES = [Direccion, Area, Rol, Usuario, Proyecto, Tarea, AlertaEnviada];

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
