import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { Usuario } from '../entities/usuario.entity';
import { EmailService } from '../common/email.service';
import { asuntoRestablecerPassword, htmlRestablecerPassword } from './reset-password.plantilla';

const VIGENCIA_TOKEN_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
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

  // Recuperar contraseña — a propósito SIEMPRE responde con el mismo
  // mensaje genérico exista o no la cuenta (para no filtrar qué correos
  // están registrados); el correo con el enlace solo se manda de verdad
  // cuando la cuenta sí existe y está activa.
  async olvidePassword(email: string): Promise<{ ok: true; mensaje: string }> {
    const mensaje = 'Si el correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña.';
    const usuario = await this.usuarios.findOne({ where: { email } });

    if (usuario && usuario.activo) {
      const token = randomBytes(32).toString('hex');
      usuario.resetPasswordTokenHash = hashToken(token);
      usuario.resetPasswordExpira = new Date(Date.now() + VIGENCIA_TOKEN_MS);
      await this.usuarios.save(usuario);

      const resultado = await this.emailService.enviar(
        usuario.email,
        asuntoRestablecerPassword(),
        htmlRestablecerPassword(usuario.nombre, token),
      );
      if (!resultado.ok) {
        this.logger.error(`No se pudo enviar el correo de recuperación a ${usuario.email}: ${resultado.error}`);
      }
    }

    return { ok: true, mensaje };
  }

  async restablecerPassword(token: string, nuevaPassword: string): Promise<{ ok: true }> {
    const usuario = await this.usuarios.findOne({ where: { resetPasswordTokenHash: hashToken(token) } });

    if (!usuario || !usuario.resetPasswordExpira || usuario.resetPasswordExpira.getTime() < Date.now()) {
      throw new BadRequestException('El enlace no es válido o ya expiró — solicita uno nuevo.');
    }

    usuario.passwordHash = await bcrypt.hash(nuevaPassword, 10);
    usuario.mustChangePassword = false;
    usuario.resetPasswordTokenHash = null;
    usuario.resetPasswordExpira = null;
    await this.usuarios.save(usuario);

    return { ok: true };
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
