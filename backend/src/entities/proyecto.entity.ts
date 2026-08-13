import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Entidad de referencia — el módulo de API para Proyectos se construye en la
// Fase 1 del roadmap (PID sección 7). Aquí solo se mapea la tabla ya creada
// por db/schema.sql para que quede disponible desde el primer montado.
@Entity('proyectos')
export class Proyecto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  presupuesto: string;

  @Column({ type: 'varchar', length: 30, default: 'no_iniciado' })
  estatus: string;

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;
}
