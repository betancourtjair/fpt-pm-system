import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Debe usarse SIEMPRE después de JwtAuthGuard (necesita request.user ya poblado).
// Ejemplo: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin', 'director')
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !rolesPermitidos.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción.');
    }
    return true;
  }
}
