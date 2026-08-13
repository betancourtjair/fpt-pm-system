import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogoController } from './catalogo.controller';
import { Direccion } from '../entities/direccion.entity';
import { Area } from '../entities/area.entity';
import { Rol } from '../entities/rol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Direccion, Area, Rol])],
  controllers: [CatalogoController],
})
export class CatalogoModule {}
