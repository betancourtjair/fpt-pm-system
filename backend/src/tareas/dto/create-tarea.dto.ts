import { Type } from 'class-transformer';
import {
  IsArray,
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dependenciaId?: number;

  @IsOptional()
  @IsIn(['alta', 'media', 'baja'])
  prioridad?: string;
}
