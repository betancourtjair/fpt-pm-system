import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Usuario } from './usuario.entity';

// Presupuesto real vs. plan (mejora funcional — ver db/migrations/007).
// `proyectos.presupuesto` sigue siendo el presupuesto PLANEADO; cada fila
// aquí es un movimiento real de gasto, y el total gastado de un proyecto es
// la suma de sus filas (ProyectosService.mapaGastosPorProyecto()). Se
// modela como bitácora — no como un solo número editable — para dejar
// rastro de cuándo y en qué se gastó cada monto.
@Entity('gastos_proyecto')
export class GastoProyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'proyecto_id' })
  proyectoId: number;

  @ManyToOne(() => Proyecto)
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @Column({ type: 'varchar', length: 200 })
  concepto: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  monto: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
