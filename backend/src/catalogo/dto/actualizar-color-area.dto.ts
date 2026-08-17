import { Matches } from 'class-validator';

// Personalización de color por Área (solo admin) — ver paleta-colores.ts
// para el default que se usa mientras no se guarde ninguno a mano.
export class ActualizarColorAreaDto {
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un hex válido, por ejemplo #2563EB.' })
  color: string;
}
