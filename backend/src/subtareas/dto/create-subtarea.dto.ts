import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSubtareaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  texto: string;
}
