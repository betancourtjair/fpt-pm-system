import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

// Plantillas de checklist reutilizables (cuarta ronda de mejoras, ver
// README sección 4): en vez de recrear a mano el mismo checklist en cada
// tarea nueva (ej. "abrir sucursal": permisos, inventario inicial,
// capacitación...), se guarda una vez y se aplica con un clic. Compartida
// en toda la organización (no por proyecto) porque suele repetirse entre
// proyectos distintos — cualquier usuario autenticado puede crear/usar una.
@Entity('plantillas_checklist')
export class PlantillaChecklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'creado_por' })
  creadoPor: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'creado_por' })
  creador: Usuario;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
