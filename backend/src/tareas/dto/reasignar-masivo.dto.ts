import { ArrayMinSize, ArrayNotEmpty, IsInt, IsPositive } from 'class-validator';

// Reasignación masiva de responsable (prioridad 11, segunda mitad — junto
// con adjuntos). Solo toca `responsableId`, no toca usuariosAsignados: es
// para el caso "esta tanda de tareas ahora las lleva Fulano", no para
// reemplazar todo el equipo asignado a cada una.
export class ReasignarMasivoDto {
  @ArrayNotEmpty({ message: 'Selecciona al menos una tarea.' })
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  tareaIds: number[];

  @IsInt()
  @IsPositive()
  responsableId: number;
}
