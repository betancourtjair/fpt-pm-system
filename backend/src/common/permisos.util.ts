import { JwtPayload } from '../auth/auth.service';

// Helpers de permisos por rol — ver catálogo confirmado en el PID, sección
// 9.2 (permisos JSON de cada rol) y la regla de negocio de presupuesto
// (PID sección 2.1 y 8: gerente_area solo ve presupuesto si su Director o
// un admin lo autoriza explícitamente).

export function puedeGestionarProyectos(user: JwtPayload): boolean {
  return Boolean(user.permisos?.manage_projects);
}

export function puedeGestionarTareas(user: JwtPayload): boolean {
  return Boolean(user.permisos?.manage_tasks);
}

// El presupuesto solo se muestra si: el rol lo administra (admin/director),
// o el rol es candidato a verlo Y el usuario específico está autorizado.
export function puedeVerPresupuesto(user: JwtPayload, autorizado: boolean): boolean {
  if (user.permisos?.manage_budget) return true;
  if (user.permisos?.view_budget_if_authorized) return autorizado;
  return false;
}

export function esAdmin(user: JwtPayload): boolean {
  return user.rol === 'admin';
}

export function esDirector(user: JwtPayload): boolean {
  return user.rol === 'director';
}

export function esGerenteArea(user: JwtPayload): boolean {
  return user.rol === 'gerente_area';
}

// Mejora reportada por el usuario: un colaborador ahora también puede crear
// proyectos (antes solo admin/director/gerente_area) — el permiso real vive
// en roles.permisos.manage_projects (ver seed/migración 019), este helper
// solo identifica el rol para acotar su alcance a su propia Área, igual que
// gerente_area (ver ProyectosService.validarAreasEnAlcance/verificarPuedeGestionar).
export function esColaborador(user: JwtPayload): boolean {
  return user.rol === 'colaborador';
}
