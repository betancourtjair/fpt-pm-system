import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Vistas/filtros guardados por usuario (tercera ronda de mejoras, ver
// README sección 4) — cada quien guarda su combinación favorita de filtros
// por pantalla ("mis tareas vencidas de alta prioridad") sin tener que
// volver a armarla cada vez.
@Entity('vistas_guardadas')
export class VistaGuardada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ type: 'varchar', length: 30 })
  pantalla: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'jsonb', default: {} })
  filtros: Record<string, unknown>;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
