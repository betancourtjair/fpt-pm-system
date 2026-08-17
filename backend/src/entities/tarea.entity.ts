import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Proyecto } from './proyecto.entity';

// Módulo de Tareas / Gantt — Fase 1 del roadmap (PID sección 7).
@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'proyecto_id' })
  proyectoId: number;

  @ManyToOne(() => Proyecto)
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

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

  // Prioridad — mejora sugerida (ver README sección 4) para ayudar a un
  // responsable con muchas tareas a saber cuál atacar primero.
  @Column({ type: 'varchar', length: 10, default: 'media' })
  prioridad: string;

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;

  // Dependencia simple (Fase 1): esta tarea no puede iniciar hasta que
  // termine su predecesora. El Gantt la dibuja como una flecha entre barras.
  @Column({ name: 'dependencia_id', type: 'int', nullable: true })
  dependenciaId: number | null;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'dependencia_id' })
  dependencia: Tarea | null;

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'tarea_usuarios',
    joinColumn: { name: 'tarea_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
  })
  usuariosAsignados: Usuario[];
}
