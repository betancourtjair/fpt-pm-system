import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';
import { Usuario } from '../entities/usuario.entity';
import { Proyecto } from '../entities/proyecto.entity';
import { Tarea } from '../entities/tarea.entity';

// Las tablas las crea db/schema.sql (DDL ya probado contra PostgreSQL — ver
// PID sección 5.2), por eso synchronize siempre va en false: TypeORM solo
// lee/escribe sobre un esquema que ya existe, nunca lo genera él mismo.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Direccion, Area, Rol, Usuario, Proyecto, Tarea],
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([Direccion, Area, Rol, Usuario, Proyecto, Tarea]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
