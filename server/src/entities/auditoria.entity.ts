import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: Usuario;

  @Column({ length: 100 })
  accion!: string;

  @Column({ length: 100 })
  entidad!: string;

  @Column({ name: 'entidad_id', nullable: true })
  entidadId?: string;

  @Column({ type: 'jsonb', nullable: true })
  detalle?: Record<string, unknown>;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;
}
