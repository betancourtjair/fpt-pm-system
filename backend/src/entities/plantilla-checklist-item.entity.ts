import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlantillaChecklist } from './plantilla-checklist.entity';

// Ítems de una plantilla de checklist (cuarta ronda de mejoras) — al
// aplicar la plantilla a una tarea, cada uno se convierte en una fila de
// subtareas_checklist para esa tarea puntual.
@Entity('plantillas_checklist_items')
export class PlantillaChecklistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plantilla_id' })
  plantillaId: number;

  @ManyToOne(() => PlantillaChecklist)
  @JoinColumn({ name: 'plantilla_id' })
  plantilla: PlantillaChecklist;

  @Column({ type: 'varchar', length: 300 })
  texto: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}
