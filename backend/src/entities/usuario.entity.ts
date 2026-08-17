import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from './rol.entity';
import { Area } from './area.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 160 })
  nombre: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'rol_id' })
  rolId: number;

  @ManyToOne(() => Rol)
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;

  @Column({ name: 'area_id', type: 'int', nullable: true })
  areaId: number | null;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'area_id' })
  area: Area | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  // Regla de negocio confirmada: gerente_area solo ve presupuesto si su
  // Director (o un admin) lo autoriza explícitamente — PID sección 2.1 y 8.
  @Column({ name: 'ver_presupuesto_autorizado', type: 'boolean', default: false })
  verPresupuestoAutorizado: boolean;

  @Column({ name: 'presupuesto_autorizado_por', type: 'int', nullable: true })
  presupuestoAutorizadoPor: number | null;

  @Column({ name: 'presupuesto_autorizado_en', type: 'timestamptz', nullable: true })
  presupuestoAutorizadoEn: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  // Recuperar contraseña (Fase 2 completa): se guarda solo el hash SHA-256
  // del token de un solo uso, nunca el token en claro — igual criterio que
  // password_hash. reset_password_expira invalida el token aunque nadie lo
  // haya usado, y ambos se limpian al usarlo (o al pedir uno nuevo).
  @Column({ name: 'reset_password_token_hash', type: 'varchar', length: 64, nullable: true })
  resetPasswordTokenHash: string | null;

  @Column({ name: 'reset_password_expira', type: 'timestamptz', nullable: true })
  resetPasswordExpira: Date | null;
}
