import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tarea } from './tarea.entity';
import { Usuario } from './usuario.entity';

// Notificaciones in-app fuera del flujo de alertas_enviadas (ver comentario
// en la migración 011): menciones en comentarios y automatizaciones
// personalizadas, ambas pueden repetirse varias veces para la misma
// tarea+usuario, así que no comparten la tabla/idempotencia de
// alertas_enviadas — se combinan con ella solo al listar (NotificacionesController).
export type TipoNotificacionPersonalizada = 'mencion' | 'automatizacion';

@Entity('notificaciones_personalizadas')
export class NotificacionPersonalizada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoNotificacionPersonalizada;

  @Column({ name: 'tarea_id', type: 'int', nullable: true })
  tareaId: number | null;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'tarea_id' })
  tarea: Tarea | null;

  @Column({ type: 'varchar', length: 300 })
  mensaje: string;

  @Column({ type: 'boolean', default: false })
  leido: boolean;

  @Column({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn: Date;
}
