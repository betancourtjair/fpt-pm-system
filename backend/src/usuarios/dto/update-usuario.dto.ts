import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Edición de usuarios — solo admin. areaId acepta null explícito (para
// vaciar el área al cambiar a rol admin); cualquier otro valor se valida
// como entero positivo. nuevaPassword es un reset de contraseña opcional:
// si viene, se vuelve a forzar mustChangePassword (mismo patrón que el
// alta inicial de usuarios en seed.sql).
export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  nombre?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  rolId?: number;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  areaId?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  nuevaPassword?: string;
}
