import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Alta de usuarios — solo admin (manage_users, ver catálogo de roles en
// db/seed.sql). areaId es opcional aquí a propósito: el rol "admin" no
// pertenece a ninguna Dirección/Área (su alcance es global); para
// cualquier otro rol, UsuariosService.validarRolYArea exige un área.
export class CreateUsuarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  nombre: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  rolId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  areaId?: number;
}
