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

  @ManyToOne(() => Direccion, (direccion) => direccion.areas)
  @JoinColumn({ name: 'direccion_id' })
  direccion: Direccion;
}
