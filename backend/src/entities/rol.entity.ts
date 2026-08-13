import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  nombre: string;

  @Column({ type: 'jsonb', default: {} })
  permisos: Record<string, unknown>;
}
