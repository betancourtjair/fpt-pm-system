import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Tarea } from './tarea.entity';

// Comentarios por tarea — mejora sugerida para colaborar dentro de la
// herramienta en vez de salirse a correo/WhatsApp (ver README sección 4).
@Entity('comentarios_tarea')
export class ComentarioTarea {
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

  @Column({ type: 'text' })
  texto: string;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
