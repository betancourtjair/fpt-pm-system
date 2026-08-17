import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';
import { NotificacionPersonalizada } from '../entities/notificacion-personalizada.entity';
import { NotificacionesController } from './notificaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AlertaEnviada, NotificacionPersonalizada])],
  controllers: [NotificacionesController],
})
export class NotificacionesModule {}
