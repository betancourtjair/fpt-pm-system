import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Direccion } from './direccion.entity';

@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'direccion_id' })
  direccionId: number;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  // Color hex (#RRGGBB) elegido a mano por un admin para distinguir el área
  // en el Gantt/Proyectos/Dashboard; null = todavía no se ha personalizado,
  // se usa un default determinístico (ver paleta-colores.ts).
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @ManyToOne(() => Direccion, (direccion) => direccion.areas)
  @JoinColumn({ name: 'direccion_id' })
  direccion: Direccion;
}
