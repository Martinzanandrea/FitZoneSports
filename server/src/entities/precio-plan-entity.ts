import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { TipoPlan } from './enums';

@Entity('precios_plan')
export class PrecioPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoPlan, enumName: 'tipo_plan', unique: true })
  plan!: TipoPlan;

  @Column('numeric', { precision: 10, scale: 2 })
  precio!: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn!: Date;
}
