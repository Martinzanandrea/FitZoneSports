import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { Cancha } from './cancha.entity';

@Entity('bloqueos_cancha')
@Check('chk_rango_bloqueo', `"hasta" > "desde"`)
@Index('idx_bloqueos_cancha_rango', ['cancha', 'desde', 'hasta'])
export class BloqueoCancha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cancha, (cancha) => cancha.bloqueos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cancha_id' })
  cancha: Cancha;

  @Column({ type: 'timestamptz' })
  desde: Date;

  @Column({ type: 'timestamptz' })
  hasta: Date;

  @Column({ length: 255, nullable: true })
  motivo?: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
