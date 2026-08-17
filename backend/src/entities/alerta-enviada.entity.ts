import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tarea } from './tarea.entity';
import { Usuario } from './usuario.entity';

// Registro de alertas por correo — Fase 2 del roadmap (PID sección 7).
// El UNIQUE (tarea_id, usuario_id, tipo) en db/schema.sql es lo que nos da
// idempotencia: nunca se manda dos veces el mismo tipo de alerta a la misma
// persona para la misma tarea (ver AlertasService.registrarSiNoExiste).
export type TipoAlerta = 'asignacion' | '48h' | '24h';

@Entity('alertas_enviadas')
export class AlertaEnviada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tarea_id' })
  tareaId: number;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'tarea_id' })
  tarea: Tarea;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoAlerta;

  @Column({ name: 'fecha_programada', type: 'timestamptz' })
  fechaProgramada: Date;

  @Column({ name: 'fecha_enviada', type: 'timestamptz', nullable: true })
  fechaEnviada: Date | null;

  @Column({ name: 'estatus_envio', type: 'varchar', length: 20, default: 'pendiente' })
  estatusEnvio: string;

  @Column({ type: 'smallint', default: 0 })
  intentos: number;

  // Notificaciones dentro de la app (Fase 2, PID sección 7): reutilizamos
  // esta misma fila como notificación in-app — "leido" es independiente de
  // estatusEnvio, así que si el correo falló la persona igual la ve como
  // no leída dentro del sistema (ver NotificacionesController).
  @Column({ type: 'boolean', default: false })
  leido: boolean;
}
