import { ArrayMinSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePlantillaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombre: string;

  // Al menos un ítem — una plantilla vacía no tendría sentido.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  @MinLength(1, { each: true })
  items: string[];
}
