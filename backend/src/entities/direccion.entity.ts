import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Area } from './area.entity';

@Entity('direcciones')
export class Direccion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @OneToMany(() => Area, (area) => area.direccion)
  areas: Area[];
}
