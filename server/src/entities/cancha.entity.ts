import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Sede } from './sede.entity';
import { BloqueoCancha } from './bloqueo-cancha.entity';
import { ReservaCancha } from './reserva-cancha.entity';
import { TipoCancha, EstadoCancha } from './enums';

@Entity('canchas')
export class Cancha {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sede, (sede) => sede.canchas, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede: Sede;

  @Column({ length: 80 })
  nombre: string;

  @Column({ type: 'enum', enum: TipoCancha, enumName: 'tipo_cancha' })
  tipo: TipoCancha;

  @Column('numeric', { name: 'costo_hora_base', precision: 10, scale: 2 })
  costoHoraBase: string;

  @Column({
    type: 'enum',
    enum: EstadoCancha,
    enumName: 'estado_cancha',
    default: EstadoCancha.ACTIVA,
  })
  estado: EstadoCancha;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;

  @OneToMany(() => BloqueoCancha, (bloqueo) => bloqueo.cancha)
  bloqueos: BloqueoCancha[];

  @OneToMany(() => ReservaCancha, (reserva) => reserva.cancha)
  reservas: ReservaCancha[];
}
