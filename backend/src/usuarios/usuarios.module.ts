import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { Area } from '../entities/area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, Area])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
