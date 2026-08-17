import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Usuario } from '../entities/usuario.entity';
import { EmailModule } from '../common/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    PassportModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_.env',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule también se exporta: RealtimeModule (Fase 2, WebSockets) lo
  // necesita para validar el token del handshake de Socket.IO con el mismo
  // JwtService/secreto que ya usa la API REST, sin duplicar configuración.
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
