import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

// Límite estricto (5 intentos/minuto por IP) en los tres endpoints
// públicos de autenticación — son el blanco típico de fuerza bruta
// (login) o de enumeración de correos registrados (recuperar contraseña).
// El resto de la API usa el tope global, más generoso (ver AppModule).
const LIMITE_AUTH = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle(LIMITE_AUTH)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // Sin guard: se usa desde el login, antes de tener sesión. Ver
  // AuthService.olvidePassword para el porqué de la respuesta genérica.
  @Throttle(LIMITE_AUTH)
  @Post('olvide-password')
  olvidePassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.olvidePassword(dto.email);
  }

  @Throttle(LIMITE_AUTH)
  @Post('restablecer-password')
  restablecerPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.restablecerPassword(dto.token, dto.nuevaPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  // Fuerza el cambio de la contraseña temporal en el primer login
  // (regla de seguridad confirmada en el PID, sección 8 — riesgo de admin/admin).
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
