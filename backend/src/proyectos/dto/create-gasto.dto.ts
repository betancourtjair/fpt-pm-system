import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

// Un movimiento de gasto real (prioridad 8: presupuesto real vs. plan).
export class CreateGastoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  concepto: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto: number;

  @IsDateString()
  fecha: string;
}
