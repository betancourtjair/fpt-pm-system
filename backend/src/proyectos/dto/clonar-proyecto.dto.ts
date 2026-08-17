import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

// Plantillas de proyecto (mejora sugerida, ver README sección 4): clonar un
// proyecto existente con todas sus tareas en vez de capturarlo desde cero
// cada vez que se repite un tipo de proyecto (abrir una sucursal, lanzar un
// reto, etc.).
export class ClonarProyectoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @IsDateString()
  fechaInicio: string;
}
