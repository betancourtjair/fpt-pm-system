import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VistaGuardada } from '../entities/vista-guardada.entity';
import { VistasGuardadasController } from './vistas-guardadas.controller';
import { VistasGuardadasService } from './vistas-guardadas.service';

@Module({
  imports: [TypeOrmModule.forFeature([VistaGuardada])],
  controllers: [VistasGuardadasController],
  providers: [VistasGuardadasService],
})
export class VistasGuardadasModule {}
