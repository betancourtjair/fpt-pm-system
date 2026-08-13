import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Entidad de referencia — el módulo de API para Tareas/Gantt se construye en
// la Fase 1 del roadmap (PID sección 7).
@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'proyecto_id' })
  proyectoId: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  presupuesto: string | null;

  @Column({ type: 'varchar', length: 30, default: 'no_iniciada' })
  estatus: string;

  @Column({ name: 'porcentaje_avance', type: 'smallint', default: 0 })
  porcentajeAvance: number;
}
