import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Uso: @Roles('admin', 'director') sobre un controlador o método.
// Ver catálogo de roles confirmado en el PID, sección 9.2.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
