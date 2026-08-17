import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Proyecto } from './proyecto.entity';
import { Tarea } from './tarea.entity';
import { Usuario } from './usuario.entity';

// Adjuntar archivos a proyectos/tareas (mejora funcional — ver
// db/migrations/008). El archivo en sí vive en Supabase Storage (bucket
// "adjuntos", privado, ver ArchivosStorageService); esta fila solo guarda
// el metadato y la ruta dentro del bucket. Exactamente uno de
// proyectoId/tareaId está lleno (CHECK a nivel BD, chk_adjunto_un_solo_dueno).
@Entity('adjuntos')
export class Adjunto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'proyecto_id', type: 'int', nullable: true })
  proyectoId: number | null;

  @ManyToOne(() => Proyecto)
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto | null;

  @Column({ name: 'tarea_id', type: 'int', nullable: true })
  tareaId: number | null;

  @ManyToOne(() => Tarea)
  @JoinColumn({ name: 'tarea_id' })
  tarea: Tarea | null;

  @Column({ name: 'nombre_archivo', type: 'varchar', length: 255 })
  nombreArchivo: string;

  // Ruta dentro del bucket de Supabase Storage — NO es una URL pública: el
  // backend siempre hace de intermediario (descarga vía nuestro propio
  // endpoint autenticado, nunca se expone el bucket directamente al
  // frontend, ver ArchivosStorageService.descargar).
  @Column({ name: 'ruta_storage', type: 'varchar', length: 500 })
  rutaStorage: string;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 150, nullable: true })
  tipoMime: string | null;

  @Column({ name: 'tamano_bytes', type: 'bigint' })
  tamanoBytes: string;

  @Column({ name: 'subido_por', type: 'int', nullable: true })
  subidoPor: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'subido_por' })
  subidoPorUsuario: Usuario | null;

  @CreateDateColumn({ name: 'subido_en', type: 'timestamptz' })
  subidoEn: Date;
}
