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
import { Area } from './area.entity';

// Módulo de Proyectos — Fase 1 del roadmap (PID sección 7).
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

  // Opcional (mejora reportada por el usuario): no todo proyecto lleva un
  // presupuesto definido desde el arranque — cuando no se captura, queda
  // NULL y el frontend lo trata como "sin presupuesto asignado" en vez de
  // mostrar $0 (ver ProyectosService.serializar).
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  presupuesto: string | null;

  @Column({ type: 'varchar', length: 30, default: 'no_iniciado' })
  estatus: string;

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;

  @Column({ name: 'creado_por', type: 'int', nullable: true })
  creadoPor: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario | null;

  // Áreas involucradas en el proyecto — usadas para filtrar por alcance
  // (director ve proyectos de su Dirección, gerente_area ve los de su Área).
  @ManyToMany(() => Area)
  @JoinTable({
    name: 'proyecto_areas',
    joinColumn: { name: 'proyecto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'area_id', referencedColumnName: 'id' },
  })
  areas: Area[];
}
