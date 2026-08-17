import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tarea } from './tarea.entity';

// Subtareas / checklist (tercera ronda de mejoras, ver README sección 4):
// pasos chicos dentro de una tarea, sin responsable/fechas propias — para
// eso ya existe una tarea completa con dependencia.
@Entity('subtareas_checklist')
export class SubtareaChecklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tarea_id' })
  tareaId: number;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'tarea_id' })
  tarea: Tarea;

  @Column({ type: 'varchar', length: 300 })
  texto: string;

  @Column({ type: 'boolean', default: false })
  completada: boolean;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
