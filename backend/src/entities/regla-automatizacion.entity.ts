import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Usuario } from './usuario.entity';

// Automatizaciones configurables por el usuario (tercera ronda de mejoras,
// ver README sección 4). "Si esto → entonces esto" sin motor de reglas
// complejo: 3 condiciones combinables (prioridad, estatus, vencida) y 3
// acciones (avisar al responsable, al Director, o a un usuario puntual).
export type TipoAccionRegla = 'notificar_responsable' | 'notificar_director' | 'notificar_usuario';

@Entity('reglas_automatizacion')
export class ReglaAutomatizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'proyecto_id' })
  proyectoId: number;

  @ManyToOne(() => Proyecto)
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ name: 'condicion_prioridad', type: 'varchar', length: 10, nullable: true })
  condicionPrioridad: string | null;

  @Column({ name: 'condicion_estatus', type: 'varchar', length: 30, nullable: true })
  condicionEstatus: string | null;

  @Column({ name: 'condicion_vencida', type: 'boolean', default: false })
  condicionVencida: boolean;

  @Column({ name: 'accion_tipo', type: 'varchar', length: 20 })
  accionTipo: TipoAccionRegla;

  @Column({ name: 'accion_usuario_id', type: 'int', nullable: true })
  accionUsuarioId: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'accion_usuario_id' })
  accionUsuario: Usuario | null;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ name: 'creado_por' })
  creadoPor: number;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
