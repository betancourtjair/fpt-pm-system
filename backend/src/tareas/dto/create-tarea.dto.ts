import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTareaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  presupuesto?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  responsableId: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  usuarioIds?: number[];

  // Dependencias múltiples (cuarta ronda de mejoras) — esta tarea espera a
  // que TODAS las tareas de este arreglo terminen antes de poder iniciar.
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  dependeDeIds?: number[];

  @IsOptional()
  @IsIn(['alta', 'media', 'baja'])
  prioridad?: string;

  // Tareas recurrentes (cuarta ronda de mejoras) — si se manda un tipo, la
  // tarea se regenera sola (con las fechas desplazadas) cada vez que se
  // marca "completada".
  @IsOptional()
  @IsIn(['diaria', 'semanal', 'mensual'])
  recurrenciaTipo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recurrenciaIntervalo?: number;

  // Etiquetas libres (tercera ronda de mejoras) — texto libre, sin catálogo
  // cerrado; el límite de 30 caracteres por etiqueta es solo para que no se
  // usen como si fueran un segundo campo de descripción.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  etiquetas?: string[];

  // Recordatorio "día programado" (mejora reportada por el usuario) — se
  // dispara el día que la tarea está programada para iniciar, sin importar
  // si después se atrasa. Aplica a cualquier tarea, no solo a las
  // recurrentes.
  @IsOptional()
  @IsBoolean()
  recordarDiaProgramado?: boolean;
}
