import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sede } from './sede.entity';

// Ventana de apertura de una sede en un día (ej. 08:00–22:00).
// Las clases solo pueden programarse dentro de una franja de su sede.
@Entity('franjas_horarias')
export class FranjaHoraria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sede, (sede) => sede.franjas, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @Column({ type: 'time' })
  apertura!: string;

  @Column({ type: 'time' })
  cierre!: string;
}
