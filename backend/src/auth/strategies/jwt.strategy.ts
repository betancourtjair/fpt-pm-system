import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_.env',
    });
  }

  // El valor de retorno queda disponible como `request.user` en cada request autenticado.
  async validate(payload: JwtPayload) {
    return payload;
  }
}
