import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../entities/usuario.entity';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_.env',
    });
  }

  // El valor de retorno queda disponible como `request.user` en cada request
  // autenticado. A propósito NO se confía ciegamente en lo que dice el
  // payload firmado — el rol/permisos/estatus se vuelven a resolver contra
  // la base en cada request. Así, si un admin desactiva una cuenta o le
  // cambia el rol, el efecto es inmediato: no hay que esperar a que ese
  // token expire solo (podía tardar hasta 3 horas). El costo es una
  // consulta más por request, aceptable a esta escala.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      relations: { rol: true, area: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Tu cuenta ya no tiene acceso — contacta a un administrador.');
    }
    return {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      areaId: usuario.areaId,
      direccionId: usuario.area?.direccionId ?? null,
      permisos: usuario.rol.permisos,
    };
  }
}
