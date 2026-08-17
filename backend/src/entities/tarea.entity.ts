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

  // Etiquetas libres (tercera ronda de mejoras, ver README sección 4):
  // texto libre además de prioridad, para que cada Dirección organice por
  // lo que necesite ("cliente X", "urgente-legal") sin tocar el esquema.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  etiquetas: string[];

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;

  // Dependencias múltiples (cuarta ronda de mejoras, ver README sección 4):
  // reemplaza la dependencia simple original (columna `dependencia_id`, que
  // se deja en la base sin usar) — esta tarea no puede iniciar hasta que
  // TODAS las de este arreglo hayan terminado. El Gantt dibuja una flecha
  // por cada una.
  @ManyToMany(() => Tarea)
  @JoinTable({
    name: 'tarea_dependencias',
    joinColumn: { name: 'tarea_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'depende_de_id', referencedColumnName: 'id' },
  })
  dependencias: Tarea[];

  // Tareas recurrentes (cuarta ronda de mejoras): si `recurrenciaTipo` no es
  // NULL, al completarse esta tarea se crea sola la siguiente ocurrencia con
  // las fechas desplazadas — ver TareasService.generarSiguienteOcurrencia.
  @Column({ name: 'recurrencia_tipo', type: 'varchar', length: 10, nullable: true })
  recurrenciaTipo: string | null;

  @Column({ name: 'recurrencia_intervalo', type: 'smallint', default: 1 })
  recurrenciaIntervalo: number;

  @Column({ name: 'recurrencia_activa', type: 'boolean', default: true })
  recurrenciaActiva: boolean;

  // Métricas para reportes ejecutivos (cuarta ronda de mejoras): sin estas
  // dos columnas no hay forma de calcular tendencias mes a mes ni el tiempo
  // promedio real para completar una tarea (ver ReportesService).
  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;

  @Column({ name: 'completada_en', type: 'timestamptz', nullable: true })
  completadaEn: Date | null;

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'tarea_usuarios',
    joinColumn: { name: 'tarea_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
  })
  usuariosAsignados: Usuario[];
}
