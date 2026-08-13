import { IsBoolean } from 'class-validator';

// Ver regla de negocio confirmada (PID sección 2.1 y 8): el flag es
// mutable en cualquier momento por un admin, o por el Director de la
// misma Dirección del gerente_area objetivo.
export class AutorizarPresupuestoDto {
  @IsBoolean()
  autorizar: boolean;
}
