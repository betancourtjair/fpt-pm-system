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

  // Color hex (#RRGGBB) elegido a mano por un admin para distinguir la
  // Dirección en Proyectos/Dashboard; null = todavía no se ha
  // personalizado, se usa un default determinístico (ver paleta-colores.ts).
  // Reemplaza el color por Área de una fase anterior: ahora se administra
  // a nivel Dirección nada más (más simple, menos colores que mantener) y
  // cada Área hereda el color de su Dirección.
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @OneToMany(() => Area, (area) => area.direccion)
  areas: Area[];
}
