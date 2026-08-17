import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { AlertasService } from './alertas.service';
import { AlertasController } from './alertas.controller';
import { EmailService } from './email.service';

@Module({
  imports: [TypeOrmModule.forFeature([AlertaEnviada, Tarea, Usuario])],
  controllers: [AlertasController],
  providers: [AlertasService, EmailService],
  exports: [AlertasService],
})
export class AlertasModule {}
