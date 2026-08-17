import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateReglaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsIn(['alta', 'media', 'baja'])
  condicionPrioridad?: string;

  @IsOptional()
  @IsIn(['no_iniciada', 'en_progreso', 'completada', 'bloqueada'])
  condicionEstatus?: string;

  @IsOptional()
  @IsBoolean()
  condicionVencida?: boolean;

  @IsIn(['notificar_responsable', 'notificar_director', 'notificar_usuario'])
  accionTipo: 'notificar_responsable' | 'notificar_director' | 'notificar_usuario';

  // Solo se exige (y solo se valida) cuando accionTipo === 'notificar_usuario'
  // — para las otras dos acciones el destinatario se resuelve solo.
  @ValidateIf((o) => o.accionTipo === 'notificar_usuario')
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  accionUsuarioId?: number;
}
