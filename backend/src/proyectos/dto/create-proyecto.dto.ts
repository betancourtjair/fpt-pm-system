import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Campos obligatorios confirmados en el alcance del sistema: fechas,
// responsable y áreas/usuarios asignados (PID sección 2.1). El presupuesto
// es opcional (mejora reportada por el usuario): no todos los proyectos
// llevan uno definido desde el arranque.
export class CreateProyectoDto {
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

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  areaIds: number[];

  @IsOptional()
  @IsString()
  estatus?: string;
}
