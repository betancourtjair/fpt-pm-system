import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tarea } from './tarea.entity';
import { Usuario } from './usuario.entity';

// Bitácora de actividad por tarea (tercera ronda de mejoras, ver README
// sección 4) — cambios de estatus/responsable/prioridad, mostrados junto a
// los comentarios en una sola pestaña "Actividad".
export type TipoActividad = 'creacion' | 'cambio_estatus' | 'cambio_responsable' | 'cambio_prioridad';

@Entity('actividad_tarea')
export class ActividadTarea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tarea_id' })
  tareaId: number;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'tarea_id' })
  tarea: Tarea;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoActividad;

  @Column({ type: 'varchar', length: 300 })
  detalle: string;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
