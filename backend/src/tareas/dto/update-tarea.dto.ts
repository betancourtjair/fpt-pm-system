import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTareaDto } from './create-tarea.dto';

export class UpdateTareaDto extends PartialType(CreateTareaDto) {
  @IsOptional()
  @IsIn(['no_iniciada', 'en_progreso', 'completada', 'bloqueada'])
  estatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  porcentajeAvance?: number;

  // Permite "apagar" una recurrencia ya configurada (deja de generar la
  // siguiente ocurrencia) sin tener que quitarle el tipo/intervalo.
  @IsOptional()
  @IsBoolean()
  recurrenciaActiva?: boolean;
}

// Subconjunto de campos que un colaborador asignado puede actualizar por sí
// mismo (sin permiso manage_projects) — ver PID sección 9.2.
export class ActualizarAvanceDto {
  @IsOptional()
  @IsIn(['no_iniciada', 'en_progreso', 'completada', 'bloqueada'])
  estatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  porcentajeAvance?: number;
}
