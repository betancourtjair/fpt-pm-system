import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

// EmailService es una envoltura genérica sobre Resend (sin dependencias de
// entidades de Alertas), así que vive en common/ y cualquier módulo que
// necesite mandar un correo lo importa desde aquí — hoy lo usan Alertas
// (asignación/recordatorios) y Auth (recuperar contraseña).
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
