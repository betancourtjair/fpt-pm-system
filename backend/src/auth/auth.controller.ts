import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // Sin guard: se usa desde el login, antes de tener sesión. Ver
  // AuthService.olvidePassword para el porqué de la respuesta genérica.
  @Post('olvide-password')
  olvidePassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.olvidePassword(dto.email);
  }

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
