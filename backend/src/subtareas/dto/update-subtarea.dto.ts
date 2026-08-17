import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSubtareaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  texto?: string;

  @IsOptional()
  @IsBoolean()
  completada?: boolean;
}
