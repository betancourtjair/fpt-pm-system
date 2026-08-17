import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';
import { NotificacionesController } from './notificaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AlertaEnviada])],
  controllers: [NotificacionesController],
})
export class NotificacionesModule {}
