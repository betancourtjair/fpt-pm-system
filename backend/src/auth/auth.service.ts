import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../entities/usuario.entity';

export interface JwtPayload {
  sub: number;
  email: string;
  rol: string;
  areaId: number | null;
  direccionId: number | null;
  permisos: Record<string, unknown>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  private async findWithRelations(where: FindOptionsWhere<Usuario>) {
    return this.usuarios.findOne({
      where,
      relations: { rol: true, area: { direccion: true } },
    });
  }

  async login(email: string, password: string) {
    const usuario = await this.findWithRelations({ email });

    // Mensaje genérico a propósito: no revelar si el correo existe o no.
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const valido = await bcrypt.compare(password, usuario.passwordHash);
    if (!valido) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      areaId: usuario.areaId,
      direccionId: usuario.area?.direccionId ?? null,
      permisos: usuario.rol.permisos,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: this.toPublicUser(usuario),
    };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const usuario = await this.usuarios.findOne({ where: { id: userId } });
    if (!usuario) throw new UnauthorizedException();

    const valido = await bcrypt.compare(currentPassword, usuario.passwordHash);
    if (!valido) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    usuario.passwordHash = await bcrypt.hash(newPassword, 10);
    usuario.mustChangePassword = false;
    await this.usuarios.save(usuario);

    return { ok: true };
  }

  async me(userId: number) {
    const usuario = await this.findWithRelations({ id: userId });
    if (!usuario) throw new UnauthorizedException();
    return this.toPublicUser(usuario);
  }

  private toPublicUser(usuario: Usuario) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol.nombre,
      areaId: usuario.areaId,
      direccionId: usuario.area?.direccionId ?? null,
      area: usuario.area?.nombre ?? null,
      direccion: usuario.area?.direccion?.nombre ?? null,
      mustChangePassword: usuario.mustChangePassword,
      verPresupuestoAutorizado: usuario.verPresupuestoAutorizado,
      permisos: usuario.rol.permisos,
    };
  }
}
