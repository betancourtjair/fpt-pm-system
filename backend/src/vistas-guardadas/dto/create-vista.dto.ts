import { IsIn, IsObject, IsString, MaxLength, MinLength } from 'class-validator';

// Pantallas donde tiene sentido guardar una combinación de filtros — lista
// fija en vez de texto libre para no acumular basura ("Proyectos ", "proyecto")
// que luego nunca haga match al listar.
export const PANTALLAS_CON_VISTAS = ['proyectos', 'mis-tareas', 'kanban', 'calendario'] as const;

export class CreateVistaDto {
  @IsIn(PANTALLAS_CON_VISTAS)
  pantalla: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre: string;

  // Estructura libre: cada pantalla define sus propios filtros (estado,
  // responsable, rango de fechas, etc.), el backend solo la guarda y la
  // devuelve tal cual.
  @IsObject()
  filtros: Record<string, unknown>;
}
